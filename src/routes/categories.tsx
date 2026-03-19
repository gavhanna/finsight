import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getCategoriesWithRules, createCategory, deleteCategory, updateCategory } from "../server/fn/categories"
import { recategoriseAll } from "../server/fn/transactions"
import { Plus, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: () => getCategoriesWithRules(),
})

const COLORS = [
  "#22c55e","#f97316","#a855f7","#3b82f6","#ec4899",
  "#f59e0b","#14b8a6","#10b981","#6b7280","#8b5cf6",
  "#d97706","#94a3b8","#ef4444","#06b6d4","#84cc16",
]

const TYPE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  income: "default",
  transfer: "secondary",
  expense: "outline",
}

function CategoriesPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [newCat, setNewCat] = useState({ name: "", color: "#94a3b8", type: "expense" as "expense" | "income" | "transfer" })
  const [recatResult, setRecatResult] = useState<{ updated: number; total: number } | null>(null)
  const [recatting, setRecatting] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState({ name: "", color: "#94a3b8", type: "expense" as "expense" | "income" | "transfer" })

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

  function startEdit(cat: typeof categories[number]) {
    setEditId(cat.id)
    setEditFields({ name: cat.name, color: cat.color, type: cat.type as any })
  }

  async function handleUpdateCategory() {
    if (!editFields.name.trim() || editId === null) return
    await updateCategory({ data: { id: editId, ...editFields } })
    setEditId(null)
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
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage spending categories. Add keyword rules under <strong>Rules</strong>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handleRecategorise} disabled={recatting} size="sm" className="sm:size-auto">
            <RefreshCw className={`h-4 w-4 ${recatting ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Re-categorise All</span>
            <span className="sm:hidden">Re-categorise</span>
          </Button>
          <Button onClick={() => setShowNew(true)} size="sm" className="sm:size-auto">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {recatResult && (
        <div className="mb-4 rounded-md bg-positive-muted border border-positive/20 px-4 py-3 text-sm text-positive">
          Re-categorised {recatResult.updated} of {recatResult.total} transactions.
        </div>
      )}

      {showNew && (
        <div className="mb-4 rounded-lg border p-4 space-y-3">
          <h3 className="font-medium text-sm">New Category</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={newCat.name}
              onChange={(e) => setNewCat((f) => ({ ...f, name: e.target.value }))}
              placeholder="Category name"
              autoFocus
              className="flex-1"
            />
            <Select value={newCat.type} onValueChange={(v) => v && setNewCat((f) => ({ ...f, type: v as any }))}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
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
            <Button onClick={handleCreateCategory}>Create</Button>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) =>
              editId === cat.id ? (
                <TableRow key={cat.id}>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col gap-3 py-1">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={editFields.name}
                          onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                          autoFocus
                          className="flex-1"
                        />
                        <Select value={editFields.type} onValueChange={(v) => v && setEditFields((f) => ({ ...f, type: v as any }))}>
                          <SelectTrigger className="w-full sm:w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditFields((f) => ({ ...f, color: c }))}
                            className={`h-6 w-6 rounded-full transition-transform ${editFields.color === c ? "scale-125 ring-2 ring-offset-2 ring-ring" : ""}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateCategory}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
              <TableRow key={cat.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[cat.type] ?? "outline"} className="capitalize">
                    {cat.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{cat.rules}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(cat)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
