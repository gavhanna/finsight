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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

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
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
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
    <Card>
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}

          {editingName ? (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                className="h-7 text-sm font-medium w-48"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={saveName}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingName(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </span>
          ) : (
            <span className="font-medium text-sm truncate">{rule.name}</span>
          )}
        </button>

        <span className="text-xs text-muted-foreground">{rule.patterns.length} pattern{rule.patterns.length !== 1 ? "s" : ""}</span>

        {/* Category badge */}
        {editingCat ? (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Select value={String(catVal)} onValueChange={(v) => v && setCatVal(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-36" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={saveCat}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingCat(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
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

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setEditingName(true); setNameVal(rule.name) }}
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
              <Button onClick={handleApply} disabled={applying}>
                <CheckCircle2 className="h-4 w-4" />
                {applying ? "Applying…" : "Apply Now"}
              </Button>
            )}
            {applyResult !== null && (
              <p className="text-xs text-green-600">Updated {applyResult} transaction{applyResult !== 1 ? "s" : ""}.</p>
            )}
          </div>
        </div>
      )}
    </Card>
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
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/10">
      <div className="space-y-2">
        <Input
          className="font-mono text-sm w-full"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select value={form.field} onValueChange={(v) => v && setForm(f => ({ ...f, field: v as any }))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.matchType} onValueChange={(v) => v && setForm(f => ({ ...f, matchType: v as any }))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1 col-span-2 sm:col-span-1">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
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
      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" /> Add pattern
      </Button>
    )
  }

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-3 gap-2">
        <Input
          className="col-span-3 font-mono text-sm"
          placeholder="e.g. ALDI, SUPERVALU"
          value={form.pattern}
          onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={(v) => v && setForm(f => ({ ...f, field: v as any }))}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={(v) => v && setForm(f => ({ ...f, matchType: v as any }))}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button size="sm" className="flex-1 h-8 text-xs" disabled={!form.pattern.trim()} onClick={handleAdd}>Add</Button>
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
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
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60">
              <TableRow>
                <TableHead className="py-1.5 text-xs">Date</TableHead>
                <TableHead className="py-1.5 text-xs">Payee / Description</TableHead>
                <TableHead className="py-1.5 text-xs text-right">Amount</TableHead>
                <TableHead className="py-1.5 text-xs">Current category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.transactions.map((tx) => (
                <TableRow key={tx.id} className={tx.categorisedBy === "manual" ? "opacity-50" : ""}>
                  <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(tx.bookingDate)}</TableCell>
                  <TableCell className="py-1.5 text-xs max-w-xs truncate">{tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}</TableCell>
                  <TableCell className={`py-1.5 text-xs text-right tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-green-600" : ""}`}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">
                    {tx.category ? (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tx.category.color }} />
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

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Rule name</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries, Streaming services"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={String(categoryId)} onValueChange={(v) => v && setCategoryId(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          Patterns <span className="text-muted-foreground font-normal text-xs">(transaction matches if ANY pattern matches)</span>
        </Label>
        <div className="space-y-2">
          {patterns.map((p, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-2 sm:border-0 sm:p-0">
              <Input
                className={`font-mono text-sm ${activePatternIdx === idx ? "ring-2 ring-ring" : ""}`}
                value={p.pattern}
                placeholder="e.g. ALDI"
                onChange={(e) => updatePattern(idx, { pattern: e.target.value })}
                onFocus={() => setActivePatternIdx(idx)}
              />
              <div className="flex gap-2">
                <Select value={p.field} onValueChange={(v) => v && updatePattern(idx, { field: v as any })}>
                  <SelectTrigger className="flex-1" onFocus={() => setActivePatternIdx(idx)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={p.matchType} onValueChange={(v) => v && updatePattern(idx, { matchType: v as any })}>
                  <SelectTrigger className="flex-1" onFocus={() => setActivePatternIdx(idx)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {patterns.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => { setPatterns(ps => ps.filter((_, i) => i !== idx)); setActivePatternIdx(0) }}
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
            onClick={() => {
              setPatterns(ps => [...ps, { pattern: "", field: "description", matchType: "contains" }])
              setActivePatternIdx(patterns.length)
            }}
          >
            <Plus className="h-3 w-3" /> Add another pattern
          </Button>
        </div>
      </div>

      {active?.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || !patterns.some(p => p.pattern.trim())}
        >
          {saving ? "Saving…" : "Save Rule"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}
