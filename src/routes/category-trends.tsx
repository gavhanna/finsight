import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { z } from "zod"
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Label,
} from "recharts"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"
import { getSpendingTrends, getAccounts } from "../server/fn/insights"
import { formatCurrency, daysAgo, startOfYear, todayStr } from "../lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { cn } from "@/lib/utils"

type Preset = "3months" | "6months" | "ytd" | "12months" | "all"
type ChartType = "area" | "bar"

const PRESET_LABELS: Record<Preset, string> = {
  "3months": "3 Months",
  "6months": "6 Months",
  ytd: "Year to Date",
  "12months": "12 Months",
  all: "All Time",
}

function getPresetDates(preset: Preset): { dateFrom?: string; dateTo?: string } {
  const today = todayStr()
  switch (preset) {
    case "3months": return { dateFrom: daysAgo(90), dateTo: today }
    case "6months": return { dateFrom: daysAgo(180), dateTo: today }
    case "ytd":     return { dateFrom: startOfYear(), dateTo: today }
    case "12months":return { dateFrom: daysAgo(365), dateTo: today }
    case "all":     return {}
  }
}

function formatMonth(ym: string) {
  const [year, month] = ym.split("-")
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${names[parseInt(month) - 1]} '${year.slice(2)}`
}

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["3months","6months","ytd","12months","all"]).optional(),
  chart: z.enum(["area","bar"]).optional(),
})

export const Route = createFileRoute("/category-trends")({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const filters = {
      dateFrom: deps.dateFrom,
      dateTo: deps.dateTo,
      accountIds: deps.accountIds ?? [],
    }
    const [trends, accounts] = await Promise.all([
      getSpendingTrends({ data: filters }),
      getAccounts(),
    ])
    return { trends, accounts }
  },
  component: CategoryTrendsPage,
})

type TrendRow = { month: string; categoryId: number | null; categoryName: string; categoryColor: string; total: number }

