import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { formatCurrency, cn } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

type BudgetRow = { categoryName: string; budgeted: number; spent: number }

function barColor(ratio: number) {
  if (ratio > 1)     return "bg-negative"
  if (ratio >= 0.75) return "bg-amber-500"
  return "bg-positive"
}

export function SpendingPieChart({ data, currency = "EUR", budgets }: {
  data: { categoryName: string; categoryColor: string; total: number; count: number }[]
  currency?: string
  budgets?: BudgetRow[]
}) {
  const budgetMap = budgets
    ? Object.fromEntries(budgets.map((b) => [b.categoryName, b]))
    : null

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
      <ResponsiveContainer width="100%" height={200} className="sm:w-[50%] sm:flex-shrink-0">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={82}
            innerRadius={44}
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.categoryColor} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 overflow-auto max-h-48">
        {data.map((d) => {
          const budget = budgetMap?.[d.categoryName]
          const ratio = budget && budget.budgeted > 0 ? budget.spent / budget.budgeted : null
          return (
            <div key={d.categoryName} className="group">
              <div className="flex items-center gap-2 text-sm py-0.5">
                <div className="h-2 w-2 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: d.categoryColor }} />
                <span className="flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">{d.categoryName}</span>
                <span className="font-semibold tabular-nums text-xs">{formatCurrency(d.total, currency)}</span>
                {budget && (
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    / {formatCurrency(budget.budgeted, currency)}
                  </span>
                )}
              </div>
              {ratio !== null && (
                <div className="ml-4 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", barColor(ratio))}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
