import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { generateNarrative } from "@/server/fn/insights"

export type AiSummarySection = {
  title: string
  lines: string[]
}

type AiSummaryRequest = {
  pageTitle: string
  filters?: {
    dateFrom?: string
    dateTo?: string
    presetLabel?: string
    accountLabel?: string
    excludeRecurringFromMerchants?: boolean
  }
  totalIncome?: number
  totalExpenses?: number
  net?: number
  transactionCount?: number | string | null
  savingsRate?: number | null
  topCategories?: { name: string; total: number }[]
  topMerchants?: { name: string; total: number; count: number | string }[]
  cashFlow?: { month: string; income: number; expenses: number; net: number }[]
  budgets?: { name: string; budgeted: number; spent: number }[]
  periodDelta?: { income: number | null; expenses: number | null } | null
  currency?: string
  contextSections?: AiSummarySection[]
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export function PageAiSummaryDialog({
  request,
  label = "AI summary",
}: {
  request: AiSummaryRequest
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const summaryKey = useMemo(() => JSON.stringify(request), [request])

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
          pageTitle: request.pageTitle,
          filters: request.filters,
          totalIncome: request.totalIncome ?? 0,
          totalExpenses: request.totalExpenses ?? 0,
          net: request.net ?? 0,
          transactionCount: toNumber(request.transactionCount),
          savingsRate: request.savingsRate ?? null,
          topCategories: request.topCategories ?? [],
          topMerchants: request.topMerchants?.map((merchant) => ({
            ...merchant,
            count: toNumber(merchant.count) ?? 0,
          })),
          cashFlow: request.cashFlow,
          budgets: request.budgets,
          periodDelta: request.periodDelta ?? null,
          currency: request.currency ?? "EUR",
          contextSections: request.contextSections,
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
        {label}
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
            Generated from this page&apos;s current data and filters.
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
              {loading ? "Analysing this view..." : "Open the summary to generate an AI-written view of this page."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleGenerate(Boolean(narrative))}
            disabled={loading}
          >
            <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
            {narrative ? "Regenerate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
