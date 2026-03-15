import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import {
  getCategoriesWithRules,
  createCategory,
  deleteCategory,
  createRule,
  deleteRule,
} from "../server/fn/categories"
import { recategoriseAll } from "../server/fn/transactions"
import type { Category, CategoryRule } from "../db/schema"
import { Plus, Trash2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"

type CategoryWithRules = Category & { rules: CategoryRule[] }

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: () => getCategoriesWithRules(),
})

const COLORS = [
  "#22c55e","#f97316","#a855f7","#3b82f6","#ec4899",
  "#f59e0b","#14b8a6","#10b981","#6b7280","#8b5cf6",
  "#d97706","#94a3b8","#ef4444","#06b6d4","#84cc16",
]

function CategoriesPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newCat, setNewCat] = useState({ name: "", color: "#94a3b8", type: "expense" as "expense"|"income"|"transfer" })
  const [recatResult, setRecatResult] = useState<{ updated: number; total: number } | null>(null)
  const [recatting, setRecatting] = useState(false)

  async function handleCreateCategory() {
    if (!newCat.name.trim()) return
    await createCategory({ data: newCat })
    setNewCat({ name: "", color: "#94a3b8", type: "expense" })
    setShowNew(false)
    router.invalidate()
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm("Delete this category? Transactions will become uncategorised.")) return
    await deleteCategory({ data: id })
    router.invalidate()
  }

  async function handleRecategorise() {
    setRecatting(true)
    setRecatResult(null)
    const result = await recategoriseAll()
    setRecatResult(result)
    setRecatting(false)
    router.invalidate()
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRecategorise}
            disabled={recatting}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${recatting ? "animate-spin" : ""}`} />
            Re-categorise All
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Category
          </button>
        </div>
      </div>

      {recatResult && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Re-categorised {recatResult.updated} of {recatResult.total} transactions.
        </div>
      )}

      {showNew && (
        <div className="mb-4 rounded-lg border p-4 space-y-3">
          <h3 className="font-medium text-sm">New Category</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newCat.name}
              onChange={(e) => setNewCat((f) => ({ ...f, name: e.target.value }))}
              placeholder="Category name"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <select
              value={newCat.type}
              onChange={(e) => setNewCat((f) => ({ ...f, type: e.target.value as any }))}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCat((f) => ({ ...f, color: c }))}
                  className={`h-6 w-6 rounded-full transition-transform ${newCat.color === c ? "scale-125 ring-2 ring-offset-2 ring-ring" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateCategory}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            isExpanded={expanded === cat.id}
            onToggle={() => setExpanded(expanded === cat.id ? null : cat.id)}
            onDelete={() => handleDeleteCategory(cat.id)}
            onRefresh={() => router.invalidate()}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  isExpanded,
  onToggle,
  onDelete,
  onRefresh,
}: {
  category: CategoryWithRules
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const [showNewRule, setShowNewRule] = useState(false)
  const [newRule, setNewRule] = useState({
    pattern: "",
    field: "description" as CategoryRule["field"],
    matchType: "contains" as CategoryRule["matchType"],
    priority: 0,
  })

  async function handleCreateRule() {
    if (!newRule.pattern.trim()) return
    await createRule({ data: { ...newRule, categoryId: category.id } })
    setNewRule({ pattern: "", field: "description", matchType: "contains", priority: 0 })
    setShowNewRule(false)
    onRefresh()
  }

  async function handleDeleteRule(id: number) {
    await deleteRule({ data: id })
    onRefresh()
  }

  return (
    <div className="rounded-lg border">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
        <span className="flex-1 font-medium text-sm">{category.name}</span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full capitalize">{category.type}</span>
        <span className="text-xs text-muted-foreground">{category.rules.length} rules</span>
        {!category.isDefault && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-muted-foreground hover:text-destructive p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>

      {isExpanded && (
        <div className="border-t p-3 space-y-2">
          {category.rules.length === 0 && !showNewRule && (
            <p className="text-xs text-muted-foreground">No rules yet.</p>
          )}
          {category.rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onDelete={() => handleDeleteRule(rule.id)} />
          ))}

          {showNewRule ? (
            <div className="rounded-md border p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule((f) => ({ ...f, pattern: e.target.value }))}
                  placeholder="Pattern (e.g. TESCO)"
                  className="col-span-2 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <select
                  value={newRule.field}
                  onChange={(e) => setNewRule((f) => ({ ...f, field: e.target.value as any }))}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="description">Description</option>
                  <option value="creditorName">Creditor Name</option>
                  <option value="debtorName">Debtor Name</option>
                  <option value="merchantCategoryCode">MCC</option>
                </select>
                <select
                  value={newRule.matchType}
                  onChange={(e) => setNewRule((f) => ({ ...f, matchType: e.target.value as any }))}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact</option>
                  <option value="startsWith">Starts with</option>
                </select>
                <input
                  type="number"
                  value={newRule.priority}
                  onChange={(e) => setNewRule((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="Priority"
                  className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateRule} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  Add Rule
                </button>
                <button onClick={() => setShowNewRule(false)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewRule(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add Rule
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function RuleRow({ rule, onDelete }: { rule: CategoryRule; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground rounded bg-muted/40 px-2 py-1.5">
      <span className="font-medium text-foreground">{rule.pattern}</span>
      <span>in</span>
      <span>{rule.field}</span>
      <span>({rule.matchType})</span>
      <span className="ml-auto text-xs">p={rule.priority}</span>
      <button onClick={onDelete} className="hover:text-destructive ml-1">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}
