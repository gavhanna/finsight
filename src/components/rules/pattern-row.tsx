import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Pencil, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addPattern, updatePattern, previewRule } from "@/server/fn/categories"
import type { RulePattern } from "@/db/schema"
import { FIELDS, MATCH_TYPES, fieldLabel, matchLabel } from "./types"
import type { PreviewTx } from "./types"
import { PreviewTable } from "./preview-table"

export function PatternRow({ pattern, onDelete, onRefresh }: {
  pattern: RulePattern; onDelete: () => void; onRefresh: () => void
}) {
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

  function handleCancel() {
    setEditing(false)
    setForm({ pattern: pattern.pattern, field: pattern.field, matchType: pattern.matchType })
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group transition-colors">
        <code className="text-xs font-mono font-semibold text-foreground">{pattern.pattern}</code>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{fieldLabel(pattern.field)}</span>
        <span className="text-muted-foreground/40 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{matchLabel(pattern.matchType)}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
    )
  }

  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3 my-1">
      <div className="flex gap-2">
        <Input
          className="font-mono text-sm flex-1"
          value={form.pattern}
          onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={v => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
          <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={v => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
          <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={handleSave} disabled={!form.pattern.trim()}>
          <Check className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9" onClick={handleCancel}>
          <X className="size-3.5" />
        </Button>
      </div>
      {form.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}
    </div>
  )
}

export function AddPatternRow({ ruleId, onSaved }: { ruleId: number; onSaved: () => void }) {
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
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
      >
        <Plus className="size-3" /> Add pattern
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3 mt-1">
      <div className="flex gap-2 flex-wrap">
        <Input
          className="font-mono text-sm flex-1 min-w-lg"
          placeholder="e.g. ALDI"
          value={form.pattern}
          onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
          autoFocus
        />
        <Select value={form.field} onValueChange={v => v && setForm(f => ({ ...f, field: v as RulePattern["field"] }))}>
          <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={form.matchType} onValueChange={v => v && setForm(f => ({ ...f, matchType: v as RulePattern["matchType"] }))}>
          <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" disabled={!form.pattern.trim()} onClick={handleAdd}>Add</Button>
        <Button size="sm" variant="ghost" className="h-9" onClick={() => { setOpen(false); setForm({ pattern: "", field: "description", matchType: "contains" }) }}>
          <X className="size-3.5" />
        </Button>
      </div>
      {form.pattern.trim() && (
        <PreviewTable preview={preview} previewing={previewing} manualCount={manualCount} />
      )}
    </div>
  )
}
