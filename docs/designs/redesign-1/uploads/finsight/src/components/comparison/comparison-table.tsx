import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import { TrendBadge } from "@/components/trend-badge"

interface Category {
  name: string
  color: string
  byMonth: Map<string, number>
}

interface MonthlyTotal {
  month: string
  label: string
  total: number
}

interface ComparisonTableProps {
  months: string[]
  categories: Category[]
  monthlyTotals: MonthlyTotal[]
  incomeByMonth: Map<string, number>
}

export function ComparisonTable({
  months,
  categories,
  monthlyTotals,
  incomeByMonth,
}: ComparisonTableProps) {
  return (
    <div className="rounded-lg border overflow-auto max-h-[75vh]">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b">
            <th className="sticky top-0 left-0 z-40 bg-card px-4 py-3 min-w-[160px] text-left font-medium whitespace-nowrap">
              Category
            </th>
            {months.map((month) => (
              <th key={month} className="sticky top-0 z-30 text-right px-4 py-3 whitespace-nowrap min-w-[110px] bg-card font-medium">
                {formatYearMonth(month)}
              </th>
            ))}
            <th className="sticky top-0 z-30 text-right px-4 py-3 whitespace-nowrap min-w-[90px] bg-card font-medium text-muted-foreground">
              Avg / mo
            </th>
            <th className="sticky top-0 z-30 text-right px-4 py-3 whitespace-nowrap min-w-[80px] bg-card font-medium text-muted-foreground">
              Trend
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {categories.map((cat) => {
            const values = months.map((m) => cat.byMonth.get(m) ?? 0)
            const nonZeroValues = values.filter((v) => v > 0)
            const avg = nonZeroValues.length > 0
              ? nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length
              : 0
            const first = values.find((v) => v > 0) ?? 0
            const last = [...values].reverse().find((v) => v > 0) ?? 0
            const trendPct = first > 0 ? ((last - first) / first) * 100 : 0

            return (
              <tr key={cat.name} className="group border-b transition-colors hover:bg-muted/50">
                <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/50 px-4 py-2.5 font-medium whitespace-nowrap align-middle">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate max-w-[130px]">{cat.name}</span>
                  </div>
                </td>
                {values.map((val, i) => (
                  <td key={months[i]} className="text-right px-4 py-2.5 tabular-nums align-middle whitespace-nowrap">
                    {val > 0 ? formatCurrency(val) : <span className="text-muted-foreground/30">—</span>}
                  </td>
                ))}
                <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground align-middle whitespace-nowrap">
                  {avg > 0 ? formatCurrency(avg) : <span className="text-muted-foreground/30">—</span>}
                </td>
                <td className="text-right px-4 py-2.5 align-middle whitespace-nowrap">
                  <TrendBadge pct={trendPct} hasData={nonZeroValues.length > 1} />
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="border-t bg-muted/50 font-medium">
          <tr className="border-t-2 font-semibold border-b">
            <td className="sticky left-0 z-10 bg-muted/80 backdrop-blur px-4 py-3 align-middle whitespace-nowrap">
              Total Spending
            </td>
            {monthlyTotals.map(({ month, total }) => (
              <td key={month} className="text-right px-4 py-3 tabular-nums align-middle whitespace-nowrap">
                {formatCurrency(total)}
              </td>
            ))}
            <td className="text-right px-4 py-3 tabular-nums text-muted-foreground align-middle whitespace-nowrap">
              {formatCurrency(monthlyTotals.reduce((s, m) => s + m.total, 0) / (monthlyTotals.length || 1))}
            </td>
            <td />
          </tr>
          <tr className="border-b">
            <td className="sticky left-0 z-10 bg-muted/95 px-4 py-3 font-medium text-positive align-middle whitespace-nowrap">
              Income
            </td>
            {months.map((month) => {
              const income = incomeByMonth.get(month) ?? 0
              return (
                <td key={month} className="text-right px-4 py-3 tabular-nums text-positive align-middle whitespace-nowrap">
                  {income > 0 ? formatCurrency(income) : <span className="text-muted-foreground/30">—</span>}
                </td>
              )
            })}
            <td colSpan={2} />
          </tr>
          <tr>
            <td className="sticky left-0 z-10 bg-muted/95 px-4 py-3 font-medium align-middle whitespace-nowrap">Net</td>
            {months.map((month) => {
              const income = incomeByMonth.get(month) ?? 0
              const spending = monthlyTotals.find((m) => m.month === month)?.total ?? 0
              const net = income - spending
              return (
                <td
                  key={month}
                  className={cn("text-right px-4 py-3 tabular-nums font-medium align-middle whitespace-nowrap", net >= 0 ? "text-positive" : "text-negative")}
                >
                  {formatCurrency(net)}
                </td>
              )
            })}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
