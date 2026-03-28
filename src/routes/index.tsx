import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import {
  getSpendingByCategory,
  getSpendingTrends,
  getTopMerchants,
  getIncomeVsExpenses,
  getSummaryStats,
  getAccounts,
  getYearOverYearComparison,
} from "../server/fn/insights"
import { getSetting } from "../server/fn/settings"
import { formatCurrency } from "@/lib/utils"
import { getPresetDates } from "@/lib/presets"
import { DatePicker } from "@/components/ui/date-picker"
import { TrendingDown, TrendingUp, ArrowLeftRight, Hash } from "lucide-react"
import { z } from "zod"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/dashboard/stat-card"
import { NarrativeCard } from "@/components/dashboard/narrative-card"
import { SpendingPieChart } from "@/components/dashboard/spending-pie-chart"
import { SpendingBarChart } from "@/components/dashboard/spending-bar-chart"
import { SpendingTrendsChart } from "@/components/dashboard/spending-trends-chart"
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart"
import { TopMerchantsChart } from "@/components/dashboard/top-merchants-chart"
import { CashFlowTable } from "@/components/dashboard/cash-flow-table"
import { YearOverYearChart } from "@/components/dashboard/year-over-year-chart"

type DatePreset = "month" | "3months" | "6months" | "ytd" | "all"

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["month", "3months", "6months", "ytd", "all"]).default("3months"),
  chartType: z.enum(["pie", "bar"]).optional(),
})

export const Route = createFileRoute("/")({
  validateSearch: SearchSchema,
  component: DashboardPage,
  loaderDeps: ({ search }) => {
    const dates = !search.dateFrom && !search.dateTo
      ? getPresetDates(search.preset)
      : { dateFrom: search.dateFrom, dateTo: search.dateTo }
    return { ...search, dateFrom: dates.dateFrom, dateTo: dates.dateTo }
  },
  loader: async ({ deps }) => {
    const filters = {
      dateFrom: deps.dateFrom,
      dateTo: deps.dateTo,
      accountIds: deps.accountIds ?? [],
    }
    const [byCat, trends, merchants, incomeVsExp, stats, accounts, currency, yoy] =
      await Promise.all([
        getSpendingByCategory({ data: filters }),
        getSpendingTrends({ data: filters }),
        getTopMerchants({ data: { ...filters, limit: 10 } }),
        getIncomeVsExpenses({ data: filters }),
        getSummaryStats({ data: filters }),
        getAccounts(),
        getSetting({ data: "preferred_currency" }),
        getYearOverYearComparison({ data: filters }),
      ])
    return { byCat, trends, merchants, incomeVsExp, stats, accounts, currency: currency ?? "EUR", yoy }
  },
})

const PRESET_LABELS: Record<DatePreset, string> = {
  month: "This Month",
  "3months": "Last 3 Mo",
  "6months": "Last 6 Mo",
  ytd: "YTD",
  all: "All Time",
}


