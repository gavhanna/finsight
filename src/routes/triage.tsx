import { createFileRoute } from "@tanstack/react-router"
import { useState, useCallback, useEffect } from "react"
import { CheckCheck, SkipForward, Inbox, Zap, X } from "lucide-react"
import { getUncategorisedTransactions, updateTransactionCategory } from "../server/fn/transactions"
import { getCategories, createRule, addPattern, getAllRules } from "../server/fn/categories"
import { formatCurrency, formatDate } from "../lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Category, Transaction } from "../db/schema"

export const Route = createFileRoute("/triage")({
  component: TriagePage,
  loader: async () => {
    const [transactions, categories, rules] = await Promise.all([
      getUncategorisedTransactions(),
      getCategories(),
      getAllRules(),
    ])
    return { transactions, categories, rules }
  },
})

type RuleField = "creditorName" | "description"
type RuleAction = "new" | "add"

function bestPatternText(tx: Transaction): { text: string; field: RuleField } {
  if (tx.creditorName?.trim()) return { text: tx.creditorName.trim(), field: "creditorName" }
  if (tx.debtorName?.trim()) return { text: tx.debtorName.trim(), field: "creditorName" }
  return { text: tx.description?.trim() ?? "", field: "description" }
}

function TriagePage() {
  const { transactions: initial, categories, rules } = Route.useLoaderData()

  const [queue, setQueue] = useState<Transaction[]>(initial)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  // Rule panel state
  const [ruleMode, setRuleMode] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [rulePattern, setRulePattern] = useState("")
  const [ruleField, setRuleField] = useState<RuleField>("creditorName")
  const [ruleAction, setRuleAction] = useState<RuleAction>("new")
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null)

  const total = queue.length + doneCount
  const current = queue[index]
  const remaining = queue.length - index

  // When the current transaction changes, refresh the pre-filled pattern (and name if untouched)
  useEffect(() => {
    if (current && ruleMode) {
      const { text, field } = bestPatternText(current)
      setRulePattern(text)
      setRuleName(text)
      setRuleField(field)
    }
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function openRuleMode() {
    if (!current) return
    const { text, field } = bestPatternText(current)
    setRulePattern(text)
    setRuleName(text)
    setRuleField(field)
    setRuleMode(true)
  }

  function closeRuleMode() {
    setRuleMode(false)
    setRuleName("")
    setRulePattern("")
    setRuleAction("new")
    setSelectedRuleId(null)
  }

  async function handleCategorise(categoryId: number) {
    if (!current || saving) return
    setSaving(true)
    try {
      await updateTransactionCategory({ data: { id: current.id, categoryId } })

      if (ruleMode && rulePattern.trim()) {
        const patternText = rulePattern.trim()
        const field = ruleField === "creditorName" ? "creditorName" : "description"
        if (ruleAction === "add" && selectedRuleId !== null) {
          await addPattern({
            data: { ruleId: selectedRuleId, pattern: patternText, field, matchType: "contains" },
          })
        } else {
          await createRule({
            data: {
              name: ruleName.trim() || patternText,
              categoryId,
              priority: 0,
              patterns: [{ pattern: patternText, field, matchType: "contains" }],
            },
          })
        }
      }

      setDoneCount((n) => n + 1)
      setQueue((q) => q.filter((_, i) => i !== index))
      // index stays the same — next item slides into its position
    } finally {
      setSaving(false)
    }
  }

  const advance = useCallback(() => {
    if (index >= queue.length - 1) {
      setQueue((q) => q.slice(index + 1))
      setIndex(0)
    } else {
      setIndex((i) => i + 1)
    }
  }, [index, queue.length])

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
      {/* Header + progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Triage</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            {remaining} remaining
          </span>
        </div>
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
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-5 space-y-4">
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

        {/* Rule panel — toggled inline at the bottom of the card */}
        {ruleMode ? (
          <div className="border-t bg-muted/30 px-5 py-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Zap className="size-3.5" />
                Also save rule
              </div>
              <button
                onClick={closeRuleMode}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cancel rule"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* New vs add-to toggle */}
            <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
              <button
                onClick={() => setRuleAction("new")}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  ruleAction === "new"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                New rule
              </button>
              <button
                onClick={() => setRuleAction("add")}
                className={cn(
                  "px-3 py-1.5 border-l transition-colors",
                  ruleAction === "add"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                Add to existing
              </button>
            </div>

            {/* Existing rule selector */}
            {ruleAction === "add" && (
              <Select
                value={selectedRuleId?.toString() ?? ""}
                onValueChange={(v) => setSelectedRuleId(Number(v))}
              >
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue placeholder="Choose a rule…" />
                </SelectTrigger>
                <SelectContent>
                  {rules.map((rule) => (
                    <SelectItem key={rule.id} value={rule.id.toString()}>
                      <span className="flex items-center gap-2">
                        {rule.category && (
                          <span
                            className="size-2 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: rule.category.color }}
                          />
                        )}
                        {rule.name}
                        <span className="text-muted-foreground">
                          — {rule.patterns.length} pattern{rule.patterns.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Rule name — only for new rules */}
            {ruleAction === "new" && (
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Rule name…"
                className="h-8 text-sm w-full"
              />
            )}

            {/* Pattern input + field */}
            <div className="flex gap-2">
              <Input
                value={rulePattern}
                onChange={(e) => setRulePattern(e.target.value)}
                placeholder="Pattern to match…"
                className="h-8 text-sm flex-1 min-w-0"
              />
              <Select value={ruleField} onValueChange={(v) => setRuleField(v as RuleField)}>
                <SelectTrigger className="h-8 text-xs w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="creditorName">Creditor name</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              {ruleAction === "add" && selectedRuleId !== null
                ? <>Pattern will be added to <span className="font-medium">{rules.find(r => r.id === selectedRuleId)?.name}</span>.</>
                : <>A new rule will be created and assigned the category you pick below.</>
              }
            </p>
          </div>
        ) : (
          <div className="border-t px-5 py-2.5">
            <button
              onClick={openRuleMode}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Zap className="size-3.5" />
              Add rule for future transactions like this
            </button>
          </div>
        )}
      </div>

      {/* Category picker */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          {ruleMode && rulePattern.trim()
            ? ruleAction === "add" && selectedRuleId !== null
              ? "Pick a category — will also add pattern to rule"
              : "Pick a category — will also create rule"
            : "Pick a category"}
        </p>
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
