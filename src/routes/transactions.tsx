import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import { getTransactions, updateTransactionCategory, bulkCategorise, getTransactionStats } from "../server/fn/transactions"
import { getCategories } from "../server/fn/categories"
import { getAccounts } from "../server/fn/insights"
import { formatDate, formatCurrency } from "@/lib/utils"
import { withOfflineCache } from "@/lib/loader-cache"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { TransactionFilters } from "@/components/transactions/transaction-filters"
import { TransactionChartPanel } from "@/components/transactions/chart-panel"
import type { getTransactionStats as getTransactionStatsType } from "../server/fn/transactions"

type ChartStats = Awaited<ReturnType<typeof getTransactionStatsType>>

const SearchSchema = z.object({
  page: z.coerce.number().default(1),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  accountIds: z.array(z.string()).optional(),
})

export const Route = createFileRoute("/transactions")({
  validateSearch: SearchSchema,
  component: TransactionsPage,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    withOfflineCache("transactions", async () => {
      const [txData, categories, accounts] = await Promise.all([
        getTransactions({ data: { ...deps, accountIds: deps.accountIds ?? [] } }),
        getCategories(),
        getAccounts(),
      ])
      return { txData, categories, accounts }
    }),
})

function TransactionsPage() {
  const { txData, categories, accounts } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCatId, setBulkCatId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(search.search ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showChart, setShowChart] = useState(false)
  const [chartStats, setChartStats] = useState<ChartStats | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const hasSearch = !!search.search?.trim()
  const hasChartFilter = hasSearch || search.categoryId !== undefined

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSearch({ search: value || undefined })
    }, 400)
  }

  useEffect(() => {
    if (!showChart || !hasChartFilter) return
    setChartStats(null)
    setChartLoading(true)
    getTransactionStats({
      data: {
        search: search.search,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
        categoryId: search.categoryId,
        accountIds: search.accountIds ?? [],
      },
    }).then((s) => { setChartStats(s); setChartLoading(false) })
  }, [showChart, hasChartFilter, search.search, search.dateFrom, search.dateTo, search.categoryId, search.accountIds])

  const { sorted: transactions, sortKey, sortDir, toggle } = useSortable(txData.transactions, "bookingDate", "desc")
  const { total, page, pageSize } = txData
  const totalPages = Math.ceil(total / pageSize)

  function updateSearch(updates: Partial<z.infer<typeof SearchSchema>>) {
    navigate({ search: { ...search, ...updates, page: 1 } })
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }

  function toggleAll() {
    if (selected.size === transactions.length) setSelected(new Set())
    else setSelected(new Set(transactions.map((t) => t.id)))
  }

  async function handleBulkCategorise() {
    if (!bulkCatId || selected.size === 0) return
    setLoading(true)
    await bulkCategorise({ data: { ids: Array.from(selected), categoryId: Number(bulkCatId) } })
    setSelected(new Set())
    setBulkCatId("")
    router.invalidate()
    setLoading(false)
  }

  async function handleCategoryChange(txId: string, catId: number | null) {
    await updateTransactionCategory({ data: { id: txId, categoryId: catId } })
    router.invalidate()
  }

  return (
    <div className="flex flex-col h-full">
      <TransactionFilters
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        showChart={showChart}
        showChartToggle={hasChartFilter}
        onToggleChart={() => setShowChart((v) => !v)}
        dateFrom={search.dateFrom}
        dateTo={search.dateTo}
        categoryId={search.categoryId}
        accountIds={search.accountIds}
        accounts={accounts}
        categories={categories}
        selected={selected}
        bulkCatId={bulkCatId}
        onBulkCatChange={setBulkCatId}
        onBulkApply={handleBulkCategorise}
        onBulkClear={() => setSelected(new Set())}
        bulkLoading={loading}
        onDateFromChange={(v) => updateSearch({ dateFrom: v })}
        onDateToChange={(v) => updateSearch({ dateTo: v })}
        onCategoryChange={(v) => updateSearch({ categoryId: v })}
        onAccountChange={(v) => updateSearch({ accountIds: v })}
      />

      {showChart && hasChartFilter && (
        <TransactionChartPanel chartStats={chartStats} loading={chartLoading} />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={selected.size === transactions.length && transactions.length > 0}
                  onCheckedChange={() => toggleAll()}
                />
              </TableHead>
              <SortableHead id="bookingDate" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Date</SortableHead>
              <SortableHead id="creditorName" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Payee</SortableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <SortableHead id="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Amount</SortableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="px-3">
                    <Checkbox checked={selected.has(tx.id)} onCheckedChange={() => toggleSelect(tx.id)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.bookingDate)}
                  </TableCell>
                  <TableCell className="font-medium max-w-48 truncate">
                    {tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground max-w-64 truncate">
                    {tx.description ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right font-medium tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-positive" : ""}`}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell>
                    <select
                      value={tx.categoryId ?? ""}
                      onChange={(e) => handleCategoryChange(tx.id, e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-md border-0 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring py-1 px-2 hover:bg-muted transition-colors cursor-pointer"
                      style={tx.category ? { color: tx.category.color } : undefined}
                    >
                      <option value="">Uncategorised</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="border-t px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} transaction{total !== 1 ? "s" : ""} · page {page} of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline" size="icon"
            onClick={() => navigate({ search: { ...search, page: page - 1 } })}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="icon"
            onClick={() => navigate({ search: { ...search, page: page + 1 } })}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
