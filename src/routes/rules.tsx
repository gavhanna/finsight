import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import {
  getAllRules,
  getCategories,
  createRule,
  updateRule,
  deleteRule,
  addPattern,
  updatePattern,
  deletePattern,
  previewRule,
  previewPatterns,
  applyRuleToHistory,
} from "../server/fn/categories"
import type { Category, Rule, RulePattern } from "../db/schema"
import { Plus, Trash2, Pencil, Search, ChevronDown, ChevronRight, X, Check, Zap, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDate } from "../lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

type RuleWithMeta = Rule & { category: Category | null; patterns: RulePattern[] }
type PreviewTx = {
  id: string
  bookingDate: string
  amount: number
  currency: string
  creditorName: string | null
  debtorName: string | null
  description: string | null
  categoryId: number | null
  categorisedBy: string | null
  category: Category | null
}

// A pattern in the form — existing ones carry an id, new ones don't
type PatternDraft = {
  id?: number
  pattern: string
  field: RulePattern["field"]
  matchType: RulePattern["matchType"]
  _deleted?: boolean
}

const FIELDS = [
  { value: "description", label: "Description" },
  { value: "creditorName", label: "Creditor Name" },
  { value: "debtorName", label: "Debtor Name" },
  { value: "merchantCategoryCode", label: "MCC" },
] as const

const MATCH_TYPES = [
  { value: "contains", label: "Contains" },
  { value: "exact", label: "Exact" },
  { value: "startsWith", label: "Starts with" },
] as const

export const Route = createFileRoute("/rules")({
  component: RulesPage,
  loader: async () => {
    const [ruleList, cats] = await Promise.all([getAllRules(), getCategories()])
    return { rules: ruleList, categories: cats }
  },
})

function CategoryDot({ category, size = "sm" }: { category: Category | null; size?: "sm" | "xs" }) {
  const dim = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2"
  return (
    <span
      className={`${dim} rounded-full flex-shrink-0 inline-block`}
      style={{ backgroundColor: category?.color ?? "#888" }}
    />
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function RulesPage() {
  const { rules, categories } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  async function handleDelete(id: number) {
    if (!confirm("Delete this rule and all its patterns?")) return
    await deleteRule({ data: id })
    router.invalidate()
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Named rules with one or more patterns for auto-categorisation. Higher priority runs first.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No rules yet. Add one to start auto-categorising transactions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(rules as RuleWithMeta[]).map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              categories={categories}
              isExpanded={expandedId === rule.id}
              onToggle={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              onDelete={() => handleDelete(rule.id)}
              onRefresh={() => router.invalidate()}
            />
          ))}
        </div>
      )}

      {/* Create sheet */}
      <RuleDialog
        open={showNew}
        onOpenChange={setShowNew}
        categories={categories}
        onSaved={() => { setShowNew(false); router.invalidate() }}
      />
    </div>
  )
}

