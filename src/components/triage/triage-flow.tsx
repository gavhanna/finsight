import { useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { CheckCheck, SkipForward, SkipBack, Inbox, Zap, X, ArrowLeft } from "lucide-react"
import { updateTransactionCategory } from "@/server/fn/transactions"
import { createRule, addPattern } from "@/server/fn/categories"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category, Transaction } from "@/db/schema"
import { CategoryGrid } from "./category-grid"
import type { getAllRules } from "@/server/fn/categories"

type RuleField = "creditorName" | "description"
type RuleAction = "new" | "add"
type RuleWithPatterns = Awaited<ReturnType<typeof getAllRules>>[number]

function bestPatternText(tx: Transaction): { text: string; field: RuleField } {
  if (tx.creditorName?.trim()) return { text: tx.creditorName.trim(), field: "creditorName" }
  if (tx.debtorName?.trim()) return { text: tx.debtorName.trim(), field: "creditorName" }
  return { text: tx.description?.trim() ?? "", field: "description" }
}

export function TriageFlow({
  categoryId,
  initialQueue,
  initialDoneCount,
  categories,
  rules,
  onBack,
}: {
  categoryId: number | null
  initialQueue: Transaction[]
  initialDoneCount: number
  categories: Category[]
  rules: RuleWithPatterns[]
  onBack: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [queue, setQueue] = useState<Transaction[]>(initialQueue)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [doneCount, setDoneCount] = useState(initialDoneCount)

  const [ruleMode, setRuleMode] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [rulePattern, setRulePattern] = useState("")
  const [ruleField, setRuleField] = useState<RuleField>("creditorName")
  const [ruleAction, setRuleAction] = useState<RuleAction>("new")
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null)

  const total = queue.length + doneCount
  const current = queue[index]
  const remaining = queue.length - index

  const currentCategoryName = categoryId !== null ? categories.find((c) => c.id === categoryId)?.name : null
  const currentCategoryColor = categoryId !== null ? categories.find((c) => c.id === categoryId)?.color : null

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
    const snapshot = current
    try {
      await updateTransactionCategory({ data: { id: snapshot.id, categoryId: newCategoryId } })

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

      const catName = categories.find((c) => c.id === newCategoryId)?.name ?? "category"
      const withRule = ruleMode && rulePattern.trim()
      toast.success(`Categorised as ${catName}${withRule ? " + rule saved" : ""}`, {
        action: withRule ? undefined : {
          label: "Undo",
          onClick: async () => {
            await updateTransactionCategory({ data: { id: snapshot.id, categoryId: snapshot.categoryId } })
            setDoneCount((n) => n - 1)
            setQueue((q) => [snapshot, ...q])
          },
        },
      })
      setDoneCount((n) => n + 1)
      setQueue((q) => q.filter((_, i) => i !== index))
      closeRuleMode()
      containerRef.current?.scrollIntoView({ block: "start", behavior: "instant" })
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
    <div ref={containerRef} className="p-4 sm:p-6 space-y-5">
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
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: currentCategoryColor }} />
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
            <p className={cn("metric-number shrink-0 tabular-nums", isIncome ? "text-positive" : "text-foreground")}>
              {formatCurrency(current.amount, current.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryId !== null && currentCategoryName && (
              <Badge variant="secondary" className="text-xs gap-1.5">
                {currentCategoryColor && (
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: currentCategoryColor }} />
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
              <button onClick={closeRuleMode} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Cancel rule">
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
              <button
                onClick={() => setRuleAction("new")}
                className={cn("px-3 py-1.5 transition-colors", ruleAction === "new" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
              >
                New rule
              </button>
              <button
                onClick={() => setRuleAction("add")}
                className={cn("px-3 py-1.5 border-l transition-colors", ruleAction === "add" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
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
                          <span className="size-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: rule.category.color }} />
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
            <button onClick={openRuleMode} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Zap className="size-3.5" />
              Add rule for future transactions like this
            </button>
          </div>
        )}
      </div>

      {/* Category picker */}
      <div className="animate-in stagger-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label">
            {ruleMode && rulePattern.trim()
              ? ruleAction === "add" && selectedRuleId !== null
                ? "Pick a category — will add pattern to rule"
                : "Pick a category — will create rule"
              : categoryId !== null
                ? "Move to a different category"
                : "Pick a category"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              onClick={() => { closeRuleMode(); setIndex((i) => i - 1) }}
              disabled={saving || index === 0}
              className="text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <SkipBack className="size-3.5" />
              Back
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={advance}
              disabled={saving || remaining <= 1}
              className="text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <SkipForward className="size-3.5" />
              Skip
            </Button>
          </div>
        </div>
        <CategoryGrid
          categories={categories}
          currentCategoryId={categoryId}
          onSelect={handleCategorise}
          disabled={saving}
        />
      </div>
    </div>
  )
}
