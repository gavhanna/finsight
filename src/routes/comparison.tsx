import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { getSpendingTrends, getIncomeVsExpenses, getAccounts } from "../server/fn/insights"
import { formatYearMonth, todayStr } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { z } from "zod"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartTooltip } from "@/components/chart-tooltip"
import { ComparisonTable } from "@/components/comparison/comparison-table"

type Preset = "3months" | "6months" | "12months"

const PRESET_LABELS: Record<Preset, string> = {
  "3months": "Last 3 Months",
  "6months": "Last 6 Months",
  "12months": "Last 12 Months",
}

function startOfMonthsAgo(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n + 1)
  return d.toISOString().slice(0, 10)
}

function getPresetDates(preset: Preset) {
  const n = preset === "3months" ? 3 : preset === "6months" ? 6 : 12
  return { dateFrom: startOfMonthsAgo(n), dateTo: todayStr() }
}

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["3months", "6months", "12months"]).optional(),
})

export const Route = createFileRoute("/comparison")({
  validateSearch: SearchSchema,
  component: ComparisonPage,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const preset = deps.preset ?? "6months"
    const defaultDates = getPresetDates(preset)
    const filters = {
      dateFrom: deps.dateFrom ?? defaultDates.dateFrom,
      dateTo: deps.dateTo ?? defaultDates.dateTo,
      accountIds: deps.accountIds ?? [],
    }
    const [trends, incomeVsExp, accounts] = await Promise.all([
      getSpendingTrends({ data: filters }),
      getIncomeVsExpenses({ data: filters }),
      getAccounts(),
    ])
    return { trends, incomeVsExp, accounts }
  },
})

function ComparisonPage() {
  const { trends, incomeVsExp, accounts } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const preset = search.preset ?? "6months"

  function setPreset(p: Preset) {
    navigate({ search: { ...search, ...getPresetDates(p), preset: p } })
  }

  const months = useMemo(() => {
    const set = new Set(trends.map((t) => t.month))
    return [...set].sort()
  }, [trends])

  const categories = useMemo(() => {
    const catMap = new Map<string, { name: string; color: string; byMonth: Map<string, number> }>()
    for (const row of trends) {
      if (!catMap.has(row.categoryName)) {
        catMap.set(row.categoryName, { name: row.categoryName, color: row.categoryColor, byMonth: new Map() })
      }
      catMap.get(row.categoryName)!.byMonth.set(row.month, row.total)
    }
    return [...catMap.values()].sort((a, b) => {
      const aTotal = [...a.byMonth.values()].reduce((s, v) => s + v, 0)
      const bTotal = [...b.byMonth.values()].reduce((s, v) => s + v, 0)
      return bTotal - aTotal
    })
  }, [trends])

  const monthlyTotals = useMemo(() => {
    return months.map((month) => ({
      month,
      label: formatYearMonth(month),
      total: categories.reduce((sum, cat) => sum + (cat.byMonth.get(month) ?? 0), 0),
    }))
  }, [months, categories])

  const stackedData = useMemo(() => {
    return months.map((month) => {
      const row: Record<string, any> = { month, label: formatYearMonth(month) }
      for (const cat of categories) {
        row[cat.name] = cat.byMonth.get(month) ?? 0
      }
      return row
    })
  }, [months, categories])

  const incomeByMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of incomeVsExp) {
      map.set(row.month, row.income)
    }
    return map
  }, [incomeVsExp])

  const hasData = trends.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-6 mx-auto w-full">
      {/* Header + Filters */}
      <div className="animate-in space-y-3">
        <h1 className="text-xl font-bold tracking-tight">Monthly Comparison</h1>

        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={(v) => v && setPreset(v as Preset)}>
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
            onChange={(v) => navigate({ search: { ...search, dateFrom: v, preset: undefined } })}
            placeholder="From date"
          />
          <DatePicker
            value={search.dateTo}
            onChange={(v) => navigate({ search: { ...search, dateTo: v, preset: undefined } })}
            placeholder="To date"
          />
          {accounts.length > 1 && (
            <Select
              value={(search.accountIds ?? [])[0] ?? "all"}
              onValueChange={(v) => navigate({ search: { ...search, accountIds: v && v !== "all" ? [v] : undefined } })}
            >
              <SelectTrigger className="w-full sm:w-auto">
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

      {!hasData ? (
        <div className="rounded-lg border-2 border-dashed p-8 sm:p-16 text-center">
          <p className="text-muted-foreground">No transaction data for this period.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a bank account and sync transactions to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="section-label">Monthly Spending Overview</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1 overflow-x-auto">
                  <div style={{ minWidth: Math.max(480, stackedData.length * 56) }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={stackedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} width={48} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
                        {categories.map((cat, i) => (
                          <Bar
                            key={cat.name}
                            dataKey={cat.name}
                            stackId="a"
                            fill={cat.color}
                            radius={i === categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                            maxBarSize={40}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <ComparisonTable
            months={months}
            categories={categories}
            monthlyTotals={monthlyTotals}
            incomeByMonth={incomeByMonth}
          />
        </>
      )}
    </div>
  )
}