function CategoryTrendsPage() {
  const { trends: rawTrends, accounts } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const trends = rawTrends as TrendRow[]
  const preset = search.preset ?? "6months"
  const chartType: ChartType = search.chart ?? "area"

  // All categories present in this period
  const allCategories = useMemo(() => {
    const seen = new Map<string, { id: number | null; name: string; color: string; total: number }>()
    for (const row of trends) {
      const key = String(row.categoryId ?? "null")
      const existing = seen.get(key)
      seen.set(key, {
        id: row.categoryId,
        name: row.categoryName,
        color: row.categoryColor,
        total: (existing?.total ?? 0) + row.total,
      })
    }
    return [...seen.values()].sort((a, b) => b.total - a.total)
  }, [trends])

  // Selected category IDs (null = "Uncategorised")
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allCategories.map(c => String(c.id))))

  // Sync selection when category list changes (new data loaded)
  const allKeys = allCategories.map(c => String(c.id)).join(",")
  useMemo(() => {
    setSelected(new Set(allCategories.map(c => String(c.id))))
  }, [allKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCategory(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        // Don't deselect the last one
        if (next.size === 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function isolate(key: string) {
    setSelected(new Set([key]))
  }

  function selectAll() {
    setSelected(new Set(allCategories.map(c => String(c.id))))
  }

  const visibleCategories = allCategories.filter(c => selected.has(String(c.id)))
  const isSingle = visibleCategories.length === 1

  // Pivot data: [{month, [catKey]: value, ...}]
  const months = useMemo(() => [...new Set(trends.map(t => t.month))].sort(), [trends])
  const chartData = useMemo(() =>
    months.map(month => {
      const row: Record<string, any> = { month }
      for (const cat of visibleCategories) {
        const key = String(cat.id)
        const found = trends.find(t => t.month === month && String(t.categoryId) === key)
        row[key] = found?.total ?? 0
      }
      return row
    }),
    [months, visibleCategories, trends]
  )

  // Per-category summary stats
  const summaryStats = useMemo(() =>
    visibleCategories.map(cat => {
      const key = String(cat.id)
      const catRows = trends.filter(t => String(t.categoryId) === key)
      const total = catRows.reduce((s, r) => s + r.total, 0)
      const avgPerMonth = catRows.length > 0 ? total / catRows.length : 0
      const peak = catRows.reduce<{ month: string; total: number } | null>((best, r) =>
        !best || r.total > best.total ? { month: r.month, total: r.total } : best, null
      )
      // Trend: compare first half vs second half of months with data
      const sorted = [...catRows].sort((a, b) => a.month.localeCompare(b.month))
      const mid = Math.floor(sorted.length / 2)
      const prev = sorted.slice(0, mid).reduce((s, r) => s + r.total, 0)
      const curr = sorted.slice(mid).reduce((s, r) => s + r.total, 0)
      const trendPct = prev > 0 ? ((curr - prev) / prev) * 100 : null
      return { ...cat, total, avgPerMonth, peak, trendPct }
    }),
    [visibleCategories, trends]
  )

  const avgByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of summaryStats) {
      map.set(String(s.id), s.avgPerMonth)
    }
    return map
  }, [summaryStats])

  function setPreset(p: Preset) {
    navigate({ search: { ...search, ...getPresetDates(p), preset: p } })
  }

  const { sorted: sortedStats, sortKey: statsSortKey, sortDir: statsSortDir, toggle: statsToggle } =
    useSortable(summaryStats, "total", "desc")

  const noData = trends.length === 0

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="animate-in space-y-3">
        <h1 className="text-xl font-bold tracking-tight">Category Trends</h1>

        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={v => v && setPreset(v as Preset)}>
            <TabsList>
              {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="whitespace-nowrap">{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <DatePicker
            value={search.dateFrom}
            onChange={v => navigate({ search: { ...search, dateFrom: v, preset: undefined } })}
            placeholder="From date"
          />
          <DatePicker
            value={search.dateTo}
            onChange={v => navigate({ search: { ...search, dateTo: v, preset: undefined } })}
            placeholder="To date"
          />
          {accounts.length > 1 && (
            <Select
              value={(search.accountIds ?? [])[0] ?? "all"}
              onValueChange={v => navigate({ search: { ...search, accountIds: v && v !== "all" ? [v] : undefined } })}
            >
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name ?? a.iban ?? a.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {noData ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-muted-foreground">No spending data for this period.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Chart card */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isSingle ? visibleCategories[0].name : "Spending by Category"}
              </CardTitle>
              <CardAction>
                <Tabs value={chartType} onValueChange={v => navigate({ search: { ...search, chart: v as ChartType } })}>
                  <TabsList>
                    <TabsTrigger value="area">Area</TabsTrigger>
                    <TabsTrigger value="bar">Bar</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map(cat => {
                  const key = String(cat.id)
                  const active = selected.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCategory(key)}
                      onDoubleClick={() => isolate(key)}
                      title="Click to toggle · Double-click to isolate"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                        active
                          ? "border-transparent text-foreground"
                          : "border-border bg-transparent text-muted-foreground opacity-40",
                      )}
                      style={active ? { backgroundColor: cat.color + "22", borderColor: cat.color + "66" } : {}}
                    >
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: active ? cat.color : undefined, background: active ? cat.color : "currentColor" }} />
                      {cat.name}
                    </button>
                  )
                })}
                {selected.size < allCategories.length && (
                  <button
                    onClick={selectAll}
                    className="inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Show all
                  </button>
                )}
              </div>

              {/* Chart */}
              {chartType === "area" ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      {visibleCategories.map(cat => (
                        <linearGradient key={cat.id} id={`grad-${cat.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cat.color} stopOpacity={isSingle ? 0.25 : 0.12} />
                          <stop offset="95%" stopColor={cat.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `€${(v/1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(v: any, name: any) => {
                        const cat = allCategories.find(c => String(c.id) === name)
                        return [formatCurrency(Number(v)), cat?.name ?? name]
                      }}
                      labelFormatter={(label: any) => formatMonth(String(label))}
                    />
                    {!isSingle && <Legend formatter={name => allCategories.find(c => String(c.id) === name)?.name ?? name} />}
                    {visibleCategories.map(cat => (
                      <Area
                        key={cat.id}
                        type="monotone"
                        dataKey={String(cat.id)}
                        stroke={cat.color}
                        strokeWidth={isSingle ? 2.5 : 1.5}
                        fill={`url(#grad-${cat.id})`}
                        dot={isSingle ? { r: 3, fill: cat.color } : false}
                      />
                    ))}
                    {months.length >= 3 && visibleCategories.map((cat) => {
                      const avg = avgByKey.get(String(cat.id))
                      if (!avg) return null
                      return (
                        <ReferenceLine
                          key={`avg-${cat.id}`}
                          y={avg}
                          stroke={cat.color}
                          strokeOpacity={0.6}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        >
                          {isSingle && (
                            <Label value="avg" position="insideRight" fontSize={10} fill={cat.color} fillOpacity={0.7} />
                          )}
                        </ReferenceLine>
                      )
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `€${(v/1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(v: any, name: any) => {
                        const cat = allCategories.find(c => String(c.id) === name)
                        return [formatCurrency(Number(v)), cat?.name ?? name]
                      }}
                      labelFormatter={(label: any) => formatMonth(String(label))}
                    />
                    {!isSingle && <Legend formatter={name => allCategories.find(c => String(c.id) === name)?.name ?? name} />}
                    {visibleCategories.map(cat => (
                      <Bar key={cat.id} dataKey={String(cat.id)} fill={cat.color} radius={[3,3,0,0]} maxBarSize={40} />
                    ))}
                    {months.length >= 3 && visibleCategories.map((cat) => {
                      const avg = avgByKey.get(String(cat.id))
                      if (!avg) return null
                      return (
                        <ReferenceLine
                          key={`avg-${cat.id}`}
                          y={avg}
                          stroke={cat.color}
                          strokeOpacity={0.6}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        >
                          {isSingle && (
                            <Label value="avg" position="insideRight" fontSize={10} fill={cat.color} fillOpacity={0.7} />
                          )}
                        </ReferenceLine>
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Summary table */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead id="name" sortKey={statsSortKey} sortDir={statsSortDir} onSort={statsToggle}>Category</SortableHead>
                    <SortableHead id="total" sortKey={statsSortKey} sortDir={statsSortDir} onSort={statsToggle} className="text-right">Total</SortableHead>
                    <SortableHead id="avgPerMonth" sortKey={statsSortKey} sortDir={statsSortDir} onSort={statsToggle} className="text-right hidden sm:table-cell">Avg / month</SortableHead>
                    <TableHead className="text-right hidden md:table-cell">Peak month</TableHead>
                    <SortableHead id="trendPct" sortKey={statsSortKey} sortDir={statsSortDir} onSort={statsToggle} className="text-right">Trend</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStats.map(cat => (
                    <TableRow
                      key={cat.id}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(String(cat.id))}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className={cn("font-medium", !selected.has(String(cat.id)) && "text-muted-foreground line-through")}>
                            {cat.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(cat.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {formatCurrency(cat.avgPerMonth)}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {cat.peak ? (
                          <span className="tabular-nums text-sm">
                            <span className="text-muted-foreground">{formatMonth(cat.peak.month)}</span>
                            {" "}<span className="font-medium">{formatCurrency(cat.peak.total)}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <TrendBadge pct={cat.trendPct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground/40 text-xs">—</span>
  const abs = Math.abs(pct)
  if (abs < 1) return (
    <span className="text-muted-foreground text-xs inline-flex items-center gap-0.5 justify-end">
      <Minus className="size-3" />0%
    </span>
  )
  // Spending up = bad (negative), spending down = good (positive)
  if (pct > 0) return (
    <span className="text-negative text-xs inline-flex items-center gap-0.5 justify-end">
      <TrendingUp className="size-3" />+{abs.toFixed(0)}%
    </span>
  )
  return (
    <span className="text-positive text-xs inline-flex items-center gap-0.5 justify-end">
      <TrendingDown className="size-3" />-{abs.toFixed(0)}%
    </span>
  )
}
