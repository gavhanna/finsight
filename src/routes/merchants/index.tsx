import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import { getMerchantList } from "../../server/fn/merchants"
import { getAccounts } from "../../server/fn/insights"
import { getSetting } from "../../server/fn/settings"
import { getPresetDates, type PresetKey } from "@/lib/presets"
import { formatCurrency, formatDate } from "@/lib/utils"
import { withOfflineCache } from "@/lib/loader-cache"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DatePicker } from "@/components/ui/date-picker"
import { SortableHead } from "@/components/ui/sortable-head"
import { useSortable } from "@/hooks/use-sortable"
import { Store, ChevronRight, ChevronLeft, Search } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent } from "@/components/ui/card"

type Preset = "month" | "3months" | "6months" | "ytd" | "12months" | "all"

const PRESET_LABELS: Record<Preset, string> = {
  month: "Month",
  "3months": "3M",
  "6months": "6M",
  ytd: "YTD",
  "12months": "12M",
  all: "All",
}

const PAGE_SIZE = 50

const SearchSchema = z.object({
  preset: z.enum(["month", "3months", "6months", "ytd", "12months", "all"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
})

export const Route = createFileRoute("/merchants/")({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => {
    const dates =
      !search.dateFrom && !search.dateTo
        ? getPresetDates((search.preset ?? "6months") as PresetKey)
        : { dateFrom: search.dateFrom, dateTo: search.dateTo }
    return { ...search, dateFrom: dates.dateFrom, dateTo: dates.dateTo }
  },
  loader: ({ deps }) =>
    withOfflineCache("merchants", async () => {
      const [merchants, accounts, currency] = await Promise.all([
        getMerchantList({
          data: {
            dateFrom: deps.dateFrom,
            dateTo: deps.dateTo,
            accountIds: deps.accountIds ?? [],
          },
        }),
        getAccounts(),
        getSetting({ data: "preferred_currency" }),
      ])
      return { merchants, accounts, currency: currency ?? "EUR" }
    }),
  component: MerchantsPage,
})

function MerchantsPage() {
  const { merchants, accounts, currency } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)

  const activePreset = !search.dateFrom && !search.dateTo ? (search.preset ?? "6months") : null

  const filtered = merchants.filter((m) =>
    m.name.toLowerCase().includes(searchInput.toLowerCase()),
  )

  const { sorted, sortKey, sortDir, toggle } = useSortable(filtered, "total", "desc")

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const totalSpend = merchants.reduce((s, m) => s + m.total, 0)

  function setPreset(preset: Preset) {
    navigate({ search: (prev) => ({ ...prev, preset, dateFrom: undefined, dateTo: undefined }) })
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters bar */}
      <div className="border-b p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search merchants…"
              className="pl-9 w-full"
            />
          </div>

          {/* Date pickers */}
          <DatePicker
            value={search.dateFrom}
            onChange={(v) =>
              navigate({ search: (prev) => ({ ...prev, dateFrom: v, preset: undefined }) })
            }
            placeholder="From date"
          />
          <DatePicker
            value={search.dateTo}
            onChange={(v) =>
              navigate({ search: (prev) => ({ ...prev, dateTo: v, preset: undefined }) })
            }
            placeholder="To date"
          />

          {/* Account selector */}
          {accounts.length > 1 && (
            <Select
              value={search.accountIds?.[0] ?? "all"}
              onValueChange={(v) => {
                if (!v || v === "all") {
                  navigate({ search: (prev) => ({ ...prev, accountIds: undefined }) })
                } else {
                  const current = search.accountIds ?? []
                  const next = current.includes(v) ? current.filter((a) => a !== v) : [...current, v]
                  navigate({ search: (prev) => ({ ...prev, accountIds: next.length ? next : undefined }) })
                }
              }}
            >
              <SelectTrigger className="sm:min-w-36">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Preset tabs + summary */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Tabs value={activePreset ?? ""} onValueChange={(v) => setPreset(v as Preset)}>
            <TabsList className="h-8">
              {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="text-xs px-2.5 h-6">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{merchants.length}</span> merchants ·{" "}
            <span className="font-medium text-foreground">{formatCurrency(totalSpend, currency)}</span> total
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead>Merchant</TableHead>
                <SortableHead id="total" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">
                  Total Spent
                </SortableHead>
                <SortableHead id="count" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">
                  Transactions
                </SortableHead>
                <SortableHead id="avgAmount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">
                  Avg
                </SortableHead>
                <SortableHead id="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">
                  Last Seen
                </SortableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Store className="size-8 opacity-30 mx-auto mb-2" />
                    No merchants found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((m) => (
                  <TableRow
                    key={m.name}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: "/merchants/$merchant",
                        params: { merchant: m.name },
                        search: {
                          dateFrom: search.dateFrom,
                          dateTo: search.dateTo,
                          preset: search.preset,
                          accountIds: search.accountIds,
                        },
                      })
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Store className="size-3.5 text-muted-foreground" />
                        </div>
                        {m.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(m.total, currency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {m.count}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatCurrency(m.avgAmount, currency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(m.lastSeen)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="border-t px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} merchant{sorted.length !== 1 ? "s" : ""} · page {currentPage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => p - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => p + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Concentration Analysis */}
      {merchants.length > 0 && (
        <ConcentrationSection merchants={merchants} totalSpend={totalSpend} currency={currency} />
      )}
    </div>
  )
}

function ConcentrationSection({
  merchants,
  totalSpend,
  currency,
}: {
  merchants: Array<{ name: string; total: number; count: number }>
  totalSpend: number
  currency: string
}) {
  const [expanded, setExpanded] = useState(false)

  const withPct = merchants
    .map((m) => ({ ...m, pct: totalSpend > 0 ? (m.total / totalSpend) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)

  // Herfindahl-Hirschman Index (0–10000)
  const hhi = withPct.reduce((s, m) => s + Math.pow(m.pct, 2), 0)
  const hhiLabel = hhi >= 2500 ? "High" : hhi >= 1500 ? "Moderate" : "Low"
  const hhiColor = hhi >= 2500 ? "text-negative" : hhi >= 1500 ? "text-amber-500" : "text-positive"

  const top10 = withPct.slice(0, 10)
  const otherTotal = withPct.slice(10).reduce((s, m) => s + m.total, 0)
  const otherPct = withPct.slice(10).reduce((s, m) => s + m.pct, 0)
  const pieData = [
    ...top10.map((m) => ({ name: m.name, value: m.total, pct: m.pct })),
    ...(otherTotal > 0 ? [{ name: "Other", value: otherTotal, pct: otherPct }] : []),
  ]

  const COLORS = [
    "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
    "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#94a3b8",
  ]

  return (
    <div className="border-t p-4 sm:p-5 space-y-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        Concentration Analysis
        <span className={`ml-auto text-xs font-semibold ${hhiColor}`}>
          {hhiLabel} concentration · HHI {Math.round(hhi)}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 animate-in">
          {/* Pie chart */}
          <Card>
            <CardContent className="pt-4">
              <p className="section-label mb-3">Spend Distribution</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, _name: unknown, props: { payload?: { pct?: number } }) => [
                      `${formatCurrency(value as number, currency)} (${(props.payload?.pct ?? 0).toFixed(1)}%)`,
                      "",
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground truncate">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* HHI explanation + top merchants */}
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <p className="section-label mb-1">Concentration Score (HHI)</p>
                <div className="flex items-end gap-3 mt-2">
                  <span className={`text-4xl font-bold tabular-nums ${hhiColor}`}>
                    {Math.round(hhi)}
                  </span>
                  <span className={`text-sm font-medium mb-1 ${hhiColor}`}>{hhiLabel}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-3">
                  <div
                    className={`h-2 rounded-full transition-all ${hhi >= 2500 ? "bg-negative" : hhi >= 1500 ? "bg-amber-500" : "bg-positive"}`}
                    style={{ width: `${Math.min(100, (hhi / 10000) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Below 1500 = diversified · 1500–2500 = moderate · Above 2500 = concentrated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="pl-4 py-2.5 text-left font-medium text-muted-foreground">Merchant</th>
                      <th className="pr-4 py-2.5 text-right font-medium text-muted-foreground">% of spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.slice(0, 6).map((m, i) => (
                      <tr key={m.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="pl-4 py-2 flex items-center gap-2">
                          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate max-w-[160px]">{m.name}</span>
                        </td>
                        <td className="pr-4 py-2 text-right tabular-nums font-medium">
                          {m.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
