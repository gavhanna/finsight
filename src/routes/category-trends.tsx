import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { z } from "zod"
import { getSpendingTrends, getAccounts } from "../server/fn/insights"
import { getCategoryGroups, getCategories } from "../server/fn/categories"
import { daysAgo, startOfYear, todayStr } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendsChart } from "@/components/category-trends/trends-chart"
import { SummaryTable } from "@/components/category-trends/summary-table"

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
    case "ytd": return { dateFrom: startOfYear(), dateTo: today }
    case "12months": return { dateFrom: daysAgo(365), dateTo: today }
    case "all": return {}
  }
}

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["3months", "6months", "ytd", "12months", "all"]).optional(),
  chart: z.enum(["area", "bar"]).optional(),
  viewMode: z.enum(["categories", "groups"]).optional(),
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

  const catGroupMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of categoryList) {
      if (c.groupId != null) m.set(c.id, c.groupId)
    }
    return m
  }, [categoryList])

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

  const allItems = viewMode === "groups" ? allGroups : allCategories

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allItems.map(c => String(c.id))))

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

  function isolate(key: string) { setSelected(new Set([key])) }
  function selectAll() { setSelected(new Set(allItems.map(c => String(c.id)))) }

  const visibleItems = allItems.filter(c => selected.has(String(c.id)))
  const isSingle = visibleItems.length === 1
  const months = useMemo(() => [...new Set(trends.map(t => t.month))].sort(), [trends])

  const chartData = useMemo(() => {
    if (viewMode === "groups") {
      return months.map(month => {
        const row: Record<string, any> = { month }
        for (const group of visibleItems) {
          const groupId = group.id as number
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

  const summaryStats = useMemo(() => {
    if (viewMode === "groups") {
      return visibleItems.map(group => {
        const groupId = group.id as number
        const groupRows = trends.filter(t => {
          const catGroupId = t.categoryId != null ? (catGroupMap.get(t.categoryId) ?? 0) : 0
          return catGroupId === groupId
        })
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
    for (const s of summaryStats) map.set(String(s.id), s.avgPerMonth)
    return map
  }, [summaryStats])

  const noData = trends.length === 0

  return (
    <div className="p-4 sm:p-6 space-y-6 mx-auto w-full">
      {/* Header */}
      <div className="animate-in space-y-3">
        <h1 className="text-xl font-bold tracking-tight">Category Trends</h1>

        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={v => v && navigate({ search: { ...search, ...getPresetDates(v as Preset), preset: v as Preset } })}>
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
          <TrendsChart
            chartData={chartData}
            visibleItems={visibleItems}
            allItems={allItems}
            selected={selected}
            months={months}
            avgByKey={avgByKey}
            chartType={chartType}
            viewMode={viewMode}
            isSingle={isSingle}
            hasGroups={groups.length > 0}
            onToggleItem={toggleItem}
            onIsolateItem={isolate}
            onSelectAll={selectAll}
            onChartTypeChange={(t) => navigate({ search: { ...search, chart: t } })}
            onViewModeChange={(v) => navigate({ search: { ...search, viewMode: v } })}
          />

          <SummaryTable
            items={summaryStats}
            selected={selected}
            viewMode={viewMode}
            onToggle={toggleItem}
          />
        </div>
      )}
    </div>
  )
}
