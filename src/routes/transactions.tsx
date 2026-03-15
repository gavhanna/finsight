import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getTransactions, updateTransactionCategory, bulkCategorise } from "../server/fn/transactions"
import { getCategories } from "../server/fn/categories"
import { getAccounts } from "../server/fn/insights"
import { formatDate, formatCurrency } from "../lib/utils"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { z } from "zod"

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
  const [bulkCatId, setBulkCatId] = useState<number | "">("")
  const [loading, setLoading] = useState(false)

  const { transactions, total, page, pageSize } = txData
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
    else setSelected(new Set(transactions.map((t: any) => t.id)))
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
      <div className="border-b p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search.search ?? ""}
              onChange={(e) => updateSearch({ search: e.target.value || undefined })}
              placeholder="Search transactions…"
              className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            type="date"
            value={search.dateFrom ?? ""}
            onChange={(e) => updateSearch({ dateFrom: e.target.value || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={search.dateTo ?? ""}
            onChange={(e) => updateSearch({ dateTo: e.target.value || undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={search.categoryId ?? ""}
            onChange={(e) => updateSearch({ categoryId: e.target.value ? Number(e.target.value) : undefined })}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All categories</option>
            <option value="-1">Uncategorised</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {accounts.length > 1 && (
            <select
              value={(search.accountIds ?? [])[0] ?? ""}
              onChange={(e) => updateSearch({ accountIds: e.target.value ? [e.target.value] : undefined })}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All accounts</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name ?? a.iban ?? a.id}</option>
              ))}
            </select>
          )}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-muted/40 rounded-md px-3 py-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <select
              value={bulkCatId}
              onChange={(e) => setBulkCatId(e.target.value ? Number(e.target.value) : "")}
              className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Assign category…</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkCategorise}
              disabled={!bulkCatId || loading}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === transactions.length && transactions.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Payee</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">
                  No transactions found.
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => (
                <tr
                  key={tx.id}
                  className="border-b hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.bookingDate)}
                  </td>
                  <td className="px-3 py-2 font-medium max-w-48 truncate">
                    {tx.creditorName ?? tx.debtorName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-64 truncate">
                    {tx.description ?? "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-green-600" : "text-foreground"}`}>
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={tx.categoryId ?? ""}
                      onChange={(e) => handleCategoryChange(tx.id, e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded border-0 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-ring rounded-md py-1 px-2 hover:bg-muted transition-colors cursor-pointer"
                      style={tx.category ? { color: tx.category.color } : undefined}
                    >
                      <option value="">Uncategorised</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} transaction{total !== 1 ? "s" : ""} · page {page} of {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => navigate({ search: { ...search, page: page - 1 } })}
            disabled={page <= 1}
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate({ search: { ...search, page: page + 1 } })}
            disabled={page >= totalPages}
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
