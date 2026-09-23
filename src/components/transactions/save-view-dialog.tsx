import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createSavedView } from "@/server/fn/saved-views"

export function SaveViewDialog({ open, onOpenChange, definition, onSaved, scope = "transactions" }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: Record<string, string | number | boolean | string[]>
  onSaved: () => void
  scope?: "transactions" | "explore"
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) { setName(""); setError("") }
    onOpenChange(nextOpen)
  }

  async function save() {
    if (!name.trim()) { setError("Give this view a name."); return }
    setSaving(true)
    try {
      await createSavedView({ data: { scope, name: name.trim(), definition } })
      onSaved()
      changeOpen(false)
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save current filters</DialogTitle>
        <DialogDescription>Keep this combination of filters available above the transaction table.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="saved-view-name">View name</FieldLabel>
        <Input id="saved-view-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Eating out this month" autoFocus />
        <FieldDescription>Saving a name again updates the existing view.</FieldDescription>
        <FieldError>{error}</FieldError>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save view"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
