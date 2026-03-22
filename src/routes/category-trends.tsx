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
import { getCategoryGroups, getCategories } from "../server/fn/categories"
import { formatCurrency, formatYearMonth, daysAgo, startOfYear, todayStr, cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"

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

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["3months","6months","ytd","12months","all"]).optional(),
  chart: z.enum(["area","bar"]).optional(),
  viewMode: z.enum(["categories","groups"]).optional(),
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
    const [trends, accounts, groups, categoryList] = await Promise.all([
      getSpendingTrends({ data: filters }),
      getAccounts(),
      getCategoryGroups(),
      getCategories(),
    ])
    return { trends, accounts, groups, categoryList }
  },
  component: CategoryTrendsPage,
})

type TrendRow = { month: string; categoryId: number | null; categoryName: string; categoryColor: string; total: number }

const UNGROUPED = { id: 0, name: "Ungrouped", color: "#6b7280" }

function CategoryTrendsPage() {
  const { trends: rawTrends, accounts, groups, categoryList } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const trends = rawTrends as TrendRow[]
  const preset = search.preset ?? "6months"
  const chartType: ChartType = search.chart ?? "area"
  const viewMode = search.viewMode ?? "categories"

  // Build a map from categoryId -> groupId for client-side aggregation
  const catGroupMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of categoryList) {
      if (c.groupId != null) m.set(c.id, c.groupId)
    }
    return m
  }, [categoryList])

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

  // All groups present in this period (based on which categories have data)
  const allGroups = useMemo(() => {
    const seen = new Map<string, { id: number; name: string; color: string; total: number }>()
    for (const cat of allCategories) {
      const groupId = cat.id != null ? (catGroupMap.get(cat.id) ?? 0) : 0
      const group = groupId === 0 ? UNGROUPED : (groups.find(g => g.id === groupId) ?? UNGROUPED)
      const key = String(group.id)
      const existing = seen.get(key)
      seen.set(key, { ...group, total: (existing?.total ?? 0) + cat.total })
    }
    return [...seen.values()].sort((a, b) => b.total - a.total)
  }, [allCategories, catGroupMap, groups])

  // Items shown in chips/chart depend on view mode
  const allItems = viewMode === "groups" ? allGroups : allCategories

  // Selected IDs (null = "Uncategorised" in category mode, 0 = "Ungrouped" in group mode)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allItems.map(c => String(c.id))))

  // Sync selection when item list changes (new data loaded or mode switched)
  const allKeys = allItems.map(c => String(c.id)).join(",")
  useMemo(() => {
    setSelected(new Set(allItems.map(c => String(c.id))))
  }, [allKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleItem(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
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
    setSelected(new Set(allItems.map(c => String(c.id))))
  }

  const visibleItems = allItems.filter(c => selected.has(String(c.id)))
  const isSingle = visibleItems.length === 1

  // Pivot data for categories mode
  const months = useMemo(() => [...new Set(trends.map(t => t.month))].sort(), [trends])

  const chartData = useMemo(() => {
    if (viewMode === "groups") {
      // Aggregate by group per month
      return months.map(month => {
        const row: Record<string, any> = { month }
        for (const group of visibleItems) {
          const groupId = group.id as number
          // Sum all categories in this group for this month
          const total = trends
            .filter(t => t.month === month)
            .filter(t => {
              const catGroupId = t.categoryId != null ? (catGroupMap.get(t.categoryId) ?? 0) : 0
              return catGroupId === groupId
            })
            .reduce((s, r) => s + r.total, 0)
          row[String(groupId)] = total
        }
        return row
      })
    }
    // Categories mode
    return months.map(month => {
      const row: Record<string, any> = { month }
      for (const cat of visibleItems) {
        const key = String(cat.id)
        const found = trends.find(t => t.month === month && String(t.categoryId) === key)
        row[key] = found?.total ?? 0
      }
      return row
    })
  }, [months, visibleItems, trends, viewMode, catGroupMap])

  // Per-item summary stats
  const summaryStats = useMemo(() => {
    if (viewMode === "groups") {
      return visibleItems.map(group => {
        const groupId = group.id as number
        // Collect all trend rows belonging to this group
        const groupRows = trends.filter(t => {
          const catGroupId = t.categoryId != null ? (catGroupMap.get(t.categoryId) ?? 0) : 0
          return catGroupId === groupId
        })
        // Aggregate by month
        const byMonth = new Map<string, number>()
        for (const r of groupRows) {
          byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.total)
        }
        const monthEntries = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
        const total = monthEntries.reduce((s, [, v]) => s + v, 0)
        const avgPerMonth = monthEntries.length > 0 ? total / monthEntries.length : 0
        const peak = monthEntries.reduce<{ month: string; total: number } | null>((best, [month, t]) =>
          !best || t > best.total ? { month, total: t } : best, null
        )
        const mid = Math.floor(monthEntries.length / 2)
        const prev = monthEntries.slice(0, mid).reduce((s, [, v]) => s + v, 0)
        const curr = monthEntries.slice(mid).reduce((s, [, v]) => s + v, 0)
        const trendPct = prev > 0 ? ((curr - prev) / prev) * 100 : null
        return { ...group, total, avgPerMonth, peak, trendPct }
      })
    }
    return visibleItems.map(cat => {
      const key = String(cat.id)
      const catRows = trends.filter(t => String(t.categoryId) === key)
      const total = catRows.reduce((s, r) => s + r.total, 0)
      const avgPerMonth = catRows.length > 0 ? total / catRows.length : 0
      const peak = catRows.reduce<{ month: string; total: number } | null>((best, r) =>
        !best || r.total > best.total ? { month: r.month, total: r.total } : best, null
      )
      const sorted = [...catRows].sort((a, b) => a.month.localeCompare(b.month))
      const mid = Math.floor(sorted.length / 2)
      const prev = sorted.slice(0, mid).reduce((s, r) => s + r.total, 0)
      const curr = sorted.slice(mid).reduce((s, r) => s + r.total, 0)
      const trendPct = prev > 0 ? ((curr - prev) / prev) * 100 : null
      return { ...cat, total, avgPerMonth, peak, trendPct }
    })
  }, [visibleItems, trends, viewMode, catGroupMap])

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
                {isSingle ? visibleItems[0].name : viewMode === "groups" ? "Spending by Group" : "Spending by Category"}
              </CardTitle>
              <CardAction>
                <div className="flex items-center gap-2">
                  {groups.length > 0 && (
                    <Tabs value={viewMode} onValueChange={v => navigate({ search: { ...search, viewMode: v as "categories" | "groups" } })}>
                      <TabsList>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="groups">Groups</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  <Tabs value={chartType} onValueChange={v => navigate({ search: { ...search, chart: v as ChartType } })}>
                    <TabsList>
                      <TabsTrigger value="area">Area</TabsTrigger>
                      <TabsTrigger value="bar">Bar</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chips */}
              <div className="flex flex-wrap gap-1.5">
                {allItems.map(item => {
                  const key = String(item.id)
                  const active = selected.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleItem(key)}
                      onDoubleClick={() => isolate(key)}
                      title="Click to toggle · Double-click to isolate"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                        active
                          ? "border-transparent text-foreground"
                          : "border-border bg-transparent text-muted-foreground opacity-40",
                      )}
                      style={active ? { backgroundColor: item.color + "22", borderColor: item.color + "66" } : {}}
                    >
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: active ? item.color : undefined, background: active ? item.color : "currentColor" }} />
                      {item.name}
                    </button>
                  )
                })}
                {selected.size < allItems.length && (
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
                <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(480, chartData.length * 56) }}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      {visibleItems.map(item => (
                        <linearGradient key={item.id} id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={item.color} stopOpacity={isSingle ? 0.25 : 0.12} />
                          <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `€${(v/1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(v: any, name: any) => {
                        const item = allItems.find(c => String(c.id) === name)
                        return [formatCurrency(Number(v)), item?.name ?? name]
                      }}
                      labelFormatter={(label: any) => formatYearMonth(String(label))}
                    />
                    {!isSingle && <Legend formatter={name => allItems.find(c => String(c.id) === name)?.name ?? name} />}
                    {visibleItems.map(item => (
                      <Area
                        key={item.id}
                        type="monotone"
                        dataKey={String(item.id)}
                        stroke={item.color}
                        strokeWidth={isSingle ? 2.5 : 1.5}
                        fill={`url(#grad-${item.id})`}
                        dot={isSingle ? { r: 3, fill: item.color } : false}
                      />
                    ))}
                    {months.length >= 3 && visibleItems.map((item) => {
                      const avg = avgByKey.get(String(item.id))
                      if (!avg) return null
                      return (
                        <ReferenceLine
                          key={`avg-${item.id}`}
                          y={avg}
                          stroke={item.color}
                          strokeOpacity={0.6}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        >
                          {isSingle && (
                            <Label value="avg" position="insideRight" fontSize={10} fill={item.color} fillOpacity={0.7} />
                          )}
                        </ReferenceLine>
                      )
                    })}
                  </AreaChart>
                </ResponsiveContainer>
                </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(480, chartData.length * 56) }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `€${(v/1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(v: any, name: any) => {
                        const item = allItems.find(c => String(c.id) === name)
                        return [formatCurrency(Number(v)), item?.name ?? name]
                      }}
                      labelFormatter={(label: any) => formatYearMonth(String(label))}
                    />
                    {!isSingle && <Legend formatter={name => allItems.find(c => String(c.id) === name)?.name ?? name} />}
                    {visibleItems.map(item => (
                      <Bar key={item.id} dataKey={String(item.id)} fill={item.color} radius={[3,3,0,0]} maxBarSize={40} />
                    ))}
                    {months.length >= 3 && visibleItems.map((item) => {
                      const avg = avgByKey.get(String(item.id))
                      if (!avg) return null
                      return (
                        <ReferenceLine
                          key={`avg-${item.id}`}
                          y={avg}
                          stroke={item.color}
                          strokeOpacity={0.6}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        >
                          {isSingle && (
                            <Label value="avg" position="insideRight" fontSize={10} fill={item.color} fillOpacity={0.7} />
                          )}
                        </ReferenceLine>
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
                </div>
                </div>
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
                    <SortableHead id="name" sortKey={statsSortKey} sortDir={statsSortDir} onSort={statsToggle}>{viewMode === "groups" ? "Group" : "Category"}</SortableHead>
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
                      onClick={() => toggleItem(String(cat.id))}
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
                            <span className="text-muted-foreground">{formatYearMonth(cat.peak.month)}</span>
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
