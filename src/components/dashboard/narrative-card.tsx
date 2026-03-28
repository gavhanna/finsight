import { useState } from "react"
import { Sparkles, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { generateNarrative } from "@/server/fn/insights"

export function NarrativeCard({
  stats,
  byCat,
  periodDelta,
  dateFrom,
  dateTo,
  currency = "EUR",
}: {
  stats: { totalIncome: number; totalExpenses: number; net: number }
  byCat: { categoryName: string; total: number }[]
  periodDelta: { income: number | null; expenses: number | null } | null
  dateFrom?: string
  dateTo?: string
  currency?: string
}) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const savingsRate = stats.totalIncome > 0 ? (stats.net / stats.totalIncome) * 100 : null

  async function handleGenerate() {
    setLoading(true)
    setNarrative(null)
    setError(null)
    try {
      const result = await generateNarrative({
        data: {
          dateFrom,
          dateTo,
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          net: stats.net,
          savingsRate,
          topCategories: byCat.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total })),
          periodDelta: periodDelta ?? null,
          currency,
        },
      })
      if (result.error) setError(result.error)
      else setNarrative(result.narrative)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="ai-gradient border-primary/15 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="rounded-md bg-primary/15 p-1 text-primary">
            <Sparkles className="size-3.5" />
          </div>
          AI Financial Summary
        </CardTitle>
        <CardAction>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 rounded-md px-2 py-1 hover:bg-primary/8"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            {narrative ? "Regenerate" : "Generate"}
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {narrative ? (
          <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground/70 italic">
            {loading
              ? "Analysing your financial data…"
              : "Generate an AI-written narrative summary of your finances for this period."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
