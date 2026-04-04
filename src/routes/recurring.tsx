import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getRecurringTransactions, type RecurringItem } from "../server/fn/insights"
import { getSetting } from "../server/fn/settings"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Repeat, CalendarClock, TrendingDown } from "lucide-react"
import { PageHelp } from "@/components/ui/page-help"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
  loader: async () => {
    const [recurring, currency] = await Promise.all([
      getRecurringTransactions(),
      getSetting({ data: "preferred_currency" }),
    ])
    return { recurring, currency: currency ?? "EUR" }
  },
})

type FreqFilter = "all" | "monthly" | "weekly" | "other"

function RecurringPage() {
  const { recurring: data, currency } = Route.useLoaderData()
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all")
  const [showInactive, setShowInactive] = useState(false)

  const active = data.filter((d) => d.isActive)
  const inactive = data.filter((d) => !d.isActive)

  const totalMonthly = active.reduce((s, d) => s + d.monthlyEquiv, 0)
  const totalAnnual = active.reduce((s, d) => s + d.annualCost, 0)

  const byCat = new Map<string, { name: string; color: string; monthly: number }>()
  for (const item of active) {
    const key = item.categoryName
    if (!byCat.has(key)) byCat.set(key, { name: key, color: item.categoryColor, monthly: 0 })
    byCat.get(key)!.monthly += item.monthlyEquiv
  }
  const pieData = Array.from(byCat.values()).sort((a, b) => b.monthly - a.monthly)

  const filtered = active.filter((item) => {
    if (freqFilter === "all") return true
    if (freqFilter === "monthly") return item.frequency === "Monthly"
    if (freqFilter === "weekly") return item.frequency === "Weekly" || item.frequency === "Fortnightly"
    return !["Monthly", "Weekly", "Fortnightly"].includes(item.frequency)
  })

  const hasData = data.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Recurring</h1>
        <PageHelp title="Recurring Transactions">
          <p>This page detects payees that charge you on a regular cadence — subscriptions, bills, rent, etc.</p>
          <p><strong className="text-foreground">How it works</strong> — transactions from the same payee are grouped and analysed for a consistent interval (weekly, fortnightly, monthly, etc.).</p>
          <p><strong className="text-foreground">Active vs inactive</strong> — a payee is considered active if a charge has occurred within the last two expected cycles. Older patterns are shown as inactive.</p>
          <p><strong className="text-foreground">Monthly equivalent</strong> — all frequencies are normalised to a monthly cost so you can compare them easily.</p>
        </PageHelp>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="accent-negative">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Monthly Cost</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <TrendingDown className="h-4 w-4 text-negative" />
              </div>
            </div>
            <p className="metric-number">{formatCurrency(totalMonthly, currency)}</p>
            <p className="text-xs text-muted-foreground">active recurring</p>
          </CardContent>
        </Card>
        <Card className="accent-neutral">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Annual Cost</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="metric-number">{formatCurrency(totalAnnual, currency)}</p>
            <p className="text-xs text-muted-foreground">per year</p>
          </CardContent>
        </Card>
        <Card className="accent-neutral col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Active</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="metric-number">{active.length}</p>
            <p className="text-xs text-muted-foreground">recurring payees</p>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <Repeat className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No recurring transactions detected</p>
            <p className="text-sm text-muted-foreground">Sync more transaction history to detect patterns.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Category breakdown */}
          {pieData.length > 1 && (
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
                        formatter={(value: unknown) => [formatCurrency(value as number, currency) + "/mo", ""]}
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
          )}

          {/* Frequency filter */}
          <div className="overflow-x-auto">
            <Tabs value={freqFilter} onValueChange={(v) => v && setFreqFilter(v as FreqFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Active recurring table */}
          <RecurringTable items={filtered} currency={currency} />

          {/* Possibly cancelled (collapsed) */}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <span>{showInactive ? "▾" : "▸"}</span>
                Possibly cancelled ({inactive.length})
              </button>
              {showInactive && <RecurringTable items={inactive} currency={currency} dimmed />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecurringTable({ items, currency, dimmed }: { items: RecurringItem[]; currency: string; dimmed?: boolean }) {
  const { sorted, sortKey, sortDir, toggle } = useSortable(items, "monthlyEquiv", "desc")
  const today = new Date()

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead id="payee" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="pl-5 min-w-[160px]">Payee</SortableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <SortableHead id="frequency" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Frequency</SortableHead>
                <SortableHead id="avgAmount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden md:table-cell">Avg Amount</SortableHead>
                <SortableHead id="monthlyEquiv" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Monthly</SortableHead>
                <SortableHead id="annualCost" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden lg:table-cell">Annual</SortableHead>
                <SortableHead id="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden sm:table-cell">Last Seen</SortableHead>
                <TableHead className="text-right pr-5 hidden md:table-cell">Next Expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const isVariable = item.amountRange.max > item.amountRange.min * 1.25
                const nextDate = new Date(item.nextExpected)
                const daysUntilNext = Math.floor((nextDate.getTime() - today.getTime()) / 86_400_000)
                const nextDue = daysUntilNext <= 0
                const nextSoon = daysUntilNext > 0 && daysUntilNext <= 3

                return (
                  <TableRow key={item.payee} className={cn("hover:bg-muted/30", dimmed && "opacity-50")}>
                    <TableCell className="pl-5 font-medium truncate max-w-[200px]">{item.payee}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{item.categoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{item.frequency}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {formatCurrency(item.avgAmount, currency)}
                      {isVariable && <span className="text-xs text-muted-foreground ml-1">(variable)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(item.monthlyEquiv, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                      {formatCurrency(item.annualCost, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-xs hidden sm:table-cell">
                      {formatDate(item.lastSeen)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right tabular-nums text-xs pr-5 hidden md:table-cell",
                      nextDue && "text-amber-500 font-medium",
                      nextSoon && "text-amber-400",
                    )}>
                      {formatDate(item.nextExpected)}
                      {nextDue && <span className="ml-1 text-amber-500">overdue</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
