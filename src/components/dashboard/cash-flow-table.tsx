import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"

export function CashFlowTable({
  data,
  stats,
  currency = "EUR",
}: {
  data: { month: string; income: number; moneyIn: number; expenses: number; net: number }[]
  stats: { totalIncome: number; totalMoneyIn: number; totalExpenses: number; net: number; count: number }
  currency?: string
}) {
  const dataWithRate = data.map((r) => ({
    ...r,
    savingsRate: r.income > 0 ? r.net / r.income : null,
  }))
  const { sorted, sortKey, sortDir, toggle } = useSortable(dataWithRate, "month")

  if (data.length < 2) return null

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <SortableHead id="month" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="pl-5">Month</SortableHead>
              <SortableHead id="income" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Income</SortableHead>
              <SortableHead id="moneyIn" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden md:table-cell">Money In</SortableHead>
              <SortableHead id="expenses" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Expenses</SortableHead>
              <SortableHead id="net" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Net</SortableHead>
              <SortableHead id="savingsRate" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right pr-5 hidden sm:table-cell">Savings Rate</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const net = row.net
              const savingsRate = row.income > 0 ? `${((net / row.income) * 100).toFixed(0)}%` : "—"
              const savingsPositive = row.income > 0 && net > 0
              return (
                <TableRow key={row.month} className="hover:bg-muted/30">
                  <TableCell className="pl-5 font-medium">{formatYearMonth(row.month)}</TableCell>
                  <TableCell className="text-right text-positive tabular-nums">{formatCurrency(row.income, currency)}</TableCell>
                  <TableCell className="text-right text-primary tabular-nums hidden md:table-cell">{formatCurrency(row.moneyIn, currency)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.expenses, currency)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums font-semibold", net >= 0 ? "text-positive" : "text-negative")}>
                    {formatCurrency(net, currency)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums pr-5 hidden sm:table-cell", savingsPositive ? "text-positive" : "text-muted-foreground")}>
                    {savingsRate}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold pl-5">Total</TableCell>
              <TableCell className="text-right text-positive tabular-nums font-bold">{formatCurrency(stats.totalIncome, currency)}</TableCell>
              <TableCell className="text-right text-primary tabular-nums font-bold hidden md:table-cell">{formatCurrency(stats.totalMoneyIn, currency)}</TableCell>
              <TableCell className="text-right tabular-nums font-bold text-muted-foreground">{formatCurrency(stats.totalExpenses, currency)}</TableCell>
              <TableCell className={cn("text-right tabular-nums font-bold", stats.net >= 0 ? "text-positive" : "text-negative")}>
                {formatCurrency(stats.net, currency)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums font-bold pr-5 hidden sm:table-cell", stats.totalIncome > 0 && stats.net > 0 ? "text-positive" : "text-muted-foreground")}>
                {stats.totalIncome > 0 ? `${((stats.net / stats.totalIncome) * 100).toFixed(0)}%` : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
