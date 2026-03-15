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
  applyRuleToHistory,
} from "../server/fn/categories"
import type { Category, Rule, RulePattern } from "../db/schema"
import { Plus, Trash2, Pencil, Search, CheckCircle2, ChevronDown, ChevronRight, X, Check } from "lucide-react"
import { formatCurrency, formatDate } from "../lib/utils"

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
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Named rules with one or more patterns for auto-categorisation. Higher priority runs first.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {showNew && (
        <NewRuleForm
          categories={categories}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); router.invalidate() }}
        />
      )}

      {rules.length === 0 && !showNew ? (
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
    </div>
  )
}

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
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(rule.name)
  const [editingCat, setEditingCat] = useState(false)
  const [catVal, setCatVal] = useState(rule.categoryId)
  const [applyToHistory, setApplyToHistory] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)

  async function saveName() {
    if (nameVal.trim() && nameVal !== rule.name) {
      await updateRule({ data: { id: rule.id, name: nameVal.trim() } })
      onRefresh()
    }
    setEditingName(false)
  }

  async function saveCat() {
    if (catVal !== rule.categoryId) {
      await updateRule({ data: { id: rule.id, categoryId: catVal } })
      onRefresh()
    }
    setEditingCat(false)
  }

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
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}

          {/* Editable name */}
          {editingName ? (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                className="rounded border bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
                autoFocus
              />
              <button onClick={saveName} className="text-green-600 hover:text-green-700 p-0.5"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground p-0.5"><X className="h-3.5 w-3.5" /></button>
            </span>
          ) : (
            <span className="font-medium text-sm truncate">{rule.name}</span>
          )}
        </button>

        <span className="text-xs text-muted-foreground">{rule.patterns.length} pattern{rule.patterns.length !== 1 ? "s" : ""}</span>

        {/* Category badge */}
        {editingCat ? (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <select
              className="rounded border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={catVal}
              onChange={(e) => setCatVal(Number(e.target.value))}
              autoFocus
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={saveCat} className="text-green-600 hover:text-green-700 p-0.5"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditingCat(false)} className="text-muted-foreground p-0.5"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingCat(true) }}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            {rule.category && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.category.color }} />}
            {rule.category?.name ?? "No category"}
            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        )}

        <span className="text-xs text-muted-foreground">p={rule.priority}</span>

        <button
          onClick={(e) => { e.stopPropagation(); setEditingName(true); setNameVal(rule.name) }}
          className="text-muted-foreground hover:text-foreground p-1"
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded patterns + apply */}
      {isExpanded && (
        <div className="border-t p-3 space-y-3">
          <div className="space-y-1">
            {rule.patterns.map((p) => (
              <PatternRow
                key={p.id}
                pattern={p}
                onDelete={async () => { await deletePattern({ data: p.id }); onRefresh() }}
                onRefresh={onRefresh}
              />
            ))}
          </div>

          <AddPatternRow ruleId={rule.id} onSaved={onRefresh} />

          <div className="border-t pt-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyToHistory}
                onChange={(e) => { setApplyToHistory(e.target.checked); setApplyResult(null) }}
                className="h-4 w-4 rounded border"
              />
              <span className="text-sm">Apply to all historical transactions (non-manual)</span>
            </label>
            {applyToHistory && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                {applying ? "Applying…" : "Apply Now"}
              </button>
            )}
            {applyResult !== null && (
              <p className="text-xs text-green-600">Updated {applyResult} transaction{applyResult !== 1 ? "s" : ""}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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
      <div className="flex items-center gap-2 text-xs rounded bg-muted/40 px-2 py-1.5">
        <span className="font-mono font-medium">{pattern.pattern}</span>
        <span className="text-muted-foreground">in</span>
        <span className="text-muted-foreground">{FIELDS.find(f => f.value === pattern.field)?.label}</span>
        <span className="text-muted-foreground">({pattern.matchType})</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-0.5"><Pencil className="h-3 w-3" /></button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
    )
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-3 gap-2">
        <input
          className="col-span-3 rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.field} onChange={(e) => setForm(f => ({ ...f, field: e.target.value as any }))}>
          {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.matchType} onChange={(e) => setForm(f => ({ ...f, matchType: e.target.value as any }))}>
          {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={handleSave} className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</button>
          <button onClick={() => setEditing(false)} className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">Cancel</button>
        </div>
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
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3 w-3" /> Add pattern
      </button>
    )
  }

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-3 gap-2">
        <input
          className="col-span-3 rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. ALDI, SUPERVALU"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.field} onChange={(e) => setForm(f => ({ ...f, field: e.target.value as any }))}>
          {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.matchType} onChange={(e) => setForm(f => ({ ...f, matchType: e.target.value as any }))}>
          {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={handleAdd} disabled={!form.pattern.trim()} className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
          <button onClick={() => setOpen(false)} className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">Cancel</button>
        </div>
      </div>
      {form.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}
    </div>
  )
}