// ─── Rule card ───────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  categories,
  isExpanded,
  onToggle,
  onDelete,
  onRefresh,
}: {
  rule: RuleWithMeta
  categories: Category[]
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [applyToHistory, setApplyToHistory] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)

  async function handleApply() {
    setApplying(true)
    setApplyResult(null)
    const { updated } = await applyRuleToHistory({ data: { ruleId: rule.id, categoryId: rule.categoryId } })
    setApplyResult(updated)
    setApplying(false)
    setApplyToHistory(false)
    onRefresh()
  }

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <span className="font-medium text-sm truncate">{rule.name}</span>
        </button>

        <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
          {rule.patterns.length} {rule.patterns.length === 1 ? "pattern" : "patterns"}
        </span>

        {/* Category badge */}
        <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
          <CategoryDot category={rule.category} size="xs" />
          <span>{rule.category?.name ?? "No category"}</span>
        </span>

        {/* Priority — only when non-zero */}
        {rule.priority !== 0 && (
          <Badge variant="outline" className="text-xs font-normal hidden sm:flex">
            P{rule.priority}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
          title="Edit rule"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Delete rule"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          <div className="p-3 space-y-1">
            {rule.patterns.map((p) => (
              <PatternRow
                key={p.id}
                pattern={p}
                onDelete={async () => { await deletePattern({ data: p.id }); onRefresh() }}
                onRefresh={onRefresh}
              />
            ))}
            <AddPatternRow ruleId={rule.id} onSaved={onRefresh} />
          </div>

          <Separator />

          <div className="p-3">
            {applyResult !== null ? (
              <p className="text-xs text-positive flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Updated {applyResult} transaction{applyResult !== 1 ? "s" : ""}.
              </p>
            ) : (
              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <Checkbox
                  checked={applyToHistory}
                  onCheckedChange={(checked) => { setApplyToHistory(!!checked); setApplyResult(null) }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Apply to all historical transactions (non-manual)
                  </span>
                  {applyToHistory && (
                    <div className="mt-2">
                      <Button size="sm" onClick={handleApply} disabled={applying}>
                        <Zap className="h-3.5 w-3.5" />
                        {applying ? "Applying…" : "Apply Now"}
                      </Button>
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Edit sheet */}
      <RuleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        rule={rule}
        categories={categories}
        onSaved={() => { setEditOpen(false); onRefresh() }}
      />
    </Card>
  )
}

// ─── Sheet wrapper ────────────────────────────────────────────────────────────

function RuleDialog({
  open,
  onOpenChange,
  rule,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rule?: RuleWithMeta
  categories: Category[]
  onSaved: () => void
}) {
  const isEdit = !!rule
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{isEdit ? "Edit Rule" : "New Rule"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the rule name, category, priority, or its match patterns."
              : "Add a name, choose a category, then define one or more patterns to match against your transactions."}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <RuleForm
            key={rule?.id ?? "new"}
            rule={rule}
            categories={categories}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Unified create / edit form ───────────────────────────────────────────────

function RuleForm({
  rule,
  categories,
  onClose,
  onSaved,
}: {
  rule?: RuleWithMeta
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!rule

  const [name, setName] = useState(rule?.name ?? "")
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? categories[0]?.id ?? 0)
  const [priority, setPriority] = useState(rule?.priority ?? 0)
  const [patterns, setPatterns] = useState<PatternDraft[]>(
    rule?.patterns.length
      ? rule.patterns.map(p => ({ id: p.id, pattern: p.pattern, field: p.field, matchType: p.matchType }))
      : [{ pattern: "", field: "description", matchType: "contains" }]
  )
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only visible (non-deleted) patterns
  const visiblePatterns = patterns.filter(p => !p._deleted)
  // Non-empty visible patterns to use for preview
  const previewablePatterns = visiblePatterns.filter(p => p.pattern.trim())

  useEffect(() => {
    if (previewablePatterns.length === 0) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewPatterns({
          data: {
            patterns: previewablePatterns.map(p => ({
              pattern: p.pattern,
              field: p.field,
              matchType: p.matchType,
            })),
          },
        })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(previewablePatterns.map(p => [p.pattern, p.field, p.matchType]))])

  function updatePatternAt(visibleIdx: number, vals: Partial<PatternDraft>) {
    // Map visible index back to full patterns array index
    let count = -1
    const fullIdx = patterns.findIndex(p => {
      if (!p._deleted) count++
      return count === visibleIdx
    })
    if (fullIdx === -1) return
    setPatterns(ps => ps.map((p, i) => i === fullIdx ? { ...p, ...vals } : p))
  }

  function removePatternAt(visibleIdx: number) {
    let count = -1
    const fullIdx = patterns.findIndex(p => {
      if (!p._deleted) count++
      return count === visibleIdx
    })
    if (fullIdx === -1) return
    const p = patterns[fullIdx]
    if (p.id) {
      // Existing pattern: mark deleted so we can delete it on save
      setPatterns(ps => ps.map((pp, i) => i === fullIdx ? { ...pp, _deleted: true } : pp))
    } else {
      // New pattern: just remove from array
      setPatterns(ps => ps.filter((_, i) => i !== fullIdx))
    }
  }

  function addNewPattern() {
    setPatterns(ps => [...ps, { pattern: "", field: "description", matchType: "contains" }])
  }

  async function handleSave() {
    const hasValid = visiblePatterns.some(p => p.pattern.trim())
    if (!name.trim() || !hasValid || !categoryId) return
    setSaving(true)
    try {
      if (!isEdit) {
        // Create
        await createRule({
          data: {
            name: name.trim(),
            categoryId,
            priority,
            patterns: visiblePatterns
              .filter(p => p.pattern.trim())
              .map(p => ({ pattern: p.pattern, field: p.field, matchType: p.matchType })),
          },
        })
      } else {
        // Update metadata
        await updateRule({ data: { id: rule.id, name: name.trim(), categoryId, priority } })

        // Reconcile patterns
        for (const p of patterns) {
          if (p._deleted && p.id) {
            await deletePattern({ data: p.id })
          } else if (!p._deleted && p.id) {
            const original = rule.patterns.find(op => op.id === p.id)
            if (
              original &&
              (original.pattern !== p.pattern ||
                original.field !== p.field ||
                original.matchType !== p.matchType)
            ) {
              await updatePattern({ data: { id: p.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
            }
          } else if (!p._deleted && !p.id && p.pattern.trim()) {
            await addPattern({ data: { ruleId: rule.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
          }
        }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const selectedCategory = categories.find(c => c.id === categoryId)
  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0
  const canSave = name.trim() && visiblePatterns.some(p => p.pattern.trim()) && categoryId

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-name">Rule name</Label>
        <Input
          id="rule-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries, Streaming services"
          autoFocus={!isEdit}
        />
      </div>

      {/* Category + Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={String(categoryId)} onValueChange={(v) => v && setCategoryId(Number(v))}>
            <SelectTrigger>
              <SelectValue>
                {selectedCategory ? (
                  <span className="flex items-center gap-2">
                    <CategoryDot category={selectedCategory} />
                    {selectedCategory.name}
                  </span>
                ) : "Select…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="flex items-center gap-2">
                    <CategoryDot category={c} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-priority">
            Priority
            <span className="text-xs text-muted-foreground font-normal ml-1">higher runs first</span>
          </Label>
          <Input
            id="rule-priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Patterns */}
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <Label>Patterns</Label>
          <span className="text-xs text-muted-foreground">matches if ANY pattern matches</span>
        </div>
        <div className="space-y-2">
          {visiblePatterns.map((p, visIdx) => (
            <div
              key={p.id ?? `new-${visIdx}`}
              className="space-y-2 rounded-md border p-2.5"
            >
              <Input
                className="font-mono text-sm"
                value={p.pattern}
                placeholder="e.g. ALDI"
                onChange={(e) => updatePatternAt(visIdx, { pattern: e.target.value })}
              />
              <div className="flex gap-2">
                <Select
                  value={p.field}
                  onValueChange={(v) => v && updatePatternAt(visIdx, { field: v as RulePattern["field"] })}
                >
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={p.matchType}
                  onValueChange={(v) => v && updatePatternAt(visIdx, { matchType: v as RulePattern["matchType"] })}
                >
                  <SelectTrigger className="flex-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {visiblePatterns.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => removePatternAt(visIdx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={addNewPattern}
          >
            <Plus className="h-3 w-3" /> Add another pattern
          </Button>
        </div>
      </div>

      {/* Preview — all patterns combined */}
      {previewablePatterns.length > 0 && (
        <PreviewTable
          preview={preview}
          previewing={previewing}
          manualCount={manualCount}
          patternCount={previewablePatterns.length}
        />
      )}

      <Separator />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Rule"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Inline pattern editing (expanded card) ───────────────────────────────────

function PatternRow({ pattern, onDelete, onRefresh }: { pattern: RulePattern; onDelete: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ pattern: pattern.pattern, field: pattern.field, matchType: pattern.matchType })
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editing || !form.pattern.trim()) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewRule({ data: { pattern: form.pattern, field: form.field, matchType: form.matchType } })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [editing, form.pattern, form.field, form.matchType])

  async function handleSave() {
    await updatePattern({ data: { id: pattern.id, ...form } })
    setEditing(false)
    onRefresh()
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-background border px-2.5 py-1.5 group">
        <code className="text-xs font-mono font-medium flex-shrink-0">{pattern.pattern}</code>
        <span className="text-xs text-muted-foreground">in</span>
        <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0 h-5">
          {FIELDS.find(f => f.value === pattern.field)?.label}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0 h-5">
          {MATCH_TYPES.find(m => m.value === pattern.matchType)?.label}
        </Badge>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="rounded-md border p-3 space-y-3 bg-background">
      <div className="space-y-2">
        <Input
          className="font-mono text-sm w-full"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select value={form.field} onValueChange={(v) => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.matchType} onValueChange={(v) => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1 col-span-2 sm:col-span-1">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setEditing(false); setForm({ pattern: pattern.pattern, field: pattern.field, matchType: pattern.matchType }) }}>Cancel</Button>
          </div>
        </div>
      </div>
      {form.pattern.trim() && <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />}
    </div>
  )
}

function AddPatternRow({ ruleId, onSaved }: { ruleId: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ pattern: "", field: "description" as RulePattern["field"], matchType: "contains" as RulePattern["matchType"] })
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open || !form.pattern.trim()) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewRule({ data: { pattern: form.pattern, field: form.field, matchType: form.matchType } })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [open, form.pattern, form.field, form.matchType])

  async function handleAdd() {
    if (!form.pattern.trim()) return
    await addPattern({ data: { ruleId, ...form } })
    setForm({ pattern: "", field: "description", matchType: "contains" })
    setPreview(null)
    setOpen(false)
    onSaved()
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground mt-1" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" /> Add pattern
      </Button>
    )
  }

  return (
    <div className="rounded-md border p-3 space-y-3 bg-background mt-1">
      <div className="grid grid-cols-3 gap-2">
        <Input
          className="col-span-3 font-mono text-sm"
          placeholder="e.g. ALDI, SUPERVALU"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={(v) => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={(v) => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button size="sm" className="flex-1 h-8 text-xs" disabled={!form.pattern.trim()} onClick={handleAdd}>Add</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setOpen(false); setForm({ pattern: "", field: "description", matchType: "contains" }) }}>Cancel</Button>
        </div>
      </div>
      {form.pattern.trim() && <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />}
    </div>
  )
}

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ preview, previewing, manualCount, patternCount }: {
  preview: { count: number; capped: boolean; transactions: PreviewTx[] } | null
  previewing: boolean
  manualCount: number
  patternCount?: number
}) {
  const scope = patternCount && patternCount > 1 ? ` across ${patternCount} patterns` : ""
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">
          {previewing
            ? "Searching…"
            : preview
              ? `${preview.count}${preview.capped ? "+" : ""} matching transaction${preview.count !== 1 ? "s" : ""}${scope}${manualCount > 0 ? ` · ${manualCount} manual (won't be overwritten)` : ""}`
              : `No matches${scope}`}
        </span>
        {manualCount > 0 && !previewing && (
          <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
        )}
      </div>
      {preview && preview.transactions.length > 0 && (
        <div className="rounded-md border overflow-hidden max-h-48 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead className="py-1.5 text-xs">Date</TableHead>
                <TableHead className="py-1.5 text-xs">Payee / Description</TableHead>
                <TableHead className="py-1.5 text-xs text-right">Amount</TableHead>
                <TableHead className="py-1.5 text-xs">Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.transactions.map((tx) => (
                <TableRow key={tx.id} className={tx.categorisedBy === "manual" ? "opacity-50" : ""}>
                  <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(tx.bookingDate)}</TableCell>
                  <TableCell className="py-1.5 text-xs max-w-xs truncate">{tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}</TableCell>
                  <TableCell className={`py-1.5 text-xs text-right tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-positive" : ""}`}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">
                    {tx.category ? (
                      <span className="flex items-center gap-1">
                        <CategoryDot category={tx.category} size="xs" />
                        {tx.category.name}
                        {tx.categorisedBy === "manual" && <span className="text-muted-foreground ml-1">(manual)</span>}
                      </span>
                    ) : <span className="text-muted-foreground">Uncategorised</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
