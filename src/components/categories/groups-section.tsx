import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createCategoryGroup, updateCategoryGroup, deleteCategoryGroup } from "@/server/fn/categories"
import { ColorPicker } from "./color-picker"
import type { getCategoryGroups, getCategoriesWithRules } from "@/server/fn/categories"

type Group = Awaited<ReturnType<typeof getCategoryGroups>>[number]
type CategoryWithRules = Awaited<ReturnType<typeof getCategoriesWithRules>>[number]

export function GroupsSection({
  groups,
  categories,
  onRefresh,
}: {
  groups: Group[]
  categories: CategoryWithRules[]
  onRefresh: () => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: "", color: "#94a3b8" })
  const [editId, setEditId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState({ name: "", color: "#94a3b8" })

  async function handleCreate() {
    if (!newGroup.name.trim()) return
    await createCategoryGroup({ data: newGroup })
    setNewGroup({ name: "", color: "#94a3b8" })
    setShowNew(false)
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this group? Categories in it will become ungrouped.")) return
    await deleteCategoryGroup({ data: id })
    onRefresh()
  }

  async function handleUpdate() {
    if (!editFields.name.trim() || editId === null) return
    await updateCategoryGroup({ data: { id: editId, ...editFields } })
    setEditId(null)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Groups</h2>
        {!showNew && (
          <Button variant="ghost" size="sm" onClick={() => setShowNew(true)} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add group
          </Button>
        )}
      </div>

      {showNew && (
        <div className="mb-3 rounded-lg border p-3 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newGroup.name}
              onChange={(e) => setNewGroup((f) => ({ ...f, name: e.target.value }))}
              placeholder="Group name"
              autoFocus
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <ColorPicker size="sm" value={newGroup.color} onChange={(c) => setNewGroup((f) => ({ ...f, color: c }))} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showNew ? (
        <p className="text-sm text-muted-foreground">No groups yet. Create one to organise categories on the trends chart.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {groups.map((group) =>
            editId === group.id ? (
              <div key={group.id} className="p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                  />
                </div>
                <ColorPicker size="sm" value={editFields.color} onChange={(c) => setEditFields((f) => ({ ...f, color: c }))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdate}><Check className="h-3.5 w-3.5 mr-1" />Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
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
                    onClick={() => { setEditId(group.id); setEditFields({ name: group.name, color: group.color }) }}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleDelete(group.id)}
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
  )
}
