import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Download, ListChecks, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { CategoryDot } from "@/components/rules/category-dot"
import { SaveViewDialog } from "@/components/transactions/save-view-dialog"
import { SplitTransactionDialog } from "@/components/transactions/split-transaction-dialog"
import { TransactionChartPanel } from "@/components/transactions/chart-panel"
import { TransactionDetailSheet } from "@/components/transactions/transaction-detail-sheet"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SortableHead } from "@/components/ui/sortable-head"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSortable } from "@/hooks/use-sortable"
import { withOfflineCache } from "@/lib/loader-cache"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { getCategories } from "@/server/fn/categories"
import { getAccounts } from "@/server/fn/insights"
import { getSavedViews } from "@/server/fn/saved-views"
import { bulkCategorise, bulkMarkReviewed, getNeedsReviewCount, getTransactionDetail, getTransactionStats, getTransactions, getTransactionsExport, updateTransactionCategory } from "@/server/fn/transactions"

const SearchSchema = z.object({
  page: z.coerce.number().default(1), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(),
  categoryId: z.coerce.number().optional(), amountSign: z.enum(["in", "out"]).optional(), accountIds: z.array(z.string()).optional(),
  reviewState: z.enum(["needs-review", "reviewed"]).optional(), categoryType: z.enum(["expense", "income", "transfer"]).optional(),
  recurringOnly: z.boolean().optional(), transactionId: z.string().optional(),
})
type Search = z.infer<typeof SearchSchema>
type ChartStats = Awaited<ReturnType<typeof getTransactionStats>>

function dataFilters(search: Search) {
  const { transactionId: _transactionId, ...filters } = search
  return { ...filters, accountIds: filters.accountIds ?? [] }
}

export const Route = createFileRoute("/transactions/")({
  validateSearch: SearchSchema, component: TransactionsPage, loaderDeps: ({ search }) => search,
  loader: ({ deps }) => withOfflineCache(`transactions:${JSON.stringify(deps)}`, async () => {
    const [txData, categories, accounts, savedViews, needsReviewCount, detail] = await Promise.all([
      getTransactions({ data: dataFilters(deps) }).catch(() => ({ transactions: [], total: 0, page: deps.page, pageSize: 50 })),
      getCategories().catch(() => []), getAccounts().catch(() => []), getSavedViews({ data: { scope: "transactions" } }).catch(() => []),
      getNeedsReviewCount().catch(() => 0), deps.transactionId ? getTransactionDetail({ data: { id: deps.transactionId } }).catch(() => null) : Promise.resolve(null),
    ])
    return { txData, categories, accounts, savedViews, needsReviewCount, detail }
  }),
})