function DashboardPage() {
  const { byCat, trends, merchants, incomeVsExp, stats, accounts, currency, yoy } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const chartType = search.chartType ?? "pie"
  const preset = search.preset

  function setPreset(p: DatePreset) {
    const dates = getPresetDates(p)
    navigate({ search: { ...search, dateFrom: dates.dateFrom, dateTo: dates.dateTo, preset: p } })
  }

  function setChartType(t: "pie" | "bar") {
    navigate({ search: { ...search, chartType: t } })
  }

  const trendData = useMemo(() => {
    const allTrends = trends as Array<{ month: string; categoryName: string; categoryColor: string; total: number }>
    const months = [...new Set(allTrends.map((t) => t.month))].sort()
    const cats = [...new Set(allTrends.map((t) => t.categoryName))].slice(0, 6)
    return months.map((month) => {
      const row: Record<string, any> = { month }
      for (const cat of cats) {
        const found = allTrends.find((t) => t.month === month && t.categoryName === cat)
        row[cat] = found?.total ?? 0
      }
      return row
    })
  }, [trends])

  const trendCategories = useMemo(() => {
    const allTrends = trends as Array<{ month: string; categoryName: string; categoryColor: string; total: number }>
    const cats = [...new Set(allTrends.map((t) => t.categoryName))]
    return cats.slice(0, 6).map((name) => ({
      name: name as string,
      color: allTrends.find((t) => t.categoryName === name)?.categoryColor ?? "#94a3b8",
    }))
  }, [trends])

  const periodDelta = useMemo(() => {
    const data = incomeVsExp as Array<{ month: string; income: number; expenses: number; net: number }>
    if (data.length < 2) return null
    const mid = Math.floor(data.length / 2)
    const prev = data.slice(0, mid)
    const curr = data.slice(mid)
    const prevIncome = prev.reduce((s, d) => s + d.income, 0)
    const currIncome = curr.reduce((s, d) => s + d.income, 0)
    const prevExpenses = prev.reduce((s, d) => s + d.expenses, 0)
    const currExpenses = curr.reduce((s, d) => s + d.expenses, 0)
    return {
      income: prevIncome === 0 ? null : ((currIncome - prevIncome) / prevIncome) * 100,
      expenses: prevExpenses === 0 ? null : ((currExpenses - prevExpenses) / prevExpenses) * 100,
    }
  }, [incomeVsExp])

  const hasData = byCat.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Filters bar */}
      <div className="animate-in space-y-3">
        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={(v) => v && setPreset(v as DatePreset)}>
            <TabsList>
              {(Object.entries(PRESET_LABELS) as [DatePreset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="whitespace-nowrap text-xs">{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2 flex-wrap">
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
          </div>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Spend"
          value={formatCurrency(stats.totalExpenses, currency)}
          icon={<TrendingDown className="h-4 w-4 text-negative" />}
          sub="outgoing"
          delta={periodDelta?.expenses != null ? -periodDelta.expenses : undefined}
          accent="negative"
          className="animate-in stagger-1"
        />
        <StatCard
          label="Total Income"
          value={formatCurrency(stats.totalIncome, currency)}
          icon={<TrendingUp className="h-4 w-4 text-positive" />}
          sub="incoming"
          delta={periodDelta?.income}
          accent="positive"
          className="animate-in stagger-2"
        />
        <StatCard
          label="Net Balance"
          value={formatCurrency(stats.net, currency)}
          icon={<ArrowLeftRight className="h-4 w-4 text-neutral-data" />}
          sub={stats.net >= 0 ? "surplus" : "deficit"}
          valueClass={stats.net >= 0 ? "text-positive" : "text-negative"}
          accent={stats.net >= 0 ? "positive" : "negative"}
          className="animate-in stagger-3"
        />
        <StatCard
          label="Transactions"
          value={stats.count.toString()}
          icon={<Hash className="h-4 w-4 text-muted-foreground" />}
          sub="total"
          accent="neutral"
          className="animate-in stagger-4"
        />
      </div>

      {/* AI Narrative */}
      {hasData && (
        <div className="animate-in stagger-5">
          <NarrativeCard
            stats={stats}
            byCat={byCat}
            periodDelta={periodDelta}
            dateFrom={search.dateFrom}
            dateTo={search.dateTo}
            currency={currency}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasData ? (
        <div className="animate-in stagger-3 rounded-2xl border-2 border-dashed p-12 sm:p-20 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <TrendingUp className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No data for this period</p>
            <p className="text-sm text-muted-foreground">Connect a bank account and sync transactions to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6 animate-in stagger-6">
          <div className="space-y-2">
            <p className="section-label px-0.5">Cash Flow</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1">
                  <IncomeExpensesChart data={incomeVsExp} currency={currency} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <p className="section-label px-0.5">Year over Year</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1">
                  <YearOverYearChart current={yoy.current} lastYear={yoy.lastYear} currency={currency} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="section-label px-0.5">Spending by Category</p>
              <Card>
                <CardContent className="pt-5">
                  <div className="flex justify-end mb-2">
                    <Tabs value={chartType} onValueChange={(v) => v && setChartType(v as "pie" | "bar")}>
                      <TabsList className="h-7">
                        <TabsTrigger value="pie" className="text-xs px-2.5">Pie</TabsTrigger>
                        <TabsTrigger value="bar" className="text-xs px-2.5">Bar</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {chartType === "pie" ? (
                    <SpendingPieChart data={byCat} currency={currency} />
                  ) : (
                    <div className="chart-bg p-2 -mx-1">
                      <SpendingBarChart data={byCat} currency={currency} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <p className="section-label px-0.5">Spending Trends</p>
              <Card>
                <CardContent className="pt-5">
                  <div className="chart-bg p-2 -mx-1">
                    <SpendingTrendsChart data={trendData} categories={trendCategories} currency={currency} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-2">
            <p className="section-label px-0.5">Month by Month</p>
            <CashFlowTable data={incomeVsExp} stats={stats} currency={currency} />
          </div>

          <div className="space-y-2">
            <p className="section-label px-0.5">Top Merchants</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-2 -mx-1">
                  <TopMerchantsChart data={merchants} currency={currency} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
