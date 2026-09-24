import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Check, EyeOff, Plus, Repeat, Undo2 } from "lucide-react"
import { getRecurringTransactions, type RecurringItem } from "@/server/fn/insights"
import { ignoreRecurringPayee, unignoreRecurringPayee } from "@/server/fn/recurring-ignores"
import { getRecurringCommitments, saveRecurringCommitment } from "@/server/fn/recurring-commitments"
import { getCategories } from "@/server/fn/categories"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const Route = createFileRoute("/recurring")({
  component: RecurringPage,
  loader: () => withOfflineCache("recurring", async () => {
    const [recurring, currency, commitments, categories] = await Promise.all([
      getRecurringTransactions({ data: { includeIgnored: true } }).catch(() => []),
      getSetting({ data: "preferred_currency" }).catch(() => "EUR"),
      getRecurringCommitments().catch(() => []),
      getCategories().catch(() => []),
    ])
    return { recurring, currency: currency ?? "EUR", commitments, categories }
  }),
})

type FreqFilter = "all" | "monthly" | "weekly" | "other"

function RecurringPage() {
  const { recurring: detected, currency, commitments, categories } = Route.useLoaderData()
  const router = useRouter()
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all")
  const [showInactive, setShowInactive] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const cadenceLabel = { daily: "Daily", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" } as const
  const interval = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 91, annual: 365 } as const
  const factor = { daily: 30.44, weekly: 4.345, fortnightly: 2.1725, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 } as const
  const detectedPayees = new Set(detected.map((item) => item.payee))
  const manualItems: RecurringItem[] = commitments.filter((item) => item.source === "manual" && !detectedPayees.has(item.payee)).map((item) => ({
    payee: item.payee, frequency: cadenceLabel[item.cadence] as RecurringItem["frequency"], monthlyEquiv: item.amount * factor[item.cadence], annualCost: item.amount * factor[item.cadence] * 12,
    avgAmount: item.amount, medianInterval: interval[item.cadence], lastSeen: item.createdAt.toISOString().slice(0, 10), nextExpected: item.nextExpected, daysSinceLastSeen: 0, isActive: true, isIgnored: false,
    transactionCount: 0, categoryId: item.categoryId ?? null, amountRange: { min: item.amount, max: item.amount }, categoryName: categories.find((category) => category.id === item.categoryId)?.name ?? "Uncategorised", categoryColor: categories.find((category) => category.id === item.categoryId)?.color ?? "#94a3b8",
  }))
  const data = [...detected, ...manualItems]
  const confirmedPayees = new Set(commitments.map((item) => item.payee))

  const ignored = data.filter((item) => item.isIgnored)
  const active = data.filter((item) => !item.isIgnored && item.isActive)
  const inactive = data.filter((item) => !item.isIgnored && !item.isActive)
  const unconfirmed = active.filter((item) => !confirmedPayees.has(item.payee))
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

  async function confirm(item: RecurringItem) {
    const cadence = item.frequency === "Daily" ? "daily" : item.frequency === "Weekly" ? "weekly" : item.frequency === "Fortnightly" ? "fortnightly" : item.frequency === "Quarterly" ? "quarterly" : item.frequency === "Annual" ? "annual" : "monthly"
    await saveRecurringCommitment({ data: { payee: item.payee, categoryId: item.categoryId, amount: item.avgAmount, currency, cadence, nextExpected: item.nextExpected, source: "detected" } })
    router.invalidate()
  }

  return (
    <div className="console-page flex flex-col gap-3.5">
      <Card className="animate-in">
        <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          <CardDescription className="section-label">Committed before you spend</CardDescription>
          <CardTitle className="max-w-4xl text-pretty text-xl font-medium leading-[1.45] tracking-[-0.015em] sm:text-[25px]">
            <span className="font-mono font-semibold">{formatCurrency(totalMonthly, currency)}</span> is already committed each month across <span className="font-mono font-semibold">{active.length}</span> recurring payments. That&rsquo;s <span className="font-mono font-semibold">{formatCurrency(totalAnnual, currency)}</span> a year.
          </CardTitle>
          <CardAction className="col-start-1 row-span-1 row-start-auto justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
            <div className="flex flex-wrap gap-2"><Badge variant="secondary"><Repeat /> Active patterns</Badge><Button size="sm" variant="outline" onClick={() => setManualOpen(true)}><Plus /> Add manually</Button></div>
          </CardAction>
        </CardHeader>
      </Card>

      {unconfirmed[0] && <Alert>
        <AlertTitle>Is {unconfirmed[0].payee} a recurring commitment?</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{formatCurrency(unconfirmed[0].avgAmount, currency)} · {unconfirmed[0].frequency.toLowerCase()} · detected from {unconfirmed[0].transactionCount} payments</span>
          <span className="flex gap-2"><Button size="sm" onClick={() => confirm(unconfirmed[0])}><Check /> Confirm</Button><Button size="sm" variant="outline" onClick={() => handleIgnore(unconfirmed[0].payee)}>Not recurring</Button></span>
        </AlertDescription>
      </Alert>}

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
          <RecurringTable items={filtered} currency={currency} onIgnore={handleIgnore} confirmedPayees={confirmedPayees} />

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
      <ManualCommitmentDialog open={manualOpen} onOpenChange={setManualOpen} categories={categories} currency={currency} onSaved={() => router.invalidate()} />
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
  confirmedPayees,
}: {
  items: RecurringItem[]
  currency: string
  dimmed?: boolean
  onIgnore?: (payee: string) => void
  onUnignore?: (payee: string) => void
  confirmedPayees?: Set<string>
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
                  <TableCell><div className="flex items-center gap-2"><Badge variant="secondary">{item.frequency}</Badge>{confirmedPayees?.has(item.payee) && <Badge variant="outline">Confirmed</Badge>}</div></TableCell>
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

function ManualCommitmentDialog({ open, onOpenChange, categories, currency, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Awaited<ReturnType<typeof getCategories>>
  currency: string
  onSaved: () => void
}) {
  const [payee, setPayee] = useState("")
  const [amount, setAmount] = useState("")
  const [cadence, setCadence] = useState<"daily" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual">("monthly")
  const [nextExpected, setNextExpected] = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!payee.trim() || Number(amount) <= 0) return
    setSaving(true)
    try {
      await saveRecurringCommitment({ data: { payee: payee.trim(), amount: Number(amount), currency, cadence, nextExpected, categoryId: categoryId ? Number(categoryId) : null, source: "manual" } })
      onSaved(); onOpenChange(false); setPayee(""); setAmount("")
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Add recurring commitment</DialogTitle><DialogDescription>Add a commitment that cannot be detected from transaction history yet.</DialogDescription></DialogHeader>
    <FieldGroup>
      <Field><FieldLabel htmlFor="commitment-payee">Payee</FieldLabel><Input id="commitment-payee" value={payee} onChange={(event) => setPayee(event.target.value)} placeholder="Rent, insurance, membership…" /></Field>
      <div className="grid grid-cols-2 gap-3"><Field><FieldLabel htmlFor="commitment-amount">Amount ({currency})</FieldLabel><Input id="commitment-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field><FieldLabel>Cadence</FieldLabel><Select value={cadence} onValueChange={(value) => value && setCadence(value as typeof cadence)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["daily", "weekly", "fortnightly", "monthly", "quarterly", "annual"].map((value) => <SelectItem key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectGroup></SelectContent></Select></Field></div>
      <Field><FieldLabel htmlFor="commitment-next">Next expected</FieldLabel><Input id="commitment-next" type="date" value={nextExpected} onChange={(event) => setNextExpected(event.target.value)} /></Field>
      <Field><FieldLabel>Category</FieldLabel><Select value={categoryId || "none"} onValueChange={(value) => setCategoryId(value === "none" ? "" : value ?? "")}><SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">Uncategorised</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
    </FieldGroup>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={saving || !payee.trim() || Number(amount) <= 0}>{saving ? "Saving…" : "Add commitment"}</Button></DialogFooter>
  </DialogContent></Dialog>
}
