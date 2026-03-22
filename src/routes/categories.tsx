import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import {
  getCategoriesWithRules, createCategory, deleteCategory, updateCategory,
  getCategoryGroups, createCategoryGroup, updateCategoryGroup, deleteCategoryGroup, assignCategoryGroup,
} from "../server/fn/categories"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: async () => {
    const [categories, groups] = await Promise.all([getCategoriesWithRules(), getCategoryGroups()])
    return { categories, groups }
  },
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
  const { categories: rawCategories, groups } = Route.useLoaderData()
  const { sorted: categories, sortKey, sortDir, toggle } = useSortable(rawCategories, "name")
  const router = useRouter()

  // Category state
  const [showNew, setShowNew] = useState(false)
  const [newCat, setNewCat] = useState({ name: "", color: "#94a3b8", type: "expense" as "expense" | "income" | "transfer" })
  const [editId, setEditId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState({ name: "", color: "#94a3b8", type: "expense" as "expense" | "income" | "transfer" })

  // Group state
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: "", color: "#94a3b8" })
  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [editGroupFields, setEditGroupFields] = useState({ name: "", color: "#94a3b8" })

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

  async function handleAssignGroup(categoryId: number, groupId: number | null) {
    await assignCategoryGroup({ data: { categoryId, groupId } })
    router.invalidate()
  }

  async function handleCreateGroup() {
    if (!newGroup.name.trim()) return
    await createCategoryGroup({ data: newGroup })
    setNewGroup({ name: "", color: "#94a3b8" })
    setShowNewGroup(false)
    router.invalidate()
  }

  async function handleDeleteGroup(id: number) {
    if (!confirm("Delete this group? Categories in it will become ungrouped.")) return
    await deleteCategoryGroup({ data: id })
    router.invalidate()
  }

  async function handleUpdateGroup() {
    if (!editGroupFields.name.trim() || editGroupId === null) return
    await updateCategoryGroup({ data: { id: editGroupId, ...editGroupFields } })
    setEditGroupId(null)
    router.invalidate()
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage spending categories. Add keyword rules under <strong>Rules</strong>.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Groups section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Groups</h2>
          {!showNewGroup && (
            <Button variant="ghost" size="sm" onClick={() => setShowNewGroup(true)} className="h-7 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add group
            </Button>
          )}
        </div>

        {showNewGroup && (
          <div className="mb-3 rounded-lg border p-3 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newGroup.name}
                onChange={(e) => setNewGroup((f) => ({ ...f, name: e.target.value }))}
                placeholder="Group name"
                autoFocus
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewGroup((f) => ({ ...f, color: c }))}
                  className={`h-5 w-5 rounded-full transition-transform ${newGroup.color === c ? "scale-125 ring-2 ring-offset-1 ring-ring" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateGroup}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewGroup(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {groups.length === 0 && !showNewGroup ? (
          <p className="text-sm text-muted-foreground">No groups yet. Create one to organise categories on the trends chart.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {groups.map((group) =>
              editGroupId === group.id ? (
                <div key={group.id} className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={editGroupFields.name}
                      onChange={(e) => setEditGroupFields((f) => ({ ...f, name: e.target.value }))}
                      autoFocus
                      className="flex-1 h-8 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateGroup()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditGroupFields((f) => ({ ...f, color: c }))}
                        className={`h-5 w-5 rounded-full transition-transform ${editGroupFields.color === c ? "scale-125 ring-2 ring-offset-1 ring-ring" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdateGroup}><Check className="h-3.5 w-3.5 mr-1" />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditGroupId(null)}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={group.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {categories.filter((c) => c.groupId === group.id).length} categories
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { setEditGroupId(group.id); setEditGroupFields({ name: group.name, color: group.color }) }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* New category form */}
      {showNew && (
        <div className="rounded-lg border p-4 space-y-3">
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

      {/* Categories table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead id="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Category</SortableHead>
              <SortableHead id="type" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Type</SortableHead>
              <TableHead>Group</TableHead>
              <SortableHead id="transactionCount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden sm:table-cell">Transactions</SortableHead>
              <SortableHead id="rules" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="hidden sm:table-cell">Rules</SortableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) =>
              editId === cat.id ? (
                <TableRow key={cat.id}>
                  <TableCell colSpan={6}>
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
                <TableCell>
                  <Select
                    value={cat.groupId != null ? String(cat.groupId) : "none"}
                    onValueChange={(v) => handleAssignGroup(cat.id, v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs border-0 shadow-none px-1.5 focus:ring-0">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><span className="text-muted-foreground">—</span></SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {cat.transactionCount > 0 ? cat.transactionCount.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{cat.rules}</TableCell>
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
