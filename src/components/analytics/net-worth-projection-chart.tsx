import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { NetWorthProjectionFit } from "@/server/fn/analytics/net-worth-projection"
import { buildProjection } from "@/lib/net-worth-projection"

type Row = {
  date: string
  actual: number | null
  projected: number | null
  lower: number | null
  band: number | null
}

function formatLabel(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
}

function ProjectionTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: Row }>
  label?: string
  currency: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const isProjected = row.actual == null
  const value = isProjected ? row.projected : row.actual
  if (value == null) return null
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm shadow-xl px-3.5 py-2.5 text-sm min-w-40">
      <p className="font-semibold text-foreground text-xs mb-2 pb-1.5 border-b">{formatLabel(label ?? "")}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-xs">{isProjected ? "Projected" : "Net worth"}</span>
        <span className="font-semibold tabular-nums text-xs text-foreground">{formatCurrency(value, currency)}</span>
      </div>
      {isProjected && row.lower != null && row.band != null && (
        <div className="flex items-center justify-between gap-4 mt-1">
          <span className="text-muted-foreground text-xs">Likely range</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatCurrency(row.lower, currency, { notation: "compact", maximumFractionDigits: 1 })}–
            {formatCurrency(row.lower + row.band, currency, { notation: "compact", maximumFractionDigits: 1 })}
          </span>
        </div>
      )}
    </div>
  )
}

export function NetWorthProjectionChart({
  history,
  fit,
  horizonMonths,
  currency = "EUR",
  zeroDate,
}: {
  history: { date: string; total: number }[]
  fit: NetWorthProjectionFit
  horizonMonths: number
  currency?: string
  zeroDate?: string | null
}) {
  const { points } = buildProjection(fit, horizonMonths)

  // History rows: solid line only. The last history row also seeds the dashed
  // line + zero-width band so the projection visually continues from it.
  const rows: Row[] = history.map((h, i) => ({
    date: h.date,
    actual: h.total,
    projected: i === history.length - 1 ? h.total : null,
    lower: i === history.length - 1 ? h.total : null,
    band: i === history.length - 1 ? 0 : null,
  }))
  // Projection rows start after the anchor (points[0] duplicates the last actual date).
  for (const p of points.slice(1)) {
    rows.push({ date: p.date, actual: null, projected: p.projected, lower: p.lower, band: p.band })
  }

  const projectedStroke = fit.slopePerDay >= 0 ? "var(--color-positive, oklch(0.72 0.19 152))" : "var(--color-negative, oklch(0.65 0.2 25))"

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="netWorthActualFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.65 0.15 250)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="oklch(0.65 0.15 250)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatLabel} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<ProjectionTooltip currency={currency} />} />

        {/* Confidence cone: invisible base + shaded height stacked on top. */}
        <Area dataKey="lower" stackId="cone" stroke="none" fill="transparent" isAnimationActive={false} activeDot={false} legendType="none" connectNulls={false} />
        <Area dataKey="band" stackId="cone" stroke="none" fill={projectedStroke} fillOpacity={0.1} isAnimationActive={false} activeDot={false} legendType="none" connectNulls={false} />

        {/* Actual history — solid. */}
        <Area
          dataKey="actual"
          type="monotone"
          stroke="oklch(0.65 0.15 250)"
          strokeWidth={2}
          fill="url(#netWorthActualFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "oklch(0.65 0.15 250)" }}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Projection — dashed, colour follows trend direction. */}
        <Line
          dataKey="projected"
          type="monotone"
          stroke={projectedStroke}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: projectedStroke }}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Boundary between actual and projected. */}
        <ReferenceLine x={fit.lastDate} stroke="var(--border)" strokeDasharray="2 3" />
        <ReferenceLine y={0} stroke="var(--border)" />
        {zeroDate && (
          <ReferenceLine
            x={zeroDate}
            stroke="var(--color-negative, oklch(0.65 0.2 25))"
            strokeDasharray="4 3"
            label={{ value: "€0", position: "insideTopRight", fontSize: 10, fill: "var(--color-negative, oklch(0.65 0.2 25))" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
