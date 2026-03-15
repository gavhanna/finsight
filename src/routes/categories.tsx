import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getCategoriesWithRules, createCategory, deleteCategory } from "../server/fn/categories"
import { recategoriseAll } from "../server/fn/transactions"
import { Plus, Trash2, RefreshCw } from "lucide-react"

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
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage spending categories. Add keyword rules under <strong>Rules</strong>.</p>
        </div>
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
            <button onClick={handleCreateCategory} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Create
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rules</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground capitalize">{cat.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{cat.rules.length}</td>
                <td className="px-4 py-2.5 text-right">
                  {!cat.isDefault && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
