import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { saveTransactionSplits } from "@/server/fn/transactions"
import type { getCategories } from "@/server/fn/categories"

type Category = Awaited<ReturnType<typeof getCategories>>[number]
type SplitDraft = { categoryId: string; amount: string; note: string }

export function SplitTransactionDialog({ open, onOpenChange, transaction, categories, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: { id: string; amount: number; currency: string; creditorName?: string | null; debtorName?: string | null } | null
  categories: Category[]
  onSaved: () => void
}) {
  const absoluteTotal = Math.abs(transaction?.amount ?? 0)
  const initialFirst = Math.round(absoluteTotal / 2 * 100) / 100
  const [splits, setSplits] = useState<SplitDraft[]>([
    { categoryId: "", amount: initialFirst.toFixed(2), note: "" },
    { categoryId: "", amount: (absoluteTotal - initialFirst).toFixed(2), note: "" },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const allocated = useMemo(() => splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0), [splits])
  const remaining = Math.round((absoluteTotal - allocated) * 100) / 100
  const canSave = Math.abs(remaining) < 0.005 && splits.every((split) => split.categoryId && Number(split.amount) > 0)

  function update(index: number, values: Partial<SplitDraft>) {
    setSplits((current) => current.map((split, position) => position === index ? { ...split, ...values } : split))
  }

  async function save() {
    if (!transaction) return
    if (Math.abs(remaining) >= 0.005) { setError("Split amounts must add up to the transaction total."); return }
    if (splits.some((split) => !split.categoryId || Number(split.amount) <= 0)) { setError("Choose a category and positive amount for every split."); return }
    const sign = transaction.amount < 0 ? -1 : 1
    setSaving(true)
    try {
      await saveTransactionSplits({ data: {
        transactionId: transaction.id,
        splits: splits.map((split) => ({ categoryId: Number(split.categoryId), amount: Number(split.amount) * sign, note: split.note || undefined })),
      } })
      onSaved()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this split.")
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Split transaction</DialogTitle>
        <DialogDescription>Allocate {formatCurrency(absoluteTotal, transaction?.currency ?? "EUR")} across two or more categories without changing the imported bank transaction.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {splits.map((split, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_8rem_2rem] items-end gap-2">
          <Field>
            <FieldLabel>Category {index + 1}</FieldLabel>
            <Select value={split.categoryId || undefined} onValueChange={(value) => update(index, { categoryId: value ?? "" })}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent><SelectGroup>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`split-${index}`}>Amount</FieldLabel>
            <Input id={`split-${index}`} inputMode="decimal" value={split.amount} onChange={(event) => update(index, { amount: event.target.value })} />
          </Field>
          <Button variant="ghost" size="icon" aria-label={`Remove split ${index + 1}`} disabled={splits.length <= 2} onClick={() => setSplits((current) => current.filter((_, position) => position !== index))}><Trash2 /></Button>
        </div>)}
      </FieldGroup>
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => setSplits((current) => [...current, { categoryId: "", amount: "0.00", note: "" }])}><Plus /> Add split</Button>
        <span className={remaining === 0 ? "text-positive" : "text-muted-foreground"}>{remaining === 0 ? "Fully allocated" : `${formatCurrency(Math.abs(remaining), transaction?.currency ?? "EUR")} remaining`}</span>
      </div>
      <FieldError>{error}</FieldError>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={saving || !canSave}>{saving ? "Saving…" : "Save split"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
