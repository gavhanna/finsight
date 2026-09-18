import { useState } from "react"
import { Trash2, Pencil, ChevronRight, ChevronDown, Check, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { applyRuleToHistory, deletePattern } from "@/server/fn/categories"
import type { Category } from "@/db/schema"
import type { RuleWithMeta } from "./types"
import { CategoryDot } from "./category-dot"
import { PatternRow, AddPatternRow } from "./pattern-row"
import { RuleDialog } from "./rule-dialog"

export function RuleRow({
  rule, categories, isExpanded, onToggle, onDelete, onRefresh,
}: {
  rule: RuleWithMeta; categories: Category[]
  isExpanded: boolean; onToggle: () => void
  onDelete: () => void; onRefresh: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)

  async function handleApply() {
    setApplying(true)
    setApplyResult(null)
    const { updated } = await applyRuleToHistory({ data: { ruleId: rule.id, categoryId: rule.categoryId } })
    setApplyResult(updated)
    setApplying(false)
    onRefresh()
  }

  return (
    <div className={cn("bg-card", isExpanded && "bg-muted/20")}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}

          <span className="font-medium text-sm truncate">{rule.name}</span>

          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            {rule.patterns.slice(0, 3).map(p => (
              <span
                key={p.id}
                className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
              >
                {p.pattern}
              </span>
            ))}
            {rule.patterns.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{rule.patterns.length - 3}
              </span>
            )}
          </div>
        </button>

        <span className="text-xs text-muted-foreground tabular-nums hidden sm:block shrink-0">
          {rule.patterns.length} {rule.patterns.length === 1 ? "pattern" : "patterns"}
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs shrink-0">
          <CategoryDot category={rule.category} size="xs" />
          <span className="hidden sm:inline">{rule.category?.name ?? "No category"}</span>
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost" size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={e => { e.stopPropagation(); setEditOpen(true) }}
            title="Edit rule"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Delete rule"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t">
          <div className="px-4 py-3 space-y-0.5">
            {rule.patterns.map(p => (
              <PatternRow
                key={p.id}
                pattern={p}
                onDelete={async () => { await deletePattern({ data: p.id }); onRefresh() }}
                onRefresh={onRefresh}
              />
            ))}
            <AddPatternRow ruleId={rule.id} onSaved={onRefresh} />
          </div>

          <div className="border-t px-4 py-2.5 flex items-center gap-3 bg-muted/10">
            {applyResult !== null ? (
              <span className="text-xs text-positive flex items-center gap-1.5">
                <Check className="size-3.5" />
                Applied to {applyResult} transaction{applyResult !== 1 ? "s" : ""}
              </span>
            ) : (
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs"
                onClick={handleApply}
                disabled={applying}
              >
                <Zap className="size-3.5" />
                {applying ? "Applying…" : "Apply to historical transactions"}
              </Button>
            )}
            {applyResult !== null && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setApplyResult(null)}
              >
                Dismiss
              </button>
            )}
            <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
              Rules override manual categories
            </span>
          </div>
        </div>
      )}

      <RuleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        rule={rule}
        categories={categories}
        onSaved={() => { setEditOpen(false); onRefresh() }}
      />
    </div>
  )
}
