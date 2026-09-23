import { useState } from "react"
import { Check, ListTree, Sparkles } from "lucide-react"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { CategoryDot } from "@/components/rules/category-dot"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { getCategories } from "@/server/fn/categories"
import { bulkMarkReviewed, updateTransactionCategory, type getTransactionDetail } from "@/server/fn/transactions"

type Category = Awaited<ReturnType<typeof getCategories>>[number]
type Detail = Awaited<ReturnType<typeof getTransactionDetail>>

export function TransactionDetailSheet({ detail, categories, onOpenChange, onChanged, onSplit }: {
  detail: Detail
  categories: Category[]
  onOpenChange: (open: boolean) => void
  onChanged: () => void
  onSplit: () => void
}) {
  const [ruleOpen, setRuleOpen] = useState(false)
  if (!detail) return null
  const transaction = detail
  const payee = transaction.creditorName ?? transaction.debtorName ?? transaction.description ?? "Transaction"

  async function setCategory(categoryId: number | null) {
    await updateTransactionCategory({ data: { id: transaction.id, categoryId } })
    onChanged()
  }

  async function markReviewed() {
    await bulkMarkReviewed({ data: { ids: [transaction.id] } })
    onChanged()
  }

  return <>
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center gap-2">
            <Badge variant={detail.reviewedAt ? "secondary" : "outline"}>{detail.reviewedAt ? "Reviewed" : "Needs review"}</Badge>
            {detail.splits.length > 0 && <Badge variant="secondary">{detail.splits.length} splits</Badge>}
          </div>
          <SheetTitle className="text-xl">{payee}</SheetTitle>
          <SheetDescription>{formatDate(detail.bookingDate)} · {detail.account.name ?? detail.account.iban ?? "Account"}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className={detail.amount >= 0 ? "font-mono text-2xl font-semibold text-positive" : "font-mono text-2xl font-semibold"}>{formatCurrency(detail.amount, detail.currency)}</span>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="section-label">Category</p>
              {!detail.reviewedAt && <span className="text-xs text-warning">Needs review</span>}
            </div>
            <Select value={detail.categoryId ? String(detail.categoryId) : "uncategorised"} onValueChange={(value) => setCategory(value === "uncategorised" ? null : Number(value))}>
              <SelectTrigger className="w-full"><SelectValue>{detail.category ? <span className="flex items-center gap-2"><CategoryDot category={detail.category} />{detail.category.name}</span> : "Uncategorised"}</SelectValue></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="uncategorised">Uncategorised</SelectItem>
                {categories.map((category) => <SelectItem key={category.id} value={String(category.id)}><span className="flex items-center gap-2"><CategoryDot category={category} />{category.name}</span></SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
            {!detail.categoryId && <div className="mt-3">
              <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3" /> Suggested categories</p>
              <div className="flex flex-wrap gap-2">{categories.slice(0, 3).map((category) => <Button key={category.id} variant="outline" size="sm" onClick={() => setCategory(category.id)}><CategoryDot category={category} />{category.name}</Button>)}</div>
            </div>}
          </div>

          <div className="rounded-xl border p-4">
            <p className="section-label mb-2">Create rule from this</p>
            <p className="text-sm text-muted-foreground">Match future transactions containing “{payee}”. Preview every historical match before applying it.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setRuleOpen(true)} disabled={!detail.categoryId}>Create rule</Button>
              {!detail.reviewedAt && <Button variant="outline" onClick={markReviewed}><Check /> Just this one</Button>}
              <Button variant="outline" onClick={onSplit}><ListTree /> Split</Button>
            </div>
            {!detail.categoryId && <p className="mt-2 text-xs text-muted-foreground">Choose a category before creating a rule.</p>}
          </div>

          {detail.splits.length > 0 && <div>
            <p className="section-label mb-2">Allocation</p>
            <div className="rounded-xl border">{detail.splits.map((split, index) => <div key={split.id} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
              <span className="flex items-center gap-2 text-sm"><CategoryDot category={split.category} />{split.category?.name ?? `Split ${index + 1}`}</span>
              <span className="font-mono text-sm">{formatCurrency(split.amount, detail.currency)}</span>
            </div>)}</div>
          </div>}

          {detail.merchant && <div>
            <p className="section-label mb-2">Merchant history</p>
            <div className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Transactions</p><p className="mt-1 font-mono font-medium">{detail.merchant.transactionCount}</p></div>
              <div><p className="text-xs text-muted-foreground">Total spend</p><p className="mt-1 font-mono font-medium">{formatCurrency(detail.merchant.totalSpend, detail.currency)}</p></div>
              <div><p className="text-xs text-muted-foreground">Average</p><p className="mt-1 font-mono font-medium">{formatCurrency(detail.merchant.averageSpend, detail.currency)}</p></div>
            </div>
          </div>}

          <Separator />
          <div className="text-xs text-muted-foreground">
            <p>{detail.description ?? "No bank description"}</p>
            <p className="mt-1 font-mono">{detail.id}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <RuleDialog open={ruleOpen} onOpenChange={setRuleOpen} categories={categories} draft={{ name: `${payee} transactions`, categoryId: detail.categoryId ?? undefined, pattern: payee, field: detail.creditorName ? "creditorName" : detail.debtorName ? "debtorName" : "description" }} onSaved={() => { setRuleOpen(false); onChanged() }} />
  </>
}
