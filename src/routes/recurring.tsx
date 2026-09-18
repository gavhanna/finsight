import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { EyeOff, Repeat, Undo2 } from "lucide-react"
import { getRecurringTransactions, type RecurringItem } from "@/server/fn/insights"
import { ignoreRecurringPayee, unignoreRecurringPayee } from "@/server/fn/recurring-ignores"
import { getSetting } from "@/server/fn/settings"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { withOfflineCache } from "@/lib/loader-cache"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
  loader: () => withOfflineCache("recurring", async () => {
    const [recurring, currency] = await Promise.all([
      getRecurringTransactions({ data: { includeIgnored: true } }).catch(() => []),
      getSetting({ data: "preferred_currency" }).catch(() => "EUR"),
    ])
    return { recurring, currency: currency ?? "EUR" }
  }),
})

type FreqFilter = "all" | "monthly" | "weekly" | "other"

function RecurringPage() {
  const { recurring: data, currency } = Route.useLoaderData()
  const router = useRouter()
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)

  const ignored = data.filter((item) => item.isIgnored)
  const active = data.filter((item) => !item.isIgnored && item.isActive)
  const inactive = data.filter((item) => !item.isIgnored && !item.isActive)
  const totalMonthly = active.reduce((sum, item) => sum + item.monthlyEquiv, 0)
  const totalAnnual = active.reduce((sum, item) => sum + item.annualCost, 0)

  const filtered = active.filter((item) => {
    if (freqFilter === "all") return true
    if (freqFilter === "monthly") return item.frequency === "Monthly"
    if (freqFilter === "weekly") return item.frequency === "Weekly" || item.frequency === "Fortnightly"
    return !["Monthly", "Weekly", "Fortnightly"].includes(item.frequency)
  })

  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setDate(nextMonth.getDate() + 30)
  const upcoming = [...active]
    .filter((item) => {
      const next = new Date(item.nextExpected)
      return next >= today && next <= nextMonth
    })
    .sort((a, b) => a.nextExpected.localeCompare(b.nextExpected))

  async function handleIgnore(payee: string) {
    await ignoreRecurringPayee({ data: { payee } })
    router.invalidate()
  }

  async function handleUnignore(payee: string) {
    await unignoreRecurringPayee({ data: { payee } })
    router.invalidate()
  }

  return (
    <div className="console-page flex flex-col gap-3.5">
      <Card className="animate-in">
        <CardHeader>
          <CardDescription className="section-label">Committed before you spend</CardDescription>
          <CardTitle className="max-w-4xl text-pretty text-xl font-medium leading-[1.45] tracking-[-0.015em] sm:text-[25px]">
            <span className="font-mono font-semibold">{formatCurrency(totalMonthly, currency)}</span> is already committed each month across <span className="font-mono font-semibold">{active.length}</span> recurring payments. That&rsquo;s <span className="font-mono font-semibold">{formatCurrency(totalAnnual, currency)}</span> a year.
          </CardTitle>
          <CardAction>
            <Badge variant="secondary"><Repeat /> Active patterns</Badge>
          </CardAction>
        </CardHeader>
      </Card>

      {upcoming.length > 0 && (
        <Card className="animate-in stagger-1">
          <CardHeader>
            <CardTitle className="section-label">Next 30 days</CardTitle>
            <CardDescription>{upcoming.length} expected charge{upcoming.length === 1 ? "" : "s"}</CardDescription>
            <CardAction className="font-mono text-sm font-semibold">
              {formatCurrency(upcoming.reduce((sum, item) => sum + item.avgAmount, 0), currency)}
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.slice(0, 8).map((item) => (
                <div key={item.payee} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-md bg-muted font-mono text-[10px] leading-tight">
                    <span>{new Date(item.nextExpected).toLocaleDateString("en", { month: "short" }).toUpperCase()}</span>
                    <span className="text-sm font-semibold text-foreground">{new Date(item.nextExpected).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.payee}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatCurrency(item.avgAmount, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="section-label">Recurring list</span>
        <div className="max-w-full overflow-x-auto">
          <Tabs value={freqFilter} onValueChange={(value) => value && setFreqFilter(value as FreqFilter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="ml-auto font-mono text-xs text-muted-foreground">{filtered.length} shown</p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No recurring transactions detected</CardTitle>
            <CardDescription>Sync more transaction history to detect patterns.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <RecurringTable items={filtered} currency={currency} onIgnore={handleIgnore} />

          {inactive.length > 0 && (
            <section className="flex flex-col gap-2">
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setShowInactive((value) => !value)}>
                {showInactive ? "Hide" : "Show"} possibly cancelled ({inactive.length})
              </Button>
              {showInactive && <RecurringTable items={inactive} currency={currency} dimmed onIgnore={handleIgnore} />}
            </section>
          )}

          {ignored.length > 0 && (
            <section className="flex flex-col gap-2">
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setShowIgnored((value) => !value)}>
                {showIgnored ? "Hide" : "Show"} not recurring ({ignored.length})
              </Button>
              {showIgnored && <RecurringTable items={ignored} currency={currency} dimmed onUnignore={handleUnignore} />}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function confidenceFor(item: RecurringItem) {
  const spread = item.avgAmount > 0 ? (item.amountRange.max - item.amountRange.min) / item.avgAmount : 1
  if (item.transactionCount >= 8 && spread < 0.15) return "High"
  if (item.transactionCount >= 4 && spread < 0.4) return "Medium"
  return "Low"
}

function RecurringTable({
  items,
  currency,
  dimmed,
  onIgnore,
  onUnignore,
}: {
  items: RecurringItem[]
  currency: string
  dimmed?: boolean
  onIgnore?: (payee: string) => void
  onUnignore?: (payee: string) => void
}) {
  const { sorted, sortKey, sortDir, toggle } = useSortable(items, "monthlyEquiv", "desc")
  const today = new Date()

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="section-label">Detected patterns</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <SortableHead id="payee" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="min-w-[180px] pl-5">Payee</SortableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <SortableHead id="frequency" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Cadence</SortableHead>
              <TableHead className="hidden text-center md:table-cell">Confidence</TableHead>
              <SortableHead id="monthlyEquiv" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Monthly</SortableHead>
              <SortableHead id="annualCost" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="hidden text-right lg:table-cell">Annual</SortableHead>
              <TableHead className="hidden pr-5 text-right md:table-cell">Next expected</TableHead>
              {(onIgnore || onUnignore) && <TableHead className="w-10 pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => {
              const nextDate = new Date(item.nextExpected)
              const daysUntilNext = Math.floor((nextDate.getTime() - today.getTime()) / 86_400_000)
              const nextDue = daysUntilNext <= 0
              const nextSoon = daysUntilNext > 0 && daysUntilNext <= 3
              const confidence = confidenceFor(item)

              return (
                <TableRow key={item.payee} className={cn("hover:bg-muted/30", dimmed && "opacity-50")}>
                  <TableCell className="max-w-[220px] truncate pl-5 font-medium">{item.payee}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                      <span className="max-w-[110px] truncate">{item.categoryName}</span>
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{item.frequency}</Badge></TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    <span className={cn("text-xs", confidence === "High" ? "text-positive" : confidence === "Medium" ? "text-warning" : "text-muted-foreground")}>{confidence}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatCurrency(item.monthlyEquiv, currency)}</TableCell>
                  <TableCell className="hidden text-right font-mono text-muted-foreground lg:table-cell">{formatCurrency(item.annualCost, currency)}</TableCell>
                  <TableCell className={cn("hidden pr-5 text-right font-mono text-xs text-muted-foreground md:table-cell", nextDue && "font-medium text-warning", nextSoon && "text-warning")}>
                    {formatDate(item.nextExpected)}{nextDue && <span className="ml-1">overdue</span>}
                  </TableCell>
                  {(onIgnore || onUnignore) && (
                    <TableCell className="pr-4">
                      {onIgnore && (
                        <Button variant="ghost" size="icon-xs" aria-label={`Ignore ${item.payee}`} onClick={() => onIgnore(item.payee)}>
                          <EyeOff />
                        </Button>
                      )}
                      {onUnignore && (
                        <Button variant="ghost" size="icon-xs" aria-label={`Restore ${item.payee}`} onClick={() => onUnignore(item.payee)}>
                          <Undo2 />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
