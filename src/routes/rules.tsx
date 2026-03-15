import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import {
  getAllRules,
  getCategories,
  createRule,
  deleteRule,
  previewRule,
  applyRuleToHistory,
} from "../server/fn/categories"
import type { Category, CategoryRule } from "../db/schema"
import { Plus, Trash2, Search, CheckCircle2 } from "lucide-react"
import { formatCurrency, formatDate } from "../lib/utils"

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

export const Route = createFileRoute("/rules")({
  component: RulesPage,
  loader: async () => {
    const [rules, cats] = await Promise.all([getAllRules(), getCategories()])
    return { rules, categories: cats }
  },
})

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

function RulesPage() {
  const { rules, categories } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  async function handleDelete(id: number) {
    if (!confirm("Delete this rule?")) return
    await deleteRule({ data: id })
    router.invalidate()
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Keyword rules for automatic transaction categorisation. Higher priority runs first.
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
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Pattern</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Field</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Match</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Priority</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono font-medium">{rule.pattern}</td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{FIELDS.find(f => f.value === rule.field)?.label ?? rule.field}</td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{rule.matchType}</td>
                  <td className="px-4 py-2.5">
                    {rule.category ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.category.color }} />
                        {rule.category.name}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{rule.priority}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
  const [form, setForm] = useState({
    pattern: "",
    field: "description" as CategoryRule["field"],
    matchType: "contains" as CategoryRule["matchType"],
    categoryId: categories[0]?.id ?? 0,
    priority: 0,
  })
  const [applyToHistory, setApplyToHistory] = useState(true)
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!form.pattern.trim()) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const result = await previewRule({ data: { pattern: form.pattern, field: form.field, matchType: form.matchType } })
        setPreview(result)
      } finally {
        setPreviewing(false)
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.pattern, form.field, form.matchType])

  async function handleSave() {
    if (!form.pattern.trim() || !form.categoryId) return
    setSaving(true)
    try {
      const rule = await createRule({ data: form })
      if (applyToHistory) {
        await applyRuleToHistory({ data: { ruleId: rule.id, categoryId: form.categoryId } })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0
  const affectedCount = (preview?.count ?? 0) - manualCount

  return (
    <div className="mb-6 rounded-lg border p-4 space-y-4">
      <h3 className="font-medium">New Rule</h3>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Pattern</label>
          <input
            type="text"
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
            placeholder="e.g. ALDI, SUPERVALU, NETFLIX"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Field</label>
          <select
            value={form.field}
            onChange={(e) => setForm((f) => ({ ...f, field: e.target.value as any }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Match type</label>
          <select
            value={form.matchType}
            onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value as any }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: Number(e.target.value) }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
          <input
            type="number"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Preview */}
      {form.pattern.trim() && (
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
            <div className="rounded-md border overflow-hidden max-h-60 overflow-y-auto">
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
                            {tx.categorisedBy === "manual" && <span className="text-muted-foreground">(manual)</span>}
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
      )}

      {/* Apply to history checkbox */}
      {preview && affectedCount > 0 && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToHistory}
            onChange={(e) => setApplyToHistory(e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          <span className="text-sm">
            Apply to {affectedCount} historical transaction{affectedCount !== 1 ? "s" : ""}
          </span>
          {applyToHistory && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Will update
            </span>
          )}
        </label>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !form.pattern.trim() || !form.categoryId}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Rule"}
        </button>
        <button
          onClick={onClose}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
