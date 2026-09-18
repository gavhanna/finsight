import { cn, formatCurrency } from "@/lib/utils"
import { Pencil, Trash2 } from "lucide-react"

export type ProgressColor = "green" | "amber" | "red"

export function progressColor(ratio: number): ProgressColor {
  if (ratio > 1)     return "red"
  if (ratio >= 0.75) return "amber"
  return "green"
}

export const BAR_TRACK = "h-0.5 rounded-full bg-muted overflow-hidden"
export const BAR_FILL: Record<ProgressColor, string> = {
  green: "h-full rounded-full bg-positive transition-all duration-500",
  amber: "h-full rounded-full bg-amber-500 transition-all duration-500",
  red:   "h-full rounded-full bg-negative transition-all duration-500",
}
export const BADGE_CLASSES: Record<ProgressColor, string> = {
  green: "bg-positive/10 text-positive border-positive/20",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  red:   "bg-negative/10 text-negative border-negative/20",
}

export function BudgetRow({
  name,
  color: _color,
  budgeted,
  spent,
  currency,
  isOverride,
  onOverride,
  onRemoveOverride,
}: {
  name: string
  color: string
  budgeted: number
  spent: number
  currency: string
  isOverride: boolean
  onOverride: () => void
  onRemoveOverride: () => void
}) {
  const ratio = budgeted > 0 ? Math.min(spent / budgeted, 1) : 0
  const col = progressColor(budgeted > 0 ? spent / budgeted : 0)
  const remaining = budgeted - spent
  const showOverMarker = budgeted > 0 && spent > budgeted
  const overMarkerLeft = showOverMarker ? `${(budgeted / spent) * 100}%` : undefined

  return (
    <div className="flex flex-col gap-1.5 py-3 group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{name}</span>
          {isOverride && (
            <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5 shrink-0">
              override
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(spent, currency)} / {formatCurrency(budgeted, currency)}
          </span>
          <span className={cn("text-[11px] font-semibold border rounded-full px-2 py-0.5", BADGE_CLASSES[col])}>
            {budgeted > 0 ? `${Math.round((spent / budgeted) * 100)}%` : "—"}
          </span>
          <button
            onClick={onOverride}
            className="text-muted-foreground hover:text-foreground"
            title="Override budget for this month"
          >
            <Pencil className="size-3" />
          </button>
          {isOverride && (
            <button
              onClick={onRemoveOverride}
              className="text-muted-foreground hover:text-negative"
              title="Remove override"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <div className={BAR_TRACK}>
          {showOverMarker ? (
            <>
              <div
                className={BAR_FILL.amber}
                style={{ width: overMarkerLeft }}
              />
              <div
                className="absolute top-0 bottom-0 right-0 bg-negative transition-all duration-500"
                style={{ left: overMarkerLeft }}
              />
            </>
          ) : (
            <div className={BAR_FILL[col]} style={{ width: `${ratio * 100}%` }} />
          )}
        </div>
        {showOverMarker && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-white/50"
            style={{ left: overMarkerLeft }}
          />
        )}
      </div>
      <p className={cn("text-[11px]", spent > budgeted ? "text-negative" : "text-muted-foreground")}>
        {spent > budgeted
          ? `Over by ${formatCurrency(spent - budgeted, currency)}`
          : remaining > 0
          ? `${formatCurrency(remaining, currency)} remaining`
          : budgeted > 0
          ? "On track"
          : " "}
      </p>
    </div>
  )
}
