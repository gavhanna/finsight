import { createFileRoute } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { CheckCheck, SkipForward, Inbox } from "lucide-react"
import { getUncategorisedTransactions, updateTransactionCategory } from "../server/fn/transactions"
import { getCategories } from "../server/fn/categories"
import { formatCurrency, formatDate } from "../lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Category, Transaction } from "../db/schema"

export const Route = createFileRoute("/triage")({
  component: TriagePage,
  loader: async () => {
    const [transactions, categories] = await Promise.all([
      getUncategorisedTransactions(),
      getCategories(),
    ])
    return { transactions, categories }
  },
})

function TriagePage() {
  const { transactions: initial, categories } = Route.useLoaderData()

  // Work through a local queue — no reload needed between items
  const [queue, setQueue] = useState<Transaction[]>(initial)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  const total = queue.length + doneCount
  const current = queue[index]
  const remaining = queue.length - index

  const advance = useCallback(() => {
    if (index >= queue.length - 1) {
      // Remove items we've passed from the queue to keep it clean
      setQueue((q) => q.slice(index + 1))
      setIndex(0)
    } else {
      setIndex((i) => i + 1)
    }
  }, [index, queue.length])

  async function handleCategorise(categoryId: number) {
    if (!current || saving) return
    setSaving(true)
    try {
      await updateTransactionCategory({ data: { id: current.id, categoryId } })
      setDoneCount((n) => n + 1)
      // Remove the categorised item from queue
      setQueue((q) => q.filter((_, i) => i !== index))
      // index stays the same — next item slides into its position
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    advance()
  }

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Inbox className="size-12 mx-auto text-muted-foreground/40" />
          <p className="font-medium">No uncategorised transactions</p>
          <p className="text-sm text-muted-foreground">All transactions have a category assigned.</p>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-3">
          <CheckCheck className="size-12 mx-auto text-positive" />
          <p className="font-medium">All done!</p>
          <p className="text-sm text-muted-foreground">
            You categorised {doneCount} transaction{doneCount !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>
    )
  }

  const displayName = current.creditorName ?? current.debtorName ?? current.description ?? "Unknown"
  const isIncome = current.amount >= 0
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Triage</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            {remaining} remaining
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {doneCount} of {total} categorised
        </p>
      </div>

      {/* Transaction card */}
      <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="font-semibold text-lg leading-tight truncate">{displayName}</p>
            {current.description && current.description !== displayName && (
              <p className="text-sm text-muted-foreground truncate">{current.description}</p>
            )}
            <p className="text-xs text-muted-foreground">{formatDate(current.bookingDate)}</p>
          </div>
          <p className={cn(
            "text-2xl font-bold tabular-nums font-mono shrink-0",
            isIncome ? "text-positive" : "text-foreground"
          )}>
            {formatCurrency(current.amount, current.currency)}
          </p>
        </div>

        {current.merchantCategoryCode && (
          <Badge variant="secondary" className="text-xs">
            MCC {current.merchantCategoryCode}
          </Badge>
        )}
      </div>

      {/* Category picker */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Pick a category</p>
        <CategoryGrid
          categories={categories}
          onSelect={handleCategorise}
          disabled={saving}
        />
      </div>

      {/* Skip */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={saving || remaining <= 1}
          className="text-muted-foreground"
        >
          <SkipForward data-icon="inline-start" />
          Skip
        </Button>
      </div>
    </div>
  )
}

function CategoryGrid({
  categories,
  onSelect,
  disabled,
}: {
  categories: Category[]
  onSelect: (id: number) => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm font-medium",
            "transition-colors hover:bg-accent hover:border-primary/40",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="truncate">{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
