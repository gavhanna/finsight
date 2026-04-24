import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import {
  getBudgetVsActual,
  getBudgets,
  getExpenseCategoriesAndGroups,
  upsertBudget,
  deleteBudget,
  setMonthOverride,
  removeMonthOverride,
  type BudgetRow,
  type CategoryBudgetRow,
  type GroupBudgetRow,
  type UnbudgetedRow,
} from "../server/fn/budgets"
import { getSetting } from "../server/fn/settings"
import { withOfflineCache } from "@/lib/loader-cache"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { PageHelp } from "@/components/ui/page-help"

// ─── Route ────────────────────────────────────────────────────────────────────

const SearchSchema = z.object({
  month: z.string().optional(),
  tab: z.enum(["overview", "manage"]).optional(),
})

export const Route = createFileRoute("/budgets")({
  validateSearch: SearchSchema,
  component: () => <BudgetsPage />,
  loaderDeps: ({ search }) => ({
    month: search.month ?? new Date().toISOString().slice(0, 7),
    tab: search.tab ?? "overview",
  }),
  loader: async ({ deps }) =>
    withOfflineCache(`budgets:${deps.month}`, async () => {
      const [vsActual, allBudgets, catsAndGroups, currency] = await Promise.all([
        getBudgetVsActual({ data: { month: deps.month } }),
        getBudgets(),
        getExpenseCategoriesAndGroups(),
        getSetting({ data: "preferred_currency" }),
      ])
      return { vsActual, allBudgets, ...catsAndGroups, currency: currency ?? "GBP" }
    }),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number)
  return { year: y, month: m }
}

function formatYM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

function stepMonth(ym: string, delta: number): string {
  let { year, month } = parseYM(ym)
  month += delta
  if (month > 12) { month = 1; year++ }
  if (month < 1)  { month = 12; year-- }
  return formatYM(year, month)
}

function displayMonth(ym: string): string {
  const { year, month } = parseYM(ym)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

type ProgressColor = "green" | "amber" | "red"

function progressColor(ratio: number): ProgressColor {
  if (ratio > 1)     return "red"
  if (ratio >= 0.75) return "amber"
  return "green"
}

const BAR_TRACK = "h-0.5 rounded-full bg-muted overflow-hidden"
const BAR_FILL: Record<ProgressColor, string> = {
  green: "h-full rounded-full bg-positive transition-all duration-500",
  amber: "h-full rounded-full bg-amber-500 transition-all duration-500",
  red:   "h-full rounded-full bg-negative transition-all duration-500",
}
const BADGE_CLASSES: Record<ProgressColor, string> = {
  green: "bg-positive/10 text-positive border-positive/20",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  red:   "bg-negative/10 text-negative border-negative/20",
}

// ─── Budget progress bar row ─────────────────────────────────────────────────

function BudgetRow({
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
          : "\u00A0"}
      </p>
    </div>
  )
}

// ─── Income allocation bar ────────────────────────────────────────────────────

