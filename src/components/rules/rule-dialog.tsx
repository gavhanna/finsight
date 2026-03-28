import { useState, useEffect, useRef } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  createRule, updateRule, addPattern, updatePattern, deletePattern, previewPatterns,
} from "@/server/fn/categories"
import type { Category, RulePattern } from "@/db/schema"
import type { RuleWithMeta, PatternDraft, PreviewTx } from "./types"
import { FIELDS, MATCH_TYPES } from "./types"
import { CategoryDot } from "./category-dot"
import { PreviewTable } from "./preview-table"

export function RuleDialog({ open, onOpenChange, rule, categories, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void
  rule?: RuleWithMeta; categories: Category[]; onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{rule ? "Edit Rule" : "New Rule"}</DialogTitle>
          <DialogDescription>
            {rule
              ? "Update the rule name, category, priority, or its match patterns."
              : "Add a name, choose a category, then define one or more patterns to match against your transactions."}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <RuleForm
            key={rule?.id ?? "new"}
            rule={rule}
            categories={categories}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RuleForm({ rule, categories, onClose, onSaved }: {
  rule?: RuleWithMeta; categories: Category[]
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!rule
  const [name, setName] = useState(rule?.name ?? "")
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? categories[0]?.id ?? 0)
  const [priority, setPriority] = useState(rule?.priority ?? 0)
  const [patterns, setPatterns] = useState<PatternDraft[]>(
    rule?.patterns.length
      ? rule.patterns.map(p => ({ id: p.id, pattern: p.pattern, field: p.field, matchType: p.matchType }))
      : [{ pattern: "", field: "description", matchType: "contains" }]
  )
  const [preview, setPreview] = useState<{ count: number; capped: boolean; transactions: PreviewTx[] } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visiblePatterns = patterns.filter(p => !p._deleted)
  const previewablePatterns = visiblePatterns.filter(p => p.pattern.trim())

  useEffect(() => {
    if (previewablePatterns.length === 0) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await previewPatterns({
          data: { patterns: previewablePatterns.map(p => ({ pattern: p.pattern, field: p.field, matchType: p.matchType })) },
        })
        setPreview(r)
      } finally { setPreviewing(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(previewablePatterns.map(p => [p.pattern, p.field, p.matchType]))])

  function updatePatternAt(visIdx: number, vals: Partial<PatternDraft>) {
    let count = -1
    const fullIdx = patterns.findIndex(p => { if (!p._deleted) count++; return count === visIdx })
    if (fullIdx === -1) return
    setPatterns(ps => ps.map((p, i) => i === fullIdx ? { ...p, ...vals } : p))
  }

  function removePatternAt(visIdx: number) {
    let count = -1
    const fullIdx = patterns.findIndex(p => { if (!p._deleted) count++; return count === visIdx })
    if (fullIdx === -1) return
    const p = patterns[fullIdx]
    if (p.id) setPatterns(ps => ps.map((pp, i) => i === fullIdx ? { ...pp, _deleted: true } : pp))
    else setPatterns(ps => ps.filter((_, i) => i !== fullIdx))
  }

  async function handleSave() {
    const hasValid = visiblePatterns.some(p => p.pattern.trim())
    if (!name.trim() || !hasValid || !categoryId) return
    setSaving(true)
    try {
      if (!isEdit) {
        await createRule({
          data: {
            name: name.trim(), categoryId, priority,
            patterns: visiblePatterns.filter(p => p.pattern.trim())
              .map(p => ({ pattern: p.pattern, field: p.field, matchType: p.matchType })),
          },
        })
      } else {
        await updateRule({ data: { id: rule.id, name: name.trim(), categoryId, priority } })
        for (const p of patterns) {
          if (p._deleted && p.id) {
            await deletePattern({ data: p.id })
          } else if (!p._deleted && p.id) {
            const orig = rule.patterns.find(op => op.id === p.id)
            if (orig && (orig.pattern !== p.pattern || orig.field !== p.field || orig.matchType !== p.matchType))
              await updatePattern({ data: { id: p.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
          } else if (!p._deleted && !p.id && p.pattern.trim()) {
            await addPattern({ data: { ruleId: rule.id, pattern: p.pattern, field: p.field, matchType: p.matchType } })
          }
        }
      }
      onSaved()
    } finally { setSaving(false) }
  }

  const selectedCategory = categories.find(c => c.id === categoryId)
  const manualCount = preview?.transactions.filter(t => t.categorisedBy === "manual").length ?? 0
  const canSave = name.trim() && visiblePatterns.some(p => p.pattern.trim()) && categoryId

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="rule-name">Rule name</Label>
        <Input
          id="rule-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Groceries, Streaming services"
          autoFocus={!isEdit}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={String(categoryId)} onValueChange={v => v && setCategoryId(Number(v))}>
            <SelectTrigger>
              <SelectValue>
                {selectedCategory
                  ? <span className="flex items-center gap-2"><CategoryDot category={selectedCategory} />{selectedCategory.name}</span>
                  : "Select…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <span className="flex items-center gap-2"><CategoryDot category={c} />{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-priority">
            Priority
            <span className="text-xs text-muted-foreground font-normal ml-1">higher runs first</span>
          </Label>
          <Input
            id="rule-priority"
            type="number"
            value={priority}
            onChange={e => setPriority(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2">
          <Label>Patterns</Label>
          <span className="text-xs text-muted-foreground">matches if ANY pattern matches</span>
        </div>
        <div className="space-y-2">
          {visiblePatterns.map((p, visIdx) => (
            <div key={p.id ?? `new-${visIdx}`} className="flex gap-2">
              <Input
                className="font-mono text-sm flex-1"
                value={p.pattern}
                placeholder="e.g. ALDI"
                onChange={e => updatePatternAt(visIdx, { pattern: e.target.value })}
              />
              <Select value={p.field} onValueChange={v => v && updatePatternAt(visIdx, { field: v as RulePattern["field"] })}>
                <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={p.matchType} onValueChange={v => v && updatePatternAt(visIdx, { matchType: v as RulePattern["matchType"] })}>
                <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {visiblePatterns.length > 1 && (
                <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removePatternAt(visIdx)}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
            onClick={() => setPatterns(ps => [...ps, { pattern: "", field: "description", matchType: "contains" }])}>
            <Plus className="size-3" /> Add another pattern
          </Button>
        </div>
      </div>

      {previewablePatterns.length > 0 && (
        <PreviewTable
          preview={preview}
          previewing={previewing}
          manualCount={manualCount}
          patternCount={previewablePatterns.length}
        />
      )}

      <Separator />

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Rule"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}
