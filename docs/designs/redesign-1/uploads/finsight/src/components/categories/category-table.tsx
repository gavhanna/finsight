import { useState } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { updateCategory, deleteCategory, assignCategoryGroup } from "@/server/fn/categories"
import { ColorPicker } from "./color-picker"
import type { getCategoriesWithRules, getCategoryGroups } from "@/server/fn/categories"

type CategoryWithRules = Awaited<ReturnType<typeof getCategoriesWithRules>>[number]
type Group = Awaited<ReturnType<typeof getCategoryGroups>>[number]
type CategoryType = "expense" | "income" | "transfer"

const TYPE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  income: "default",
  transfer: "secondary",
  expense: "outline",
}

export function CategoryTable({
  rawCategories,
  groups,
  onRefresh,
}: {
  rawCategories: CategoryWithRules[]
  groups: Group[]
  onRefresh: () => void
}) {
  const { sorted: categories, sortKey, sortDir, toggle } = useSortable(rawCategories, "name")
  const [editId, setEditId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState({ name: "", color: "#94a3b8", type: "expense" as CategoryType })

  function startEdit(cat: CategoryWithRules) {
    setEditId(cat.id)
    setEditFields({ name: cat.name, color: cat.color, type: cat.type as CategoryType })
  }

  async function handleUpdate() {
    if (!editFields.name.trim() || editId === null) return
    await updateCategory({ data: { id: editId, ...editFields } })
    setEditId(null)
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category? Transactions will become uncategorised.")) return
    await deleteCategory({ data: id })
    onRefresh()
  }

  async function handleAssignGroup(categoryId: number, groupId: number | null) {
    await assignCategoryGroup({ data: { categoryId, groupId } })
    onRefresh()
  }

  return (
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
                      <Select value={editFields.type} onValueChange={(v) => v && setEditFields((f) => ({ ...f, type: v as CategoryType }))}>
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
                    <ColorPicker value={editFields.color} onChange={(c) => setEditFields((f) => ({ ...f, color: c }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdate}>
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
                      <SelectValue placeholder="—">
                        {cat.groupId != null
                          ? (() => { const g = groups.find(g => g.id === cat.groupId); return g ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />{g.name}</span> : "—" })()
                          : <span className="text-muted-foreground">—</span>}
                      </SelectValue>
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
                      variant="ghost" size="icon"
                      onClick={() => startEdit(cat)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => handleDelete(cat.id)}
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
  )
}
