import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect, useRef, useMemo } from "react"
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
import { recategoriseAll } from "../server/fn/transactions"
import type { Category, Rule, RulePattern } from "../db/schema"
import {
  Plus, Trash2, Pencil, Search, ChevronRight, ChevronDown,
  X, Check, Zap, AlertTriangle, Filter, RefreshCw,
} from "lucide-react"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

type RuleWithMeta = Rule & { category: Category | null; patterns: RulePattern[] }
type PreviewTx = {
  id: string; bookingDate: string; amount: number; currency: string
  creditorName: string | null; debtorName: string | null; description: string | null
  categoryId: number | null; categorisedBy: string | null; category: Category | null
}
type PatternDraft = {
  id?: number; pattern: string
  field: RulePattern["field"]; matchType: RulePattern["matchType"]; _deleted?: boolean
}

const FIELDS = [
  { value: "description", label: "Description" },
  { value: "creditorName", label: "Creditor name" },
  { value: "debtorName", label: "Debtor name" },
  { value: "merchantCategoryCode", label: "MCC" },
] as const

const MATCH_TYPES = [
  { value: "contains", label: "contains" },
  { value: "exact", label: "exact" },
  { value: "startsWith", label: "starts with" },
] as const

export const Route = createFileRoute("/rules")({
  component: RulesPage,
  loader: async () => {
    const [ruleList, cats] = await Promise.all([getAllRules(), getCategories()])
    return { rules: ruleList, categories: cats }
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CategoryDot({ category, size = "sm" }: { category: Category | null; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn("rounded-full flex-shrink-0 inline-block", size === "xs" ? "size-1.5" : "size-2")}
      style={{ backgroundColor: category?.color ?? "#888" }}
    />
  )
}

function fieldLabel(v: string) { return FIELDS.find(f => f.value === v)?.label ?? v }
function matchLabel(v: string) { return MATCH_TYPES.find(m => m.value === v)?.label ?? v }

// ─── Page ─────────────────────────────────────────────────────────────────────

function RulesPage() {
  const { rules, categories } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [filterCatId, setFilterCatId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ updated: number; total: number } | null>(null)

  async function handleApplyAll() {
    setApplying(true)
    setApplyResult(null)
    try {
      const result = await recategoriseAll()
      setApplyResult(result)
      router.invalidate()
      toast.success(`Updated ${result.updated} of ${result.total} transactions`)
    } finally {
      setApplying(false)
    }
  }

  const filtered = useMemo(() => {
    let list = rules as RuleWithMeta[]
    if (filterCatId !== null) list = list.filter(r => r.categoryId === filterCatId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.patterns.some(p => p.pattern.toLowerCase().includes(q)) ||
        r.category?.name.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [rules, search, filterCatId])

  async function handleDelete(id: number) {
    if (!confirm("Delete this rule and all its patterns?")) return
    await deleteRule({ data: id })
    router.invalidate()
  }

  // Unique categories present in rules
  const ruleCategories = useMemo(() => {
    const seen = new Map<number, Category>()
    for (const r of rules as RuleWithMeta[]) {
      if (r.category) seen.set(r.category.id, r.category)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rules])

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      {/* Header */}
      <div className="animate-in  gap-3 mb-6">
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-bold tracking-tight">Rules</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleApplyAll} disabled={applying}>
              <RefreshCw className={cn("h-4 w-4", applying && "animate-spin")} />
              {applying ? "Applying…" : "Apply to history"}
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          Auto-categorise transactions by matching patterns against payee or description. Higher priority runs first.
        </p>
      </div>

      {/* Search + filter */}
      {
        (rules as RuleWithMeta[]).length > 3 && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rules or patterns…"
                className="pl-9"
              />
            </div>
            {ruleCategories.length > 1 && (
              <Select
                value={filterCatId !== null ? String(filterCatId) : "all"}
                onValueChange={v => setFilterCatId(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="w-44">
                  <Filter className="size-3.5 text-muted-foreground mr-1" />
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {ruleCategories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <CategoryDot category={c} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )
      }

      {/* List */}
      {
        filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search || filterCatId !== null
                ? "No rules match your filters."
                : "No rules yet. Add one to start auto-categorising transactions."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden divide-y">
            {filtered.map((rule) => (
              <RuleRow
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
        )
      }

      <RuleDialog
        open={showNew}
        onOpenChange={setShowNew}
        categories={categories}
        onSaved={() => { setShowNew(false); router.invalidate() }}
      />
    </div >
  )
}

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({
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

          {/* Rule name */}
          <span className="font-medium text-sm truncate">{rule.name}</span>

          {/* Pattern preview chips */}
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

        {/* Pattern count */}
        <span className="text-xs text-muted-foreground tabular-nums hidden sm:block shrink-0">
          {rule.patterns.length} {rule.patterns.length === 1 ? "pattern" : "patterns"}
        </span>

        {/* Category pill */}
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs shrink-0">
          <CategoryDot category={rule.category} size="xs" />
          <span className="hidden sm:inline">{rule.category?.name ?? "No category"}</span>
        </span>

        {/* Actions */}
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
          {/* Patterns */}
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

          {/* Footer: apply to history */}
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

// ─── Pattern row ──────────────────────────────────────────────────────────────

function PatternRow({ pattern, onDelete, onRefresh }: {
  pattern: RulePattern; onDelete: () => void; onRefresh: () => void
}) {
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

  function handleCancel() {
    setEditing(false)
    setForm({ pattern: pattern.pattern, field: pattern.field, matchType: pattern.matchType })
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group transition-colors">
        <code className="text-xs font-mono font-semibold text-foreground">{pattern.pattern}</code>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{fieldLabel(pattern.field)}</span>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{matchLabel(pattern.matchType)}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
    )
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3 my-1">
      <div className="flex gap-2">
        <Input
          className="font-mono text-sm flex-1"
          value={form.pattern}
          onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={v => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
          <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={v => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
          <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={handleSave} disabled={!form.pattern.trim()}>
          <Check className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9" onClick={handleCancel}>
          <X className="size-3.5" />
        </Button>
      </div>
      {form.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}
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
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
      >
        <Plus className="size-3" /> Add pattern
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3 mt-1">
      <div className="flex gap-2 flex-wrap">
        <Input
          className="font-mono text-sm flex-1 min-w-lg"
          placeholder="e.g. ALDI"
          value={form.pattern}
          onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={v => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
          <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={v => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
          <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" disabled={!form.pattern.trim()} onClick={handleAdd}>Add</Button>
        <Button size="sm" variant="ghost" className="h-9" onClick={() => { setOpen(false); setForm({ pattern: "", field: "description", matchType: "contains" }) }}>
          <X className="size-3.5" />
        </Button>
      </div>
      {form.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}
    </div>
  )
}

// ─── Dialog wrapper ───────────────────────────────────────────────────────────

function RuleDialog({ open, onOpenChange, rule, categories, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void
  rule?: RuleWithMeta; categories: Category[]; onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{rule ? "Edit Rule" : "New Rule"}</DialogTitle>
          <DialogDescription>
            {rule
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

// ─── Create / edit form ───────────────────────────────────────────────────────

function RuleForm({ rule, categories, onClose, onSaved }: {
  rule?: RuleWithMeta; categories: Category[]
  onClose: () => void; onSaved: () => void
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

  const visiblePatterns = patterns.filter(p => !p._deleted)
  const previewablePatterns = visiblePatterns.filter(p => p.pattern.trim())

  useEffect(() => {
    if (previewablePatterns.length === 0) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewPatterns({
          data: { patterns: previewablePatterns.map(p => ({ pattern: p.pattern, field: p.field, matchType: p.matchType })) },
        })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(previewablePatterns.map(p => [p.pattern, p.field, p.matchType]))])

  function updatePatternAt(visIdx: number, vals: Partial<PatternDraft>) {
    let count = -1
    const fullIdx = patterns.findIndex(p => { if (!p._deleted) count++; return count === visIdx })
    if (fullIdx === -1) return
    setPatterns(ps => ps.map((p, i) => i === fullIdx ? { ...p, ...vals } : p))
  }

  function removePatternAt(visIdx: number) {
    let count = -1
    const fullIdx = patterns.findIndex(p => { if (!p._deleted) count++; return count === visIdx })
    if (fullIdx === -1) return
    const p = patterns[fullIdx]
    if (p.id) setPatterns(ps => ps.map((pp, i) => i === fullIdx ? { ...pp, _deleted: true } : pp))
    else setPatterns(ps => ps.filter((_, i) => i !== fullIdx))
  }

  async function handleSave() {
    const hasValid = visiblePatterns.some(p => p.pattern.trim())
    if (!name.trim() || !hasValid || !categoryId) return
    setSaving(true)
    try {
      if (!isEdit) {
        await createRule({
          data: {
            name: name.trim(), categoryId, priority,
            patterns: visiblePatterns.filter(p => p.pattern.trim())
              .map(p => ({ pattern: p.pattern, field: p.field, matchType: p.matchType })),
          },
        })
      } else {
        await updateRule({ data: { id: rule.id, name: name.trim(), categoryId, priority } })
        for (const p of patterns) {
          if (p._deleted && p.id) {
            await deletePattern({ data: p.id })
          } else if (!p._deleted && p.id) {
            const orig = rule.patterns.find(op => op.id === p.id)
            if (orig && (orig.pattern !== p.pattern || orig.field !== p.field || orig.matchType !== p.matchType))
              await updatePattern({ data: { id: p.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
          } else if (!p._deleted && !p.id && p.pattern.trim()) {
            await addPattern({ data: { ruleId: rule.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
          }
        }
      }
      onSaved()
    } finally { setSaving(false) }
  }

  const selectedCategory = categories.find(c => c.id === categoryId)
  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0
  const canSave = name.trim() && visiblePatterns.some(p => p.pattern.trim()) && categoryId

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="rule-name">Rule name</Label>
        <Input
          id="rule-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Groceries, Streaming services"
          autoFocus={!isEdit}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={String(categoryId)} onValueChange={v => v && setCategoryId(Number(v))}>
            <SelectTrigger>
              <SelectValue>
                {selectedCategory
                  ? <span className="flex items-center gap-2"><CategoryDot category={selectedCategory} />{selectedCategory.name}</span>
                  : "Select…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="flex items-center gap-2"><CategoryDot category={c} />{c.name}</span>
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
            onChange={e => setPriority(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <Label>Patterns</Label>
          <span className="text-xs text-muted-foreground">matches if ANY pattern matches</span>
        </div>
        <div className="space-y-2">
          {visiblePatterns.map((p, visIdx) => (
            <div key={p.id ?? `new-${visIdx}`} className="flex gap-2">
              <Input
                className="font-mono text-sm flex-1"
                value={p.pattern}
                placeholder="e.g. ALDI"
                onChange={e => updatePatternAt(visIdx, { pattern: e.target.value })}
              />
              <Select value={p.field} onValueChange={v => v && updatePatternAt(visIdx, { field: v as RulePattern["field"] })}>
                <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={p.matchType} onValueChange={v => v && updatePatternAt(visIdx, { matchType: v as RulePattern["matchType"] })}>
                <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {visiblePatterns.length > 1 && (
                <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removePatternAt(visIdx)}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
            onClick={() => setPatterns(ps => [...ps, { pattern: "", field: "description", matchType: "contains" }])}>
            <Plus className="size-3" /> Add another pattern
          </Button>
        </div>
      </div>

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

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ preview, previewing, manualCount, patternCount }: {
  preview: { count: number; capped: boolean; transactions: PreviewTx[] } | null
  previewing: boolean; manualCount: number; patternCount?: number
}) {
  const scope = patternCount && patternCount > 1 ? ` across ${patternCount} patterns` : ""
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Search className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          {previewing
            ? "Searching…"
            : preview
              ? `${preview.count}${preview.capped ? "+" : ""} matching transaction${preview.count !== 1 ? "s" : ""}${scope}${manualCount > 0 ? ` · ${manualCount} manual` : ""}`
              : "No matches"}
        </span>
        {manualCount > 0 && !previewing && <AlertTriangle className="size-3 text-warning shrink-0" />}
      </div>
      {preview && preview.transactions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="py-1.5 text-xs">Date</TableHead>
                  <TableHead className="py-1.5 text-xs">Payee</TableHead>
                  <TableHead className="py-1.5 text-xs text-right">Amount</TableHead>
                  <TableHead className="py-1.5 text-xs">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.transactions.map(tx => (
                  <TableRow key={tx.id} className={cn(tx.categorisedBy === "manual" && "opacity-40")}>
                    <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.bookingDate)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs max-w-xs truncate">
                      {tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}
                    </TableCell>
                    <TableCell className={cn("py-1.5 text-xs text-right tabular-nums whitespace-nowrap", tx.amount >= 0 && "text-positive")}>
                      {formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      {tx.category
                        ? <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: tx.category.color }} />
                          {tx.category.name}
                          {tx.categorisedBy === "manual" && <span className="text-muted-foreground">(manual)</span>}
                        </span>
                        : <span className="text-muted-foreground">Uncategorised</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
