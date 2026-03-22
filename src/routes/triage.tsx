import { createFileRoute } from "@tanstack/react-router"
import { useState, useCallback, useEffect } from "react"
import { CheckCheck, SkipForward, SkipBack, Inbox, Zap, X, ArrowLeft, Loader2 } from "lucide-react"
import { getTransactionsForTriage, updateTransactionCategory } from "../server/fn/transactions"
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
    const [categories, rules] = await Promise.all([getCategories(), getAllRules()])
    return { categories, rules }
  },
})

type RuleField = "creditorName" | "description"
type RuleAction = "new" | "add"
type RuleWithPatterns = Awaited<ReturnType<typeof getAllRules>>[number]

function bestPatternText(tx: Transaction): { text: string; field: RuleField } {
  if (tx.creditorName?.trim()) return { text: tx.creditorName.trim(), field: "creditorName" }
  if (tx.debtorName?.trim()) return { text: tx.debtorName.trim(), field: "creditorName" }
  return { text: tx.description?.trim() ?? "", field: "description" }
}

// null = uncategorised, number = specific category id
type SelectedCategory = null | number

function TriagePage() {
  const { categories, rules } = Route.useLoaderData()

  // "picking" = show category selector; "loading" = fetching txns; "triaging" = card flow
  type Phase =
    | { type: "picking" }
    | { type: "loading"; categoryId: SelectedCategory }
    | { type: "triaging"; categoryId: SelectedCategory; queue: Transaction[]; index: number; doneCount: number }

  const [phase, setPhase] = useState<Phase>({ type: "picking" })

  async function selectCategory(categoryId: SelectedCategory) {
    setPhase({ type: "loading", categoryId })
    const txns = await getTransactionsForTriage({ data: { categoryId } })
    setPhase({ type: "triaging", categoryId, queue: txns, index: 0, doneCount: 0 })
  }

  function backToPicker() {
    setPhase({ type: "picking" })
  }

  if (phase.type === "picking") {
    return <CategoryPicker categories={categories} onSelect={selectCategory} />
  }

  if (phase.type === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TriageFlow
      categoryId={phase.categoryId}
      initialQueue={phase.queue}
      initialDoneCount={phase.doneCount}
      categories={categories}
      rules={rules}
      onBack={backToPicker}
    />
  )
}

