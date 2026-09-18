import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { formatCurrency, formatYearMonthLong, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, Plus, Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
  upsertBudget,
  setMonthOverride,
  removeMonthOverride,
  type CategoryBudgetRow,
  type GroupBudgetRow,
  type UnbudgetedRow,
} from "@/server/fn/budgets"
import { BudgetRow } from "./budget-row"
import { IncomeAllocationBar } from "./income-allocation-bar"

export function OverviewTab({
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

  const grouped = categoryBudgets.reduce<Record<string, CategoryBudgetRow[]>>((acc, b) => {
    const key = b.groupName ?? "__none__"
    ;(acc[key] ??= []).push(b)
    return acc
  }, {})

  return (
    <div className="space-y-5">
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

      {(incomeActual > 0 || incomeAvg3m > 0) && (
        <IncomeAllocationBar
          incomeActual={incomeActual}
          incomeAvg3m={incomeAvg3m}
          allBudgeted={allBudgeted}
          allSpent={allSpent}
          currency={currency}
        />
      )}

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

      <Dialog open={createBudgetDialog !== null} onOpenChange={(o) => { if (!o) { setCreateBudgetDialog(null); setCreateBudgetAmount("") } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Create budget</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a monthly budget for <strong className="text-foreground">{createBudgetDialog?.name}</strong>.
            We&apos;ve pre-filled this month&apos;s spend as a starting point.
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

      <Dialog open={overrideDialog !== null} onOpenChange={(o) => { if (!o) { setOverrideDialog(null); setOverrideAmount("") } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Override budget for {formatYearMonthLong(month)}</DialogTitle>
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
