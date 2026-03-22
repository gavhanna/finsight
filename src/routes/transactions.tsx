import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import { getTransactions, updateTransactionCategory, bulkCategorise, getTransactionStats } from "../server/fn/transactions"
import { getCategories } from "../server/fn/categories"
import { getAccounts } from "../server/fn/insights"
import { formatDate, formatCurrency, formatYearMonth, cn } from "@/lib/utils"
import { Search, ChevronLeft, ChevronRight, BarChart2, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"

type ChartStats = Awaited<ReturnType<typeof getTransactionStats>>

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
  loader: async ({ deps }) => {
    const [txData, categories, accounts] = await Promise.all([
      getTransactions({ data: { ...deps, accountIds: deps.accountIds ?? [] } }),
      getCategories(),
      getAccounts(),
    ])
    return { txData, categories, accounts }
  },
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

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateSearch({ search: value || undefined })
    }, 400)
  }
  const [showChart, setShowChart] = useState(false)
  const [chartStats, setChartStats] = useState<ChartStats | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const hasSearch = !!search.search?.trim()

  useEffect(() => {
    if (!showChart || !hasSearch) return
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
  }, [showChart, search.search, search.dateFrom, search.dateTo, search.categoryId, search.accountIds])

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
      {/* Filters */}
      <div className="border-b p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-48 sm:w-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search transactions…"
                className="pl-9 w-full"
              />
            </div>
            {hasSearch && (
              <Button
                variant={showChart ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowChart((v) => !v)}
                title="Toggle chart view"
              >
                <BarChart2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <DatePicker
              value={search.dateFrom}
              onChange={(v) => updateSearch({ dateFrom: v })}
              placeholder="From date"
            />
            <DatePicker
              value={search.dateTo}
              onChange={(v) => updateSearch({ dateTo: v })}
              placeholder="To date"
            />
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Select
              value={search.categoryId !== undefined ? String(search.categoryId) : "all"}
              onValueChange={(v) => updateSearch({ categoryId: v && v !== "all" ? Number(v) : undefined })}
            >
              <SelectTrigger className="flex-1 sm:flex-none sm:min-w-36">
                <SelectValue placeholder="All categories">
                  {search.categoryId === undefined
                    ? "All categories"
                    : search.categoryId === -1
                    ? "Uncategorised"
                    : categories.find((c) => c.id === search.categoryId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="-1">Uncategorised</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length > 1 && (
              <Select
                value={(search.accountIds ?? [])[0] ?? "all"}
                onValueChange={(v) => updateSearch({ accountIds: v && v !== "all" ? [v] : undefined })}
              >
                <SelectTrigger className="flex-1 sm:flex-none sm:min-w-36">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name ?? a.iban ?? a.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-muted/40 rounded-md px-3 py-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select value={bulkCatId || "none"} onValueChange={(v) => setBulkCatId(v && v !== "none" ? v : "")}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-sm">
                <SelectValue placeholder="Assign category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Assign category…</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkCategorise} disabled={!bulkCatId || loading}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Chart panel */}
      {showChart && hasSearch && (
        <div className="border-b px-4 py-4 space-y-4 bg-muted/20">
          {chartLoading || !chartStats ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : (
            <>
              {/* Stat chips */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingDown className="size-3 text-negative" />
                    Total out
                  </div>
                  <p className="font-semibold tabular-nums text-sm">{formatCurrency(Math.abs(chartStats.totalOut))}</p>
                </div>
                <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="size-3 text-positive" />
                    Total in
                  </div>
                  <p className="font-semibold tabular-nums text-sm text-positive">{formatCurrency(chartStats.totalIn)}</p>
                </div>
                <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Minus className="size-3" />
                    Net · {chartStats.count} txns
                  </div>
                  <p className={cn("font-semibold tabular-nums text-sm", chartStats.totalAmount >= 0 ? "text-positive" : "")}>
                    {formatCurrency(chartStats.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Monthly bar chart */}
              {chartStats.byMonth.length > 1 && (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartStats.byMonth.map(d => ({ ...d, display: -d.amount }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `€${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`} />
                    <ReferenceLine y={0} stroke="oklch(0.5 0 0 / 0.2)" />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(-v), "Amount"]}
                      labelFormatter={formatYearMonth}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.5 0 0 / 0.15)" }}
                    />
                    <Line type="monotone" dataKey="display" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--color-primary)" }} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>
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
                    <Checkbox
                      checked={selected.has(tx.id)}
                      onCheckedChange={() => toggleSelect(tx.id)}
                    />
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
                    {/* Keep native select for inline category — needs colored text styling */}
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
            variant="outline"
            size="icon"
            onClick={() => navigate({ search: { ...search, page: page - 1 } })}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
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
