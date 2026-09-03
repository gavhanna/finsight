import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { balanceHistory } from "../../../db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { z } from "zod"

/** Whole days between two YYYY-MM-DD dates (b - a), using UTC to avoid DST drift. */
function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((tb - ta) / 86_400_000)
}

export type NetWorthProjectionFit = {
  /** € change per day (regression slope). */
  slopePerDay: number
  /** x=0 reference date (start of the fit window), YYYY-MM-DD. */
  windowStart: string
  /** Most recent history date, YYYY-MM-DD. Projection is anchored here. */
  lastDate: string
  /** Actual net worth at lastDate — the anchor the projected line passes through. */
  lastValue: number
  /** Number of daily points used in the fit. */
  n: number
  /** Mean of x (days since windowStart) across the fit window. */
  meanX: number
  /** Σ(x - meanX)² — used for prediction-interval width. */
  sxx: number
  /** Residual standard deviation of the fit. */
  residualStd: number
  /** Coefficient of determination (0–1). */
  r2: number
  /** Span of the fit window in days. */
  windowDays: number
}

export type NetWorthProjectionData = {
  history: { date: string; total: number }[]
  fit: NetWorthProjectionFit | null
}

/**
 * Returns the historical net-worth series plus a least-squares linear fit over a
 * trailing window, so the client can extrapolate forward for a selectable horizon.
 * Net worth here is the sum of tracked account balances for the given currency.
 */
export const getNetWorthProjection = createServerFn()
  .inputValidator(
    z.object({
      currency: z.string().default("EUR"),
      accountIds: z.array(z.string()).optional(),
      /** Trailing window (days) the regression is fitted over. */
      windowDays: z.number().int().positive().max(1095).default(90),
    }),
  )
  .handler(async ({ data: { currency, accountIds, windowDays } }): Promise<NetWorthProjectionData> => {
    const conditions = [eq(balanceHistory.currency, currency)]
    if (accountIds?.length) conditions.push(inArray(balanceHistory.accountId, accountIds))

    const records = await db
      .select()
      .from(balanceHistory)
      .where(and(...conditions))
      .orderBy(balanceHistory.recordedAt)

    // Latest balance per account per day, then sum across accounts → daily net worth.
    const latestPerAccountDay = new Map<string, number>()
    for (const r of records) {
      const dateKey = new Date(r.recordedAt).toISOString().slice(0, 10)
      latestPerAccountDay.set(`${dateKey}|${r.accountId}`, r.balance)
    }
    const dailyTotals = new Map<string, number>()
    for (const [key, balance] of latestPerAccountDay.entries()) {
      const dateKey = key.split("|")[0]
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + balance)
    }

    const history = Array.from(dailyTotals.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (history.length < 2) {
      return { history, fit: null }
    }

    // Restrict the fit to the trailing window.
    const lastDate = history[history.length - 1].date
    const windowStartDate = (() => {
      const cutoff = new Date(Date.UTC(+lastDate.slice(0, 4), +lastDate.slice(5, 7) - 1, +lastDate.slice(8, 10)))
      cutoff.setUTCDate(cutoff.getUTCDate() - windowDays)
      return cutoff.toISOString().slice(0, 10)
    })()
    const windowPoints = history.filter((h) => h.date >= windowStartDate)
    if (windowPoints.length < 2) {
      return { history, fit: null }
    }

    const windowStart = windowPoints[0].date
    const xs = windowPoints.map((p) => daysBetween(windowStart, p.date))
    const ys = windowPoints.map((p) => p.total)
    const n = windowPoints.length

    const sumX = xs.reduce((s, x) => s + x, 0)
    const sumY = ys.reduce((s, y) => s + y, 0)
    const meanX = sumX / n
    const meanY = sumY / n

    let sxx = 0
    let sxy = 0
    let syy = 0
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX
      const dy = ys[i] - meanY
      sxx += dx * dx
      sxy += dx * dy
      syy += dy * dy
    }

    const slopePerDay = sxx > 0 ? sxy / sxx : 0
    const intercept = meanY - slopePerDay * meanX

    let sse = 0
    for (let i = 0; i < n; i++) {
      const pred = intercept + slopePerDay * xs[i]
      sse += (ys[i] - pred) ** 2
    }
    const residualStd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0
    const r2 = syy > 0 ? Math.max(0, 1 - sse / syy) : 0

    return {
      history,
      fit: {
        slopePerDay,
        windowStart,
        lastDate,
        lastValue: history[history.length - 1].total,
        n,
        meanX,
        sxx,
        residualStd,
        r2,
        windowDays: daysBetween(windowStart, lastDate),
      },
    }
  })
