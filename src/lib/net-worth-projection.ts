import type { NetWorthProjectionFit } from "@/server/fn/analytics/net-worth-projection"

/** z-score for an ~80% prediction interval — keeps the cone readable rather than alarmingly wide. */
const Z_80 = 1.2816

const AVG_DAYS_PER_MONTH = 30.4375

function addDays(date: string, days: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)))
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((tb - ta) / 86_400_000)
}

/** Standard error of a regression prediction at x days from the window start. */
function predictionSe(fit: NetWorthProjectionFit, x: number): number {
  if (fit.residualStd <= 0 || fit.sxx <= 0 || fit.n <= 2) return 0
  return fit.residualStd * Math.sqrt(1 + 1 / fit.n + (x - fit.meanX) ** 2 / fit.sxx)
}

export type ProjectionPoint = {
  date: string
  /** Projected net worth (anchored on the last actual value, extended by the fitted slope). */
  projected: number
  /** Lower bound of the confidence cone. */
  lower: number
  /** Cone height (upper − lower); stacked on top of `lower` to shade the band in recharts. */
  band: number
}

export type NetWorthMilestones = {
  monthlyChange: number
  projectedValue: number
  /** null when the line never crosses zero within the cap (e.g. trending up). */
  zeroDate: string | null
  /** Whether the trend is heading upward. */
  trendingUp: boolean
  /** Qualitative confidence from fit quality and window length. */
  confidence: "low" | "moderate" | "high"
}

/**
 * Extrapolates the fitted trend forward for `horizonMonths`, sampling weekly, and
 * anchoring the line on the most recent actual value so it continues from reality.
 */
export function buildProjection(
  fit: NetWorthProjectionFit,
  horizonMonths: number,
): { points: ProjectionPoint[]; milestones: NetWorthMilestones } {
  const horizonDays = Math.round(horizonMonths * AVG_DAYS_PER_MONTH)
  const lastX = daysBetween(fit.windowStart, fit.lastDate)

  const at = (daysAhead: number): ProjectionPoint => {
    const projected = fit.lastValue + fit.slopePerDay * daysAhead
    const se = predictionSe(fit, lastX + daysAhead)
    const half = Z_80 * se
    return {
      date: addDays(fit.lastDate, daysAhead),
      projected,
      lower: projected - half,
      band: 2 * half,
    }
  }

  const points: ProjectionPoint[] = [at(0)]
  for (let d = 7; d < horizonDays; d += 7) points.push(at(d))
  points.push(at(horizonDays))

  const monthlyChange = fit.slopePerDay * AVG_DAYS_PER_MONTH
  const projectedValue = fit.lastValue + fit.slopePerDay * horizonDays

  // Zero-crossing: lastValue + slope * daysAhead = 0.
  let zeroDate: string | null = null
  if (fit.slopePerDay < 0 && fit.lastValue > 0) {
    const daysToZero = -fit.lastValue / fit.slopePerDay
    if (daysToZero > 0 && daysToZero <= 3650) zeroDate = addDays(fit.lastDate, daysToZero)
  }

  const confidence: NetWorthMilestones["confidence"] =
    fit.windowDays >= 60 && fit.r2 >= 0.5 ? "high" : fit.windowDays >= 30 && fit.r2 >= 0.25 ? "moderate" : "low"

  return {
    points,
    milestones: {
      monthlyChange,
      projectedValue,
      zeroDate,
      trendingUp: fit.slopePerDay >= 0,
      confidence,
    },
  }
}
