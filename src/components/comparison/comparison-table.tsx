import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendBadge } from "@/components/trend-badge"

export function ComparisonTable({
  months,
  categories,
  monthlyTotals,
  incomeByMonth,
}: {
  months: string[]
  categories: { name: string; color: string; byMonth: Map<string, number> }[]
  monthlyTotals: { month: string; label: string; total: number }[]
  incomeByMonth: Map<string, number>
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="sticky left-0 z-20 bg-muted/80 backdrop-blur px-4 py-3 min-w-[160px]">
              Category
            </TableHead>
            {months.map((month) => (
              <TableHead key={month} className="text-right px-4 py-3 whitespace-nowrap min-w-[110px]">
                {formatYearMonth(month)}
              </TableHead>
            ))}
            <TableHead className="text-right px-4 py-3 text-muted-foreground whitespace-nowrap min-w-[90px]">
              Avg / mo
            </TableHead>
            <TableHead className="text-right px-4 py-3 text-muted-foreground whitespace-nowrap min-w-[80px]">
              Trend
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
              <TableRow key={cat.name} className="group">
                <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-4 py-2.5 font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate max-w-[130px]">{cat.name}</span>
                  </div>
                </TableCell>
                {values.map((val, i) => (
                  <TableCell key={months[i]} className="text-right px-4 py-2.5 tabular-nums">
                    {val > 0 ? formatCurrency(val) : <span className="text-muted-foreground/30">—</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                  {avg > 0 ? formatCurrency(avg) : <span className="text-muted-foreground/30">—</span>}
                </TableCell>
                <TableCell className="text-right px-4 py-2.5">
                  <TrendBadge pct={trendPct} hasData={nonZeroValues.length > 1} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="border-t-2 font-semibold">
            <TableCell className="sticky left-0 z-10 bg-muted/80 backdrop-blur px-4 py-3">
              Total Spending
            </TableCell>
            {monthlyTotals.map(({ month, total }) => (
              <TableCell key={month} className="text-right px-4 py-3 tabular-nums">
                {formatCurrency(total)}
              </TableCell>
            ))}
            <TableCell className="text-right px-4 py-3 tabular-nums text-muted-foreground">
              {formatCurrency(monthlyTotals.reduce((s, m) => s + m.total, 0) / (monthlyTotals.length || 1))}
            </TableCell>
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-muted/30 px-4 py-3 font-medium text-positive">
              Income
            </TableCell>
            {months.map((month) => {
              const income = incomeByMonth.get(month) ?? 0
              return (
                <TableCell key={month} className="text-right px-4 py-3 tabular-nums text-positive">
                  {income > 0 ? formatCurrency(income) : <span className="text-muted-foreground/30">—</span>}
                </TableCell>
              )
            })}
            <TableCell colSpan={2} />
          </TableRow>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-muted/30 px-4 py-3 font-medium">Net</TableCell>
            {months.map((month) => {
              const income = incomeByMonth.get(month) ?? 0
              const spending = monthlyTotals.find((m) => m.month === month)?.total ?? 0
              const net = income - spending
              return (
                <TableCell
                  key={month}
                  className={cn("text-right px-4 py-3 tabular-nums font-medium", net >= 0 ? "text-positive" : "text-negative")}
                >
                  {formatCurrency(net)}
                </TableCell>
              )
            })}
            <TableCell colSpan={2} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
