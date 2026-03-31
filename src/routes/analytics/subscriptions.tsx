import { createFileRoute } from "@tanstack/react-router"
import { getRecurringTransactions } from "../../server/fn/insights"
import { getSetting } from "../../server/fn/settings"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CreditCard, TrendingDown, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { PageHelp } from "@/components/ui/page-help"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

export const Route = createFileRoute("/analytics/subscriptions")({
  component: SubscriptionsPage,
  loader: async () => {
    const [recurring, currency] = await Promise.all([
      getRecurringTransactions(),
      getSetting({ data: "preferred_currency" }),
    ])
    return { recurring, currency: currency ?? "EUR" }
  },
})

function SubscriptionsPage() {
  const { recurring, currency } = Route.useLoaderData()

  const active = recurring.filter((r) => r.isActive)

  const totalMonthly = active.reduce((s, r) => s + r.monthlyEquiv, 0)
  const totalAnnual = totalMonthly * 12

  // Category breakdown for pie chart
  const byCat = new Map<string, { name: string; color: string; monthly: number }>()
  for (const item of active) {
    const key = item.categoryName
    if (!byCat.has(key)) byCat.set(key, { name: key, color: item.categoryColor, monthly: 0 })
    byCat.get(key)!.monthly += item.monthlyEquiv
  }
  const pieData = Array.from(byCat.values())
    .sort((a, b) => b.monthly - a.monthly)

  const { sorted, sortKey, sortDir, toggle } = useSortable(active, "monthlyEquiv", "desc")

  const hasData = active.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">True Cost of Subscriptions</h1>
        <PageHelp title="Subscriptions">
          <p>All your active recurring payments in one place — subscriptions, bills, memberships, and any other regular outgoing.</p>
          <p><strong className="text-foreground">Monthly equivalent</strong> — all frequencies normalised to monthly cost so you can compare them directly.</p>
          <p><strong className="text-foreground">Annual cost</strong> — total monthly cost × 12. Useful for understanding the true yearly commitment.</p>
          <p>These are automatically detected from your transaction history. Detection requires at least 3 occurrences from the same payee at a consistent interval.</p>
        </PageHelp>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Monthly Total"
          value={formatCurrency(totalMonthly, currency)}
          icon={<TrendingDown className="h-4 w-4 text-negative" />}
          sub="active recurring"
          accent="negative"
          className="animate-in stagger-1"
        />
        <StatCard
          label="Annual Total"
          value={formatCurrency(totalAnnual, currency)}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          sub="per year"
          accent="neutral"
          className="animate-in stagger-2"
        />
        <StatCard
          label="Active"
          value={active.length.toString()}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          sub="recurring payees"
          accent="neutral"
          className="animate-in stagger-3"
        />
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <CreditCard className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No recurring payments detected</p>
            <p className="text-sm text-muted-foreground">Sync more transaction history to detect subscriptions.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 animate-in stagger-4">
            <div className="space-y-2">
              <p className="section-label px-0.5">By Category</p>
              <Card>
                <CardContent className="pt-5">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="monthly"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value, currency) + "/mo", ""]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <p className="section-label px-0.5">Biggest Commitments</p>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-y-auto max-h-[280px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b">
                        <tr>
                          <th className="pl-5 py-3 text-left font-medium text-muted-foreground">Payee</th>
                          <th className="py-3 text-right font-medium text-muted-foreground">Monthly</th>
                          <th className="pr-5 py-3 text-right font-medium text-muted-foreground">Annual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.slice(0, 10).map((item) => (
                          <tr key={item.payee} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="pl-5 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: item.categoryColor }}
                                />
                                <span className="font-medium truncate max-w-[140px]">{item.payee}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-negative">
                              {formatCurrency(item.monthlyEquiv, currency)}
                            </td>
                            <td className="pr-5 py-2.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(item.annualCost, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-2 animate-in stagger-5">
            <p className="section-label px-0.5">All Active Recurring</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHead id="payee" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="pl-5 min-w-[160px]">Payee</SortableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <SortableHead id="frequency" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Frequency</SortableHead>
                        <SortableHead id="avgAmount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden md:table-cell">Avg Charge</SortableHead>
                        <SortableHead id="monthlyEquiv" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Monthly</SortableHead>
                        <SortableHead id="annualCost" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden lg:table-cell">Annual</SortableHead>
                        <SortableHead id="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden sm:table-cell pr-5">Last Seen</SortableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((item) => (
                        <TableRow key={item.payee} className="hover:bg-muted/30">
                          <TableCell className="pl-5 font-medium truncate max-w-[180px]">{item.payee}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
                              <span className="text-xs text-muted-foreground">{item.categoryName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.frequency}</TableCell>
                          <TableCell className="text-right tabular-nums hidden md:table-cell">
                            {formatCurrency(item.avgAmount, currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-negative">
                            {formatCurrency(item.monthlyEquiv, currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                            {formatCurrency(item.annualCost, currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground text-xs hidden sm:table-cell pr-5">
                            {formatDate(item.lastSeen)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
