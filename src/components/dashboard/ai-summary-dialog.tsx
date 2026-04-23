import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { generateNarrative } from "@/server/fn/insights"

type BudgetSummaryRow = {
  name: string
  budgeted: number
  spent: number
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export function AiSummaryDialog({
  stats,
  byCat,
  topMerchants,
  incomeVsExp,
  budgets,
  periodDelta,
  dateFrom,
  dateTo,
  presetLabel,
  accountLabel,
  excludeRecurring,
  currency = "EUR",
}: {
  stats: { totalIncome: number; totalExpenses: number; net: number; count?: number | string }
  byCat: { categoryName: string; total: number }[]
  topMerchants: { name: string; total: number; count: number | string }[]
  incomeVsExp: { month: string; income: number; expenses: number; net: number }[]
  budgets: BudgetSummaryRow[]
  periodDelta: { income: number | null; expenses: number | null } | null
  dateFrom?: string
  dateTo?: string
  presetLabel: string
  accountLabel: string
  excludeRecurring: boolean
  currency?: string
}) {
  const [open, setOpen] = useState(false)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const savingsRate = stats.totalIncome > 0 ? (stats.net / stats.totalIncome) * 100 : null
  const summaryKey = useMemo(
    () =>
      JSON.stringify({
        stats,
        byCat,
        topMerchants,
        incomeVsExp,
        budgets,
        periodDelta,
        dateFrom,
        dateTo,
        presetLabel,
        accountLabel,
        excludeRecurring,
        currency,
      }),
    [
      accountLabel,
      budgets,
      byCat,
      currency,
      dateFrom,
      dateTo,
      excludeRecurring,
      incomeVsExp,
      periodDelta,
      presetLabel,
      stats,
      topMerchants,
    ],
  )

  useEffect(() => {
    setNarrative(null)
    setError(null)
    setFromCache(false)
  }, [summaryKey])

  async function handleGenerate(force = false) {
    setLoading(true)
    setNarrative(null)
    setError(null)
    setFromCache(false)
    try {
      const result = await generateNarrative({
        data: {
          pageTitle: "Dashboard",
          filters: {
            dateFrom,
            dateTo,
            presetLabel,
            accountLabel,
            excludeRecurringFromMerchants: excludeRecurring,
          },
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          net: stats.net,
          transactionCount: toNumber(stats.count),
          savingsRate,
          topCategories: byCat.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total })),
          topMerchants: topMerchants.slice(0, 5).map((m) => ({
            name: m.name,
            total: m.total,
            count: toNumber(m.count) ?? 0,
          })),
          cashFlow: incomeVsExp.slice(-6).map((row) => ({
            month: row.month,
            income: row.income,
            expenses: row.expenses,
            net: row.net,
          })),
          budgets: budgets.slice(0, 5),
          periodDelta: periodDelta ?? null,
          currency,
          force,
        },
      })
      if (result.error) {
        setError(result.error)
      } else {
        setNarrative(result.narrative)
        setFromCache(result.cached ?? false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate the AI summary.")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && !narrative && !error && !loading) {
      void handleGenerate(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Sparkles data-icon="inline-start" />
        AI summary
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-md bg-primary/15 p-1 text-primary">
              <Sparkles />
            </span>
            AI summary
          </DialogTitle>
          <DialogDescription>
            Generated from the current dashboard data and active filters.
            {fromCache && <span className="ml-1">Cached result.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          {narrative ? (
            <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
          ) : error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Analysing this dashboard view..."
                : "Open the summary to generate an AI-written view of this dashboard."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleGenerate(Boolean(narrative))}
            disabled={loading}
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(loading && "animate-spin")}
            />
            {narrative ? "Regenerate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
