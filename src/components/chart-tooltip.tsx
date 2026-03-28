import { formatCurrency } from "@/lib/utils"

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
]

export function ChartTooltip({ active, payload, label, labelFormatter }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  labelFormatter?: (label: string) => string
}) {
  if (!active || !payload?.length) return null
  const displayLabel = labelFormatter ? labelFormatter(label ?? "") : label
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm shadow-xl px-3.5 py-2.5 text-sm min-w-36">
      {displayLabel && (
        <p className="font-semibold text-foreground text-xs mb-2 pb-1.5 border-b">{displayLabel}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground text-xs">{entry.name}</span>
            </div>
            <span className="font-semibold tabular-nums text-xs text-foreground">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