function CategoryPicker({
  categories,
  onSelect,
}: {
  categories: Category[]
  onSelect: (categoryId: SelectedCategory) => void
}) {
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      <div className="animate-in space-y-1">
        <h2 className="font-semibold text-lg">Review transactions</h2>
        <p className="text-sm text-muted-foreground">Pick a category to go through and fix.</p>
      </div>
      <div className="animate-in stagger-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Uncategorised first */}
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
            "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10 bg-muted-foreground/40" />
          <span className="truncate text-xs font-semibold">Uncategorised</span>
        </button>
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            style={{ animationDelay: `${i * 20}ms` }}
            className={cn(
              "animate-in flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
              "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span
              className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: cat.color }}
            />
            <span className="truncate text-xs font-semibold">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TriageFlow({
  categoryId,
  initialQueue,
  initialDoneCount,
  categories,
  rules,
  onBack,
}: {
  categoryId: SelectedCategory
  initialQueue: Transaction[]
  initialDoneCount: number
  categories: Category[]
  rules: RuleWithPatterns[]
  onBack: () => void
}) {
  const [queue, setQueue] = useState<Transaction[]>(initialQueue)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [doneCount, setDoneCount] = useState(initialDoneCount)

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

  const currentCategoryName =
    categoryId !== null ? categories.find((c) => c.id === categoryId)?.name : null
  const currentCategoryColor =
    categoryId !== null ? categories.find((c) => c.id === categoryId)?.color : null

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

  async function handleCategorise(newCategoryId: number) {
    if (!current || saving) return
    setSaving(true)
    try {
      await updateTransactionCategory({ data: { id: current.id, categoryId: newCategoryId } })

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
              categoryId: newCategoryId,
              priority: 0,
              patterns: [{ pattern: patternText, field, matchType: "contains" }],
            },
          })
        }
      }

      setDoneCount((n) => n + 1)
      setQueue((q) => q.filter((_, i) => i !== index))
      closeRuleMode()
    } finally {
      setSaving(false)
    }
  }

  const advance = useCallback(() => {
    closeRuleMode()
    if (index >= queue.length - 1) {
      setQueue((q) => q.slice(index + 1))
      setIndex(0)
    } else {
      setIndex((i) => i + 1)
    }
  }, [index, queue.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterLabel = categoryId === null ? "Uncategorised" : (currentCategoryName ?? "Unknown")

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 gap-6">
        <div className="text-center space-y-3">
          <Inbox className="size-12 mx-auto text-muted-foreground/40" />
          <p className="font-medium">No transactions in "{filterLabel}"</p>
          <p className="text-sm text-muted-foreground">Nothing to review here.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to categories
        </Button>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 gap-6">
        <div className="text-center space-y-3">
          <CheckCheck className="size-12 mx-auto text-positive" />
          <p className="font-medium">All done!</p>
          <p className="text-sm text-muted-foreground">
            You fixed {doneCount} transaction{doneCount !== 1 ? "s" : ""} in "{filterLabel}".
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to categories
        </Button>
      </div>
    )
  }

  const displayName = current.creditorName ?? current.debtorName ?? current.description ?? "Unknown"
  const isIncome = current.amount >= 0
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      {/* Header + progress */}
      <div className="animate-in space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to category picker"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex items-center gap-1.5">
              {currentCategoryColor && (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: currentCategoryColor }}
                />
              )}
              <span className="text-sm font-semibold text-muted-foreground">{filterLabel}</span>
              <span className="text-sm font-semibold text-muted-foreground tabular-nums">· {remaining} left</span>
            </div>
          </div>
          <span className="section-label tabular-nums">{doneCount} / {total} done</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Transaction card */}
      <div className="animate-in stagger-1 rounded-2xl border bg-card shadow-md overflow-hidden hover-glow">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-bold text-xl leading-tight">{displayName}</p>
              {current.description && current.description !== displayName && (
                <p className="text-sm text-muted-foreground truncate">{current.description}</p>
              )}
              <p className="text-xs text-muted-foreground font-medium">{formatDate(current.bookingDate)}</p>
            </div>
            <p className={cn(
              "metric-number shrink-0 tabular-nums",
              isIncome ? "text-positive" : "text-foreground"
            )}>
              {formatCurrency(current.amount, current.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryId !== null && currentCategoryName && (
              <Badge variant="secondary" className="text-xs gap-1.5">
                {currentCategoryColor && (
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentCategoryColor }}
                  />
                )}
                Currently: {currentCategoryName}
              </Badge>
            )}
            {current.merchantCategoryCode && (
              <Badge variant="secondary" className="text-xs font-mono">
                MCC {current.merchantCategoryCode}
              </Badge>
            )}
          </div>
        </div>

        {/* Rule panel */}
        {ruleMode ? (
          <div className="border-t bg-muted/30 px-5 py-4 space-y-3">
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

            {ruleAction === "add" && (
              <Select
                value={selectedRuleId?.toString() ?? ""}
                onValueChange={(v) => setSelectedRuleId(Number(v))}
              >
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue>
                    {selectedRuleId !== null
                      ? (() => { const r = rules.find(r => r.id === selectedRuleId); return r ? <span className="flex items-center gap-2">{r.category && <span className="size-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: r.category.color }} />}{r.name}</span> : "Choose a rule…" })()
                      : "Choose a rule…"}
                  </SelectValue>
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

            {ruleAction === "new" && (
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Rule name…"
                className="h-8 text-sm w-full"
              />
            )}

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
      <div className="animate-in stagger-2 space-y-3">
        <p className="section-label">
          {ruleMode && rulePattern.trim()
            ? ruleAction === "add" && selectedRuleId !== null
              ? "Pick a category — will add pattern to rule"
              : "Pick a category — will create rule"
            : categoryId !== null
              ? "Move to a different category"
              : "Pick a category"}
        </p>
        <CategoryGrid
          categories={categories}
          currentCategoryId={categoryId}
          onSelect={handleCategorise}
          disabled={saving}
        />
      </div>

      {/* Skip / Back */}
      <div className="flex justify-between animate-in stagger-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { closeRuleMode(); setIndex((i) => i - 1) }}
          disabled={saving || index === 0}
          className="text-muted-foreground hover:text-foreground"
        >
          <SkipBack data-icon="inline-start" />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={advance}
          disabled={saving || remaining <= 1}
          className="text-muted-foreground hover:text-foreground"
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
  currentCategoryId,
  onSelect,
  disabled,
}: {
  categories: Category[]
  currentCategoryId?: number | null
  onSelect: (id: number) => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {categories.map((cat, i) => {
        const isCurrent = cat.id === currentCategoryId
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            disabled={disabled}
            style={{ animationDelay: `${i * 20}ms` }}
            className={cn(
              "animate-in flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
              "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent && "border-primary/40 bg-accent/50",
            )}
          >
            <span
              className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: cat.color }}
            />
            <span className="truncate text-xs font-semibold">{cat.name}</span>
          </button>
        )
      })}
    </div>
  )
}
