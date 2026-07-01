import { cn, formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export function IncomeAllocationBar({
  incomeActual,
  incomeAvg3m,
  allBudgeted,
  allSpent,
  currency,
}: {
  incomeActual: number
  incomeAvg3m: number
  allBudgeted: number
  allSpent: number
  currency: string
}) {
  const income = incomeActual > 0 ? incomeActual : incomeAvg3m
  const usingAvg = incomeActual === 0 && incomeAvg3m > 0

  if (income === 0) return null

  const budgetedPct    = Math.min((allBudgeted / income) * 100, 100)
  const spentPct       = Math.min((allSpent    / income) * 100, 100)
  const actualSpentPct = Math.round((allSpent  / income) * 100)
  const unallocatedPct = Math.max(100 - budgetedPct, 0)
  const isOver         = allSpent > income

  return (
    <Card>
      <CardContent className="p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="section-label mb-0">Income coverage</p>
            {usingAvg && (
              <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">3mo avg</span>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Income</p>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(income, currency)}</span>
          </div>
        </div>

        {isOver ? (
          <div className="relative">
            <div className="relative h-2 rounded-full overflow-hidden bg-muted">
              <div
                className="absolute left-0 top-0 h-full bg-positive transition-all duration-500"
                style={{ width: `${(income / allSpent) * 100}%` }}
              />
              <div
                className="absolute top-0 h-full bg-negative transition-all duration-500"
                style={{ left: `${(income / allSpent) * 100}%`, right: 0 }}
              />
            </div>
            <div
              className="absolute -top-1 -bottom-1 w-0.5 bg-white/50 rounded-full"
              style={{ left: `${(income / allSpent) * 100}%` }}
            />
          </div>
        ) : (
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="absolute left-0 top-0 h-full bg-positive transition-all duration-500"
              style={{ width: `${spentPct}%` }}
            />
            {budgetedPct > spentPct && (
              <div
                className="absolute top-0 h-full bg-primary/25 transition-all duration-500"
                style={{ left: `${spentPct}%`, width: `${budgetedPct - spentPct}%` }}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", isOver ? "bg-negative" : "bg-positive")} />
            Spent {formatCurrency(allSpent, currency)}{" "}
            <span className={cn("font-medium", isOver ? "text-negative" : "text-foreground")}>
              ({actualSpentPct}%)
            </span>
            {isOver && (
              <span className="text-negative font-medium">
                · over by {formatCurrency(allSpent - income, currency)}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary/40" />
            Budgeted {formatCurrency(allBudgeted, currency)} <span className="text-foreground font-medium">({Math.round(budgetedPct)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            Unallocated {formatCurrency(Math.max(income - allBudgeted, 0), currency)} <span className="text-foreground font-medium">({Math.round(unallocatedPct)}%)</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