function IncomeAllocationBar({
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
  // Use actual income if we have it; fall back to 3-month average
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

        {/* Stacked bar */}
        {isOver ? (
          // Over income: bar rescales to total spend; income boundary shown as marker
          <div className="relative">
            <div className="relative h-2 rounded-full overflow-hidden bg-muted">
              {/* within-income portion */}
              <div
                className="absolute left-0 top-0 h-full bg-positive transition-all duration-500"
                style={{ width: `${(income / allSpent) * 100}%` }}
              />
              {/* over-income portion */}
              <div
                className="absolute top-0 h-full bg-negative transition-all duration-500"
                style={{ left: `${(income / allSpent) * 100}%`, right: 0 }}
              />
            </div>
            {/* income boundary marker */}
            <div
              className="absolute -top-1 -bottom-1 w-0.5 bg-white/50 rounded-full"
              style={{ left: `${(income / allSpent) * 100}%` }}
            />
          </div>
        ) : (
          // Normal: bar represents income (0–100%)
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            {/* spent portion */}
            <div
              className="absolute left-0 top-0 h-full bg-positive transition-all duration-500"
              style={{ width: `${spentPct}%` }}
            />
            {/* budgeted-but-unspent portion */}
            {budgetedPct > spentPct && (
              <div
                className="absolute top-0 h-full bg-primary/25 transition-all duration-500"
                style={{ left: `${spentPct}%`, width: `${budgetedPct - spentPct}%` }}
              />
            )}
          </div>
        )}

        {/* Legend */}
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

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  vsActual,
  currency,
  month,
}: {
  vsActual: {
    categoryBudgets: CategoryBudgetRow[]
    groupBudgets: GroupBudgetRow[]
    unbudgeted: UnbudgetedRow[]
    incomeActual: number
    incomeAvg3m: number
  }
  currency: string
  month: string
}) {
  const router = useRouter()
  const [overrideDialog, setOverrideDialog] = useState<{
    budgetId: number
    name: string
    current: number
  } | null>(null)
  const [overrideAmount, setOverrideAmount] = useState("")
  const [unbudgetedOpen, setUnbudgetedOpen] = useState(false)
  const [createBudgetDialog, setCreateBudgetDialog] = useState<{
    categoryId: number
    name: string
    suggested: number
  } | null>(null)
  const [createBudgetAmount, setCreateBudgetAmount] = useState("")
  const [createBudgetSaving, setCreateBudgetSaving] = useState(false)

  const { categoryBudgets, groupBudgets, unbudgeted, incomeActual, incomeAvg3m } = vsActual
  const allBudgeted = [
    ...categoryBudgets.map((b) => b.budgeted),
    ...groupBudgets.map((b) => b.budgeted),
  ].reduce((s, n) => s + n, 0)

  const allSpent = [
    ...categoryBudgets.map((b) => b.spent),
    ...groupBudgets.map((b) => b.spent),
  ].reduce((s, n) => s + n, 0)

  const onTrack = [
    ...categoryBudgets.filter((b) => b.spent <= b.budgeted),
    ...groupBudgets.filter((b) => b.spent <= b.budgeted),
  ].length

  const total = categoryBudgets.length + groupBudgets.length

  const hasBudgets = total > 0

  async function saveNewBudget() {
    if (!createBudgetDialog) return
    const amt = parseFloat(createBudgetAmount)
    if (isNaN(amt) || amt <= 0) return
    setCreateBudgetSaving(true)
    try {
      await upsertBudget({
        data: {
          categoryId: createBudgetDialog.categoryId,
          categoryGroupId: null,
          monthlyAmount: amt,
        },
      })
      setCreateBudgetDialog(null)
      setCreateBudgetAmount("")
      router.invalidate()
    } finally {
      setCreateBudgetSaving(false)
    }
  }

  async function saveOverride() {
    if (!overrideDialog) return
    const amount = parseFloat(overrideAmount)
    if (isNaN(amount) || amount <= 0) return
    await setMonthOverride({ data: { budgetId: overrideDialog.budgetId, month, amount } })
    setOverrideDialog(null)
    setOverrideAmount("")
    router.invalidate()
  }

  async function handleRemoveOverride(budgetId: number) {
    await removeMonthOverride({ data: { budgetId, month } })
    router.invalidate()
  }

  if (!hasBudgets) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Target className="size-10 text-muted-foreground/40" />
        <p className="font-medium text-muted-foreground">No budgets set yet</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Switch to the Manage tab to add your first budget.
        </p>
      </div>
    )
  }

  // Group category budgets by their group for display
  const grouped = categoryBudgets.reduce<Record<string, CategoryBudgetRow[]>>((acc, b) => {
    const key = b.groupName ?? "__none__"
    ;(acc[key] ??= []).push(b)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="section-label mb-0">Budgeted</p>
              <Target className="size-3.5 text-muted-foreground/50" />
            </div>
            <p className="metric-number text-base sm:text-lg">{formatCurrency(allBudgeted, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="section-label mb-0">Spent</p>
              <TrendingUp className={cn("size-3.5", allSpent > allBudgeted ? "text-negative/60" : "text-muted-foreground/50")} />
            </div>
            <p className={cn("metric-number text-base sm:text-lg", allSpent > allBudgeted ? "text-negative" : "")}>
              {formatCurrency(allSpent, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="section-label mb-0">Remaining</p>
              {allBudgeted - allSpent < 0
                ? <AlertTriangle className="size-3.5 text-negative/60" />
                : <CheckCircle2 className="size-3.5 text-muted-foreground/50" />}
            </div>
            <p className={cn("metric-number text-base sm:text-lg", allBudgeted - allSpent < 0 ? "text-negative" : "text-positive")}>
              {formatCurrency(Math.abs(allBudgeted - allSpent), currency)}
              {allSpent > allBudgeted && <span className="text-xs font-normal ml-1">over</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="section-label mb-0">On Track</p>
              {onTrack === total
                ? <CheckCircle2 className="size-3.5 text-positive/60" />
                : <AlertTriangle className="size-3.5 text-amber-500/60" />}
            </div>
            <div className="flex items-end gap-1.5 mt-0.5">
              <span className="metric-number text-base sm:text-lg">{onTrack}</span>
              <span className="text-muted-foreground text-sm mb-0.5">/ {total}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Income allocation */}
      {(incomeActual > 0 || incomeAvg3m > 0) && (
        <IncomeAllocationBar
          incomeActual={incomeActual}
          incomeAvg3m={incomeAvg3m}
          allBudgeted={allBudgeted}
          allSpent={allSpent}
          currency={currency}
        />
      )}

      {/* Category budgets — grouped by their category group */}
      {categoryBudgets.length > 0 && (
        <Card>
          <CardHeader className="px-5 py-3 pb-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Category Budgets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {Object.entries(grouped).map(([groupKey, rows], gi) => (
              <div key={groupKey}>
                {groupKey !== "__none__" && (
                  <div className="flex items-center justify-between mt-4 mb-1 pb-1 border-b border-border/50">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {groupKey}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {formatCurrency(rows.reduce((s, b) => s + b.spent, 0), currency)}
                      {" / "}
                      {formatCurrency(rows.reduce((s, b) => s + b.budgeted, 0), currency)}
                    </p>
                  </div>
                )}
                <div className="divide-y">
                  {rows.map((b) => (
                    <BudgetRow
                      key={b.budgetId}
                      name={b.categoryName}
                      color={b.categoryColor}
                      budgeted={b.budgeted}
                      spent={b.spent}
                      currency={currency}
                      isOverride={b.budgeted !== b.monthlyAmount}
                      onOverride={() => {
                        setOverrideDialog({ budgetId: b.budgetId, name: b.categoryName, current: b.budgeted })
                        setOverrideAmount(String(b.budgeted))
                      }}
                      onRemoveOverride={() => handleRemoveOverride(b.budgetId)}
                    />
                  ))}
                </div>
                {gi < Object.keys(grouped).length - 1 && <Separator className="mt-2" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Group budgets */}
      {groupBudgets.length > 0 && (
        <Card>
          <CardHeader className="px-5 py-3 pb-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Group Budgets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="divide-y">
              {groupBudgets.map((b) => (
                <BudgetRow
                  key={b.budgetId}
                  name={b.groupName}
                  color={b.groupColor}
                  budgeted={b.budgeted}
                  spent={b.spent}
                  currency={currency}
                  isOverride={b.budgeted !== b.monthlyAmount}
                  onOverride={() => {
                    setOverrideDialog({ budgetId: b.budgetId, name: b.groupName, current: b.budgeted })
                    setOverrideAmount(String(b.budgeted))
                  }}
                  onRemoveOverride={() => handleRemoveOverride(b.budgetId)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unbudgeted spending */}
      {unbudgeted.length > 0 && (
        <div>
          <button
            onClick={() => setUnbudgetedOpen((o) => !o)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left mb-2"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-200", !unbudgetedOpen && "-rotate-90")} />
            Unbudgeted spending
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {formatCurrency(unbudgeted.reduce((s, r) => s + r.spent, 0), currency)}
            </Badge>
          </button>

          <div
            className="grid transition-[grid-template-rows] duration-200 ease-in-out"
            style={{ gridTemplateRows: unbudgetedOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <Card>
                <CardContent className="px-5 py-0">
                  <div className="divide-y">
                    {unbudgeted.map((u) => (
                      <div key={u.categoryId} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: u.categoryColor }} />
                          <span className="text-sm truncate">{u.categoryName}</span>
                          {u.groupName && (
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:block">
                              · {u.groupName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-sm">
                          <span className="tabular-nums text-negative">{formatCurrency(u.spent, currency)}</span>
                          <span className="text-muted-foreground text-xs">{u.txCount} txn{u.txCount !== 1 ? "s" : ""}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => {
                              setCreateBudgetDialog({ categoryId: u.categoryId, name: u.categoryName, suggested: u.spent })
                              setCreateBudgetAmount(String(Math.ceil(u.spent)))
                            }}
                          >
                            <Plus className="size-3" />
                            Budget
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Create budget dialog (from unbudgeted row) */}
      <Dialog open={createBudgetDialog !== null} onOpenChange={(o) => { if (!o) { setCreateBudgetDialog(null); setCreateBudgetAmount("") } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Create budget</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a monthly budget for <strong className="text-foreground">{createBudgetDialog?.name}</strong>.
            We've pre-filled this month's spend as a starting point.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="create-budget-amount">Monthly amount</Label>
            <Input
              id="create-budget-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={createBudgetAmount}
              onChange={(e) => setCreateBudgetAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveNewBudget() }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateBudgetDialog(null); setCreateBudgetAmount("") }}>
              Cancel
            </Button>
            <Button onClick={saveNewBudget} disabled={!createBudgetAmount || Number(createBudgetAmount) <= 0 || createBudgetSaving}>
              {createBudgetSaving ? "Saving…" : "Create budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Month override dialog */}
      <Dialog open={overrideDialog !== null} onOpenChange={(o) => { if (!o) { setOverrideDialog(null); setOverrideAmount("") } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Override budget for {displayMonth(month)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a one-off amount for <strong className="text-foreground">{overrideDialog?.name}</strong> this month only.
            The standing monthly budget remains unchanged.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="override-amount">Amount</Label>
            <Input
              id="override-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={overrideAmount}
              onChange={(e) => setOverrideAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveOverride() }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideDialog(null); setOverrideAmount("") }}>
              Cancel
            </Button>
            <Button onClick={saveOverride} disabled={!overrideAmount || Number(overrideAmount) <= 0}>
              Save override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Manage tab ───────────────────────────────────────────────────────────────

type BudgetDialogState =
  | { mode: "add" }
  | { mode: "edit"; budget: BudgetRow }

function ManageTab({
  allBudgets,
  categories,
  groups,
  currency,
}: {
  allBudgets: BudgetRow[]
  categories: { id: number; name: string; color: string; groupId: number | null }[]
  groups: { id: number; name: string; color: string }[]
  currency: string
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<BudgetDialogState | null>(null)
  const [targetType, setTargetType] = useState<"category" | "group">("category")
  const [selectedId, setSelectedId] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // IDs already budgeted
  const budgetedCategoryIds = new Set(allBudgets.map((b) => b.categoryId).filter(Boolean) as number[])
  const budgetedGroupIds    = new Set(allBudgets.map((b) => b.categoryGroupId).filter(Boolean) as number[])

  // Groups that cover their categories via a group budget — used to warn users
  const groupCoveredCatIds = new Set(
    groups
      .filter((g) => budgetedGroupIds.has(g.id))
      .flatMap((g) => categories.filter((c) => c.groupId === g.id).map((c) => c.id)),
  )

  function openAdd() {
    setTargetType("category")
    setSelectedId("")
    setAmount("")
    setNote("")
    setDialog({ mode: "add" })
  }

  function openEdit(b: BudgetRow) {
    setTargetType(b.categoryId ? "category" : "group")
    setSelectedId(String(b.categoryId ?? b.categoryGroupId ?? ""))
    setAmount(String(b.monthlyAmount))
    setNote(b.note ?? "")
    setDialog({ mode: "edit", budget: b })
  }

  function closeDialog() {
    setDialog(null)
    setSelectedId("")
    setAmount("")
    setNote("")
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0 || !selectedId) return
    setSaving(true)
    try {
      await upsertBudget({
        data: {
          id:              dialog?.mode === "edit" ? dialog.budget.id : undefined,
          categoryId:      targetType === "category" ? Number(selectedId) : null,
          categoryGroupId: targetType === "group"    ? Number(selectedId) : null,
          monthlyAmount:   amt,
          note:            note.trim() || undefined,
        },
      })
      closeDialog()
      router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (confirmDeleteId === null) return
    setDeleting(true)
    await deleteBudget({ data: { id: confirmDeleteId } })
    setDeleting(false)
    setConfirmDeleteId(null)
    router.invalidate()
  }

  const availableCategories = categories.filter((c) => {
    if (dialog?.mode === "edit" && (dialog.budget.categoryId === c.id)) return true
    return !budgetedCategoryIds.has(c.id) && !groupCoveredCatIds.has(c.id)
  })
  const availableGroups = groups.filter((g) => {
    if (dialog?.mode === "edit" && dialog.budget.categoryGroupId === g.id) return true
    return !budgetedGroupIds.has(g.id)
  })

  const canSave = selectedId && parseFloat(amount) > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allBudgets.length === 0
            ? "No budgets yet — add one to start tracking."
            : `${allBudgets.length} standing budget${allBudgets.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="size-3.5" />
          Add budget
        </Button>
      </div>

      {allBudgets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {allBudgets.map((b) => {
                const isCategory = b.categoryId !== null
                const name  = isCategory ? b.categoryName  : b.groupName
                const color = isCategory ? b.categoryColor : b.groupColor

                return (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 group">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? "#888" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5 shrink-0">
                          {isCategory ? "category" : "group"}
                        </span>
                      </div>
                      {b.note && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{b.note}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {formatCurrency(b.monthlyAmount, currency)}/mo
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(b)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-negative"
                        onClick={() => setConfirmDeleteId(b.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => { if (!o && !deleting) setConfirmDeleteId(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete budget?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This budget will be permanently removed. Transactions are not affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit budget" : "Add budget"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Target type toggle — only shown for new budgets */}
            {dialog?.mode === "add" && (
              <div className="space-y-1.5">
                <Label>Budget type</Label>
                <div className="flex rounded-md overflow-hidden border">
                  {(["category", "group"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTargetType(t); setSelectedId("") }}
                      className={cn(
                        "flex-1 py-1.5 text-sm transition-colors capitalize",
                        targetType === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target selector */}
            <div className="space-y-1.5">
              <Label>{targetType === "category" ? "Category" : "Group"}</Label>
              <Select value={selectedId} onValueChange={(v) => v !== null && setSelectedId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a ${targetType}…`}>
                      {(() => {
                        const item = targetType === "category"
                          ? availableCategories.find((c) => String(c.id) === selectedId)
                          : availableGroups.find((g) => String(g.id) === selectedId)
                        return item
                          ? <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />{item.name}</span>
                          : undefined
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {targetType === "category"
                      ? availableCategories.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={String(c.id)}
                            startIcon={<span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />}
                          >
                            {c.name}
                          </SelectItem>
                        ))
                      : availableGroups.map((g) => (
                          <SelectItem
                            key={g.id}
                            value={String(g.id)}
                            startIcon={<span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />}
                          >
                            {g.name}
                          </SelectItem>
                        ))}
                    {(targetType === "category" ? availableCategories : availableGroups).length === 0 && (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        All {targetType === "category" ? "categories" : "groups"} already have budgets.
                      </div>
                    )}
                  </SelectContent>
                </Select>
            </div>

            {/* Monthly amount */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-amount">Monthly amount</Label>
              <Input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="budget-note"
                placeholder="e.g. includes takeaways"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSave) handleSave() }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "Saving…" : dialog?.mode === "edit" ? "Save changes" : "Add budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { vsActual, allBudgets, categories, groups, currency } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const today = new Date().toISOString().slice(0, 7)
  const month = search.month ?? today
  const tab   = search.tab   ?? "overview"

  const isCurrentMonth = month === today
  function setMonth(m: string) {
    navigate({ search: (s) => ({ ...s, month: m === today ? undefined : m }) })
  }

  function setTab(t: "overview" | "manage") {
    navigate({ search: (s) => ({ ...s, tab: t === "overview" ? undefined : t }) })
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Budgets</h1>
          <PageHelp title="Budgets">
            <p>Track your monthly spending against targets you set per category or group.</p>
            <p><strong className="text-foreground">Progress bars</strong> turn amber at 75% and red when you exceed the budget.</p>
            <p><strong className="text-foreground">Overrides</strong> let you set a one-off amount for a specific month without changing your standing budget.</p>
            <p><strong className="text-foreground">Unbudgeted spending</strong> shows what you&apos;re spending on categories that have no budget set.</p>
          </PageHelp>
        </div>

        {/* Month nav + tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab toggle */}
          <div className="flex rounded-md overflow-hidden border">
            {(["overview", "manage"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 text-sm transition-colors capitalize",
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Month navigator — only relevant in overview */}
          {tab === "overview" && (
            <div className="flex items-center gap-1">
              {!isCurrentMonth && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMonth(today)}>
                  <TrendingUp className="size-3.5" />
                  This month
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setMonth(stepMonth(month, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[110px] text-center">{displayMonth(month)}</span>
              <Button variant="outline" size="icon" onClick={() => setMonth(stepMonth(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" ? (
        <OverviewTab vsActual={vsActual} currency={currency} month={month} />
      ) : (
        <ManageTab allBudgets={allBudgets} categories={categories} groups={groups} currency={currency} />
      )}
    </div>
  )
}