function PreviewTable({ preview, previewing, manualCount }: {
  preview: { count: number; capped: boolean; transactions: PreviewTx[] } | null
  previewing: boolean
  manualCount: number
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {previewing ? "Searching…" : preview
            ? `${preview.count}${preview.capped ? "+" : ""} matching transaction${preview.count !== 1 ? "s" : ""}${manualCount > 0 ? ` (${manualCount} manual — won't be overwritten)` : ""}`
            : "No matches"}
        </span>
      </div>
      {preview && preview.transactions.length > 0 && (
        <div className="rounded-md border overflow-hidden max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Payee / Description</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Current category</th>
              </tr>
            </thead>
            <tbody>
              {preview.transactions.map((tx) => (
                <tr key={tx.id} className={`border-t hover:bg-muted/20 ${tx.categorisedBy === "manual" ? "opacity-50" : ""}`}>
                  <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(tx.bookingDate)}</td>
                  <td className="px-3 py-1.5 max-w-xs truncate">{tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-green-600" : ""}`}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="px-3 py-1.5">
                    {tx.category ? (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tx.category.color }} />
                        {tx.category.name}
                        {tx.categorisedBy === "manual" && <span className="text-muted-foreground ml-1">(manual)</span>}
                      </span>
                    ) : <span className="text-muted-foreground">Uncategorised</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NewRuleForm({
  categories,
  onClose,
  onSaved,
}: {
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0)
  const [priority, setPriority] = useState(0)
  const [patterns, setPatterns] = useState([
    { pattern: "", field: "description" as RulePattern["field"], matchType: "contains" as RulePattern["matchType"] }
  ])
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activePatternIdx, setActivePatternIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = patterns[activePatternIdx]

  useEffect(() => {
    if (!active?.pattern.trim()) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewRule({ data: { pattern: active.pattern, field: active.field, matchType: active.matchType } })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [active?.pattern, active?.field, active?.matchType])

  function updatePattern(idx: number, vals: Partial<typeof patterns[0]>) {
    setPatterns(ps => ps.map((p, i) => i === idx ? { ...p, ...vals } : p))
    setActivePatternIdx(idx)
  }

  async function handleSave() {
    const validPatterns = patterns.filter(p => p.pattern.trim())
    if (!name.trim() || validPatterns.length === 0 || !categoryId) return
    setSaving(true)
    try {
      await createRule({ data: { name: name.trim(), categoryId, priority, patterns: validPatterns } })
      onSaved()
    } finally { setSaving(false) }
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="mb-6 rounded-lg border p-4 space-y-4">
      <h3 className="font-medium">New Rule</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Rule name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries, Streaming services"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Patterns <span className="text-muted-foreground/60">(transaction matches if ANY pattern matches)</span></label>
        <div className="space-y-2">
          {patterns.map((p, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-2 items-center">
              <input
                className={`rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring ${activePatternIdx === idx ? "ring-2 ring-ring" : ""}`}
                value={p.pattern}
                placeholder="e.g. ALDI"
                onChange={(e) => updatePattern(idx, { pattern: e.target.value })}
                onFocus={() => setActivePatternIdx(idx)}
              />
              <select
                className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={p.field}
                onChange={(e) => updatePattern(idx, { field: e.target.value as any })}
                onFocus={() => setActivePatternIdx(idx)}
              >
                {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <div className="flex gap-1">
                <select
                  className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={p.matchType}
                  onChange={(e) => updatePattern(idx, { matchType: e.target.value as any })}
                  onFocus={() => setActivePatternIdx(idx)}
                >
                  {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {patterns.length > 1 && (
                  <button
                    onClick={() => { setPatterns(ps => ps.filter((_, i) => i !== idx)); setActivePatternIdx(0) }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setPatterns(ps => [...ps, { pattern: "", field: "description", matchType: "contains" }])
              setActivePatternIdx(patterns.length)
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add another pattern
          </button>
        </div>
      </div>

      {active?.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !patterns.some(p => p.pattern.trim())}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Rule"}
        </button>
        <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
