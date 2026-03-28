import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function TrendBadge({ pct, hasData = true }: { pct: number | null; hasData?: boolean }) {
  if (pct === null || !hasData) {
    return <span className="text-muted-foreground/40 text-xs">—</span>
  }
  const abs = Math.abs(pct)
  if (abs < 1) {
    return (
      <span className="text-muted-foreground text-xs inline-flex items-center gap-0.5 justify-end">
        <Minus className="size-3" />0%
      </span>
    )
  }
  // Spending up = bad (negative), spending down = good (positive)
  if (pct > 0) {
    return (
      <span className="text-negative text-xs inline-flex items-center gap-0.5 justify-end">
        <TrendingUp className="size-3" />+{abs.toFixed(0)}%
      </span>
    )
  }
  return (
    <span className="text-positive text-xs inline-flex items-center gap-0.5 justify-end">
      <TrendingDown className="size-3" />-{abs.toFixed(0)}%
    </span>
  )
}
