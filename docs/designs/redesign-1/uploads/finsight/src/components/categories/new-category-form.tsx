import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "./color-picker"

type CategoryType = "expense" | "income" | "transfer"

export function NewCategoryForm({
  onSave,
  onCancel,
}: {
  onSave: (data: { name: string; color: string; type: CategoryType }) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({ name: "", color: "#94a3b8", type: "expense" as CategoryType })

  async function handleSave() {
    if (!form.name.trim()) return
    await onSave(form)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-medium text-sm">New Category</h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Category name"
          autoFocus
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <Select value={form.type} onValueChange={(v) => v && setForm((f) => ({ ...f, type: v as CategoryType }))}>
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
        <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave}>Create</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