function TransactionsPage() {
  const { txData, categories, accounts, savedViews, needsReviewCount, detail } = Route.useLoaderData()
  const search = Route.useSearch(); const navigate = Route.useNavigate(); const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [bulkCatId, setBulkCatId] = useState(""); const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(search.search ?? ""); const [showChart, setShowChart] = useState(false)
  const [chartResult, setChartResult] = useState<{ key: string; stats: ChartStats } | null>(null)
  const [saveViewOpen, setSaveViewOpen] = useState(false); const [splitId, setSplitId] = useState<string | null>(null); const [ruleId, setRuleId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasChartFilter = Boolean(search.search?.trim() || search.categoryId !== undefined || search.amountSign || search.reviewState || search.categoryType || search.recurringOnly)
  const filters = dataFilters(search); const { page: _page, pageSize: _pageSize, ...statsFilters } = { ...filters, pageSize: 50 }; const chartKey = JSON.stringify(statsFilters)
  const activeView = search.reviewState === "needs-review" ? "needs-review" : search.categoryId === -1 ? "uncategorised" : search.categoryType === "transfer" ? "transfers" : search.recurringOnly ? "recurring" : "all"
  const { sorted: transactionRows, sortKey, sortDir, toggle } = useSortable(txData.transactions, "bookingDate", "desc")
  const { total, page, pageSize } = txData; const totalPages = Math.ceil(total / pageSize)
  const selectedTransaction = transactionRows.find((transaction) => selected.has(transaction.id)) ?? null
  const splitTransaction = transactionRows.find((transaction) => transaction.id === splitId) ?? detail
  const ruleTransaction = transactionRows.find((transaction) => transaction.id === ruleId) ?? null

  function updateSearch(updates: Partial<Search>) { navigate({ search: { ...search, ...updates, page: 1 } }) }
  function setBuiltInView(value: string) { updateSearch({ categoryId: value === "uncategorised" ? -1 : undefined, reviewState: value === "needs-review" ? "needs-review" : undefined, categoryType: value === "transfers" ? "transfer" : undefined, recurringOnly: value === "recurring" || undefined }) }
  function handleSearchChange(value: string) { setSearchInput(value); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => updateSearch({ search: value || undefined }), 400) }

  useEffect(() => {
    if (!showChart || !hasChartFilter) return
    let cancelled = false; getTransactionStats({ data: statsFilters }).then((stats) => { if (!cancelled) setChartResult({ key: chartKey, stats }) })
    return () => { cancelled = true }
  }, [chartKey, showChart, hasChartFilter])

  function toggleSelect(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function toggleAll() { setSelected(selected.size === transactionRows.length ? new Set() : new Set(transactionRows.map((transaction) => transaction.id))) }
  async function mutate(action: () => Promise<unknown>) { setLoading(true); try { await action(); setSelected(new Set()); await router.invalidate() } finally { setLoading(false) } }
  async function handleBulkCategorise() { if (!bulkCatId || selected.size === 0) return; await mutate(() => bulkCategorise({ data: { ids: [...selected], categoryId: Number(bulkCatId) } })); setBulkCatId("") }
  async function handleCategoryChange(id: string, categoryId: number | null) { await updateTransactionCategory({ data: { id, categoryId } }); router.invalidate() }
  async function exportCsv() {
    const rows = await getTransactionsExport({ data: statsFilters }); const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`
    const csv = ["Date,Payee,Description,Amount,Currency,Account,Category,Reviewed", ...rows.map((row) => [row.bookingDate, row.payee, row.description, row.amount, row.currency, row.account, row.category, row.reviewedAt ? "yes" : "no"].map(quote).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `finsight-transactions-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }
  const savedDefinition = Object.fromEntries(Object.entries(search).filter(([key, value]) => key !== "page" && key !== "transactionId" && value !== undefined))

  return <div className="console-page flex flex-col gap-3.5">
    <div className="flex flex-wrap items-center gap-3">
      <Tabs className="min-w-0 max-w-full overflow-x-auto" value={activeView} onValueChange={setBuiltInView}><TabsList className="w-max">
        <TabsTrigger value="all">All transactions</TabsTrigger><TabsTrigger value="needs-review">Needs review {needsReviewCount > 0 && <Badge className="ml-1" variant="secondary">{needsReviewCount}</Badge>}</TabsTrigger>
        <TabsTrigger value="uncategorised">Uncategorised</TabsTrigger><TabsTrigger value="transfers">Transfers</TabsTrigger><TabsTrigger value="recurring">Recurring only</TabsTrigger>
      </TabsList></Tabs>
      <Link to="/triage" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><ListChecks data-icon="inline-start" /> Review mode</Link>
      <Button className="ml-auto" variant="outline" size="sm" onClick={exportCsv}><Download /> Export</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2"><span className="section-label mr-1">Saved views</span>
      {savedViews.map((view) => <Button key={view.id} variant="outline" size="sm" onClick={() => navigate({ search: { page: 1, ...(view.definition as Partial<Search>) } })}>{view.name}</Button>)}
      <Button variant="ghost" size="sm" onClick={() => setSaveViewOpen(true)}><Plus /> Save current filters</Button><p className="ml-auto font-mono text-xs text-muted-foreground">{total} transaction{total === 1 ? "" : "s"}</p>
    </div>
    <Card className="min-h-0 gap-0 py-0">
      <CardHeader className="border-b py-3"><CardTitle className="section-label">Transactions</CardTitle></CardHeader>
      <TransactionFilters searchInput={searchInput} onSearchChange={handleSearchChange} showChart={showChart} showChartToggle={hasChartFilter} onToggleChart={() => setShowChart((value) => !value)}
        dateFrom={search.dateFrom} dateTo={search.dateTo} categoryId={search.categoryId} amountSign={search.amountSign} accountIds={search.accountIds} accounts={accounts} categories={categories}
        selected={selected} bulkCatId={bulkCatId} onBulkCatChange={setBulkCatId} onBulkApply={handleBulkCategorise} onBulkClear={() => setSelected(new Set())} bulkLoading={loading}
        onBulkReviewed={() => mutate(() => bulkMarkReviewed({ data: { ids: [...selected] } }))} onBulkRule={() => selectedTransaction && setRuleId(selectedTransaction.id)} onBulkSplit={() => selectedTransaction && setSplitId(selectedTransaction.id)}
        onDateFromChange={(value) => updateSearch({ dateFrom: value })} onDateToChange={(value) => updateSearch({ dateTo: value })} onCategoryChange={(value) => updateSearch({ categoryId: value })}
        onAmountSignChange={(value) => updateSearch({ amountSign: value })} onAccountChange={(value) => updateSearch({ accountIds: value })} />
      {showChart && hasChartFilter && <TransactionChartPanel chartStats={chartResult?.key === chartKey ? chartResult.stats : null} loading={chartResult?.key !== chartKey} />}
      <CardContent className="overflow-x-auto px-0"><Table>
        <TableHeader className="bg-muted/30"><TableRow><TableHead className="w-10 px-3"><Checkbox checked={selected.size === transactionRows.length && transactionRows.length > 0} onCheckedChange={toggleAll} /></TableHead>
          <SortableHead id="bookingDate" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Date</SortableHead><SortableHead id="creditorName" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Payee</SortableHead>
          <TableHead className="hidden sm:table-cell">Description</TableHead><SortableHead id="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Amount</SortableHead><TableHead>Category</TableHead></TableRow></TableHeader>
        <TableBody>{transactionRows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground">No transactions found.</TableCell></TableRow> : transactionRows.map((transaction) => <TableRow key={transaction.id} tabIndex={0} className="cursor-pointer hover:bg-muted/40" onClick={() => updateSearch({ transactionId: transaction.id })} onKeyDown={(event) => { if (event.key === "Enter") updateSearch({ transactionId: transaction.id }) }}>
          <TableCell className="px-3" onClick={(event) => event.stopPropagation()}><Checkbox checked={selected.has(transaction.id)} onCheckedChange={() => toggleSelect(transaction.id)} /></TableCell>
          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(transaction.bookingDate)}</TableCell><TableCell className="max-w-48 truncate font-medium">{transaction.creditorName ?? transaction.debtorName ?? transaction.description ?? "—"}{!transaction.reviewedAt && <span className="ml-2 inline-block size-1.5 rounded-full bg-warning" title="Needs review" />}</TableCell>
          <TableCell className="hidden max-w-64 truncate text-muted-foreground sm:table-cell">{transaction.description ?? "—"}</TableCell><TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${transaction.amount >= 0 ? "text-positive" : ""}`}>{formatCurrency(transaction.amount, transaction.currency)}</TableCell>
          <TableCell onClick={(event) => event.stopPropagation()}><div className="flex items-center"><Select value={transaction.categoryId ? String(transaction.categoryId) : "uncategorised"} onValueChange={(value) => handleCategoryChange(transaction.id, value === "uncategorised" ? null : Number(value))}>
            <SelectTrigger className="h-7 w-full border-0 bg-transparent px-2 shadow-none hover:bg-muted"><SelectValue>{transaction.category ? <span className="flex items-center gap-2"><CategoryDot category={transaction.category} />{transaction.category.name}</span> : "Uncategorised"}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="uncategorised">Uncategorised</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}><span className="flex items-center gap-2"><CategoryDot category={category} />{category.name}</span></SelectItem>)}</SelectGroup></SelectContent>
          </Select>{transaction.splitCount > 0 && <Badge variant="secondary" className="ml-2">{transaction.splitCount} splits</Badge>}</div></TableCell></TableRow>)}</TableBody>
      </Table></CardContent>
      <CardFooter className="justify-between border-t bg-transparent px-4 py-3"><p className="text-sm text-muted-foreground">Page {page} of {totalPages || 1}</p><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => navigate({ search: { ...search, page: page - 1 } })} disabled={page <= 1}><ChevronLeft /></Button><Button variant="outline" size="icon" onClick={() => navigate({ search: { ...search, page: page + 1 } })} disabled={page >= totalPages}><ChevronRight /></Button></div></CardFooter>
    </Card>
    <SaveViewDialog open={saveViewOpen} onOpenChange={setSaveViewOpen} definition={savedDefinition} onSaved={() => router.invalidate()} />
    <SplitTransactionDialog key={splitId ?? "closed"} open={Boolean(splitId)} onOpenChange={(open) => { if (!open) setSplitId(null) }} transaction={splitTransaction} categories={categories} onSaved={() => router.invalidate()} />
    {detail && <TransactionDetailSheet detail={detail} categories={categories} onOpenChange={(open) => { if (!open) updateSearch({ transactionId: undefined }) }} onChanged={() => router.invalidate()} onSplit={() => setSplitId(detail.id)} />}
    {ruleTransaction && <RuleDialog open onOpenChange={(open) => { if (!open) setRuleId(null) }} categories={categories} draft={{ name: `${ruleTransaction.creditorName ?? ruleTransaction.debtorName ?? "Transaction"} transactions`, categoryId: ruleTransaction.categoryId ?? undefined, pattern: ruleTransaction.creditorName ?? ruleTransaction.debtorName ?? ruleTransaction.description ?? "", field: ruleTransaction.creditorName ? "creditorName" : ruleTransaction.debtorName ? "debtorName" : "description" }} onSaved={() => { setRuleId(null); router.invalidate() }} />}
  </div>
}
