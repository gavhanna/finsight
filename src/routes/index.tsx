import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table"
import {
  getSpendingByCategory,
  getSpendingTrends,
  getTopMerchants,
  getIncomeVsExpenses,
  getSummaryStats,
  getAccounts,
  generateNarrative,
} from "../server/fn/insights"
import { formatCurrency, startOfMonth, daysAgo, startOfYear, todayStr } from "../lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts"
import { TrendingDown, TrendingUp, ArrowLeftRight, Hash, Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { z } from "zod"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type DatePreset = "month" | "3months" | "6months" | "ytd" | "all"

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${monthNames[parseInt(month, 10) - 1]} '${year.slice(2)}`
}

const SearchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  preset: z.enum(["month", "3months", "6months", "ytd", "all"]).optional(),
  chartType: z.enum(["pie", "bar"]).optional(),
})

export const Route = createFileRoute("/")({
  validateSearch: SearchSchema,
  component: DashboardPage,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const filters = {
      dateFrom: deps.dateFrom,
      dateTo: deps.dateTo,
      accountIds: deps.accountIds ?? [],
    }
    const [byCat, trends, merchants, incomeVsExp, stats, accounts] =
      await Promise.all([
        getSpendingByCategory({ data: filters }),
        getSpendingTrends({ data: filters }),
        getTopMerchants({ data: { ...filters, limit: 10 } }),
        getIncomeVsExpenses({ data: filters }),
        getSummaryStats({ data: filters }),
        getAccounts(),
      ])
    return { byCat, trends, merchants, incomeVsExp, stats, accounts }
  },
})

const PRESET_LABELS: Record<DatePreset, string> = {
  month: "This Month",
  "3months": "Last 3 Mo",
  "6months": "Last 6 Mo",
  ytd: "YTD",
  all: "All Time",
}

function getPresetDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  const today = todayStr()
  switch (preset) {
    case "month":    return { dateFrom: startOfMonth(), dateTo: today }
    case "3months":  return { dateFrom: daysAgo(90), dateTo: today }
    case "6months":  return { dateFrom: daysAgo(180), dateTo: today }
    case "ytd":      return { dateFrom: startOfYear(), dateTo: today }
    case "all":      return {}
  }
}

// ── Custom Recharts tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, labelFormatter }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  labelFormatter?: (label: string) => string
}) {
  if (!active || !payload?.length) return null
  const displayLabel = labelFormatter ? labelFormatter(label ?? "") : label
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm shadow-xl px-3.5 py-2.5 text-sm min-w-36">
      {displayLabel && (
        <p className="font-semibold text-foreground text-xs mb-2 pb-1.5 border-b">{displayLabel}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground text-xs">{entry.name}</span>
            </div>
            <span className="font-semibold tabular-nums text-xs text-foreground">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

function DashboardPage() {
  const { byCat, trends, merchants, incomeVsExp, stats, accounts } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const chartType = search.chartType ?? "pie"
  const preset = search.preset ?? "month"

  function setPreset(p: DatePreset) {
    const dates = getPresetDates(p)
    navigate({ search: { ...search, ...dates, preset: p } })
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
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl">

      {/* Filters bar */}
      <div className="animate-in space-y-3">
        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={(v) => v && setPreset(v as DatePreset)}>
            <TabsList>
              {(Object.entries(PRESET_LABELS) as [DatePreset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="whitespace-nowrap text-xs">
                  {label}
                </TabsTrigger>
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
          value={formatCurrency(stats.totalExpenses)}
          icon={<TrendingDown className="h-4 w-4 text-negative" />}
          sub="outgoing"
          delta={periodDelta?.expenses != null ? -periodDelta.expenses : undefined}
          accent="negative"
          className="animate-in stagger-1"
        />
        <StatCard
          label="Total Income"
          value={formatCurrency(stats.totalIncome)}
          icon={<TrendingUp className="h-4 w-4 text-positive" />}
          sub="incoming"
          delta={periodDelta?.income}
          accent="positive"
          className="animate-in stagger-2"
        />
        <StatCard
          label="Net Balance"
          value={formatCurrency(stats.net)}
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

          {/* Monthly Cash Flow — full width */}
          <div className="space-y-2">
            <p className="section-label px-0.5">Cash Flow</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1">
                  <IncomeExpensesChart data={incomeVsExp} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2-col: Category + Trends */}
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="section-label px-0.5">Spending by Category</p>
              <Card>
                <CardHeader className="pb-2">
                  <CardAction>
                    <Tabs value={chartType} onValueChange={(v) => v && setChartType(v as "pie" | "bar")}>
                      <TabsList className="h-7">
                        <TabsTrigger value="pie" className="text-xs px-2.5">Pie</TabsTrigger>
                        <TabsTrigger value="bar" className="text-xs px-2.5">Bar</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {chartType === "pie" ? (
                    <SpendingPieChart data={byCat} />
                  ) : (
                    <div className="chart-bg p-2 -mx-1">
                      <SpendingBarChart data={byCat} />
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
                    <SpendingTrendsChart data={trendData} categories={trendCategories} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Month by Month table */}
          <div className="space-y-2">
            <p className="section-label px-0.5">Month by Month</p>
            <CashFlowTable data={incomeVsExp} stats={stats} />
          </div>

          {/* Top merchants */}
          <div className="space-y-2">
            <p className="section-label px-0.5">Top Merchants</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-2 -mx-1">
                  <TopMerchantsChart data={merchants} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  sub,
  valueClass,
  delta,
  accent = "neutral",
  className,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  valueClass?: string
  delta?: number | null
  accent?: "positive" | "negative" | "neutral" | "primary"
  className?: string
}) {
  const accentClass = {
    positive: "accent-positive",
    negative: "accent-negative",
    neutral:  "accent-neutral",
    primary:  "accent-primary",
  }[accent]

  return (
    <Card className={cn("hover-glow overflow-hidden", accentClass, className)}>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <span className="section-label">{label}</span>
          <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
            {icon}
          </div>
        </div>
        <p className={cn("metric-number", valueClass)}>{value}</p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground capitalize">{sub}</p>
          {delta != null && (
            delta >= 0 ? (
              <span className="delta-up">
                <ArrowUpRight className="size-2.5" />
                {delta.toFixed(1)}%
              </span>
            ) : (
              <span className="delta-down">
                <ArrowDownRight className="size-2.5" />
                {Math.abs(delta).toFixed(1)}%
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Narrative Card ─────────────────────────────────────────────────────────────

function NarrativeCard({
  stats,
  byCat,
  periodDelta,
  dateFrom,
  dateTo,
}: {
  stats: { totalIncome: number; totalExpenses: number; net: number }
  byCat: { categoryName: string; total: number }[]
  periodDelta: { income: number | null; expenses: number | null } | null
  dateFrom?: string
  dateTo?: string
}) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const savingsRate = stats.totalIncome > 0 ? (stats.net / stats.totalIncome) * 100 : null

  async function handleGenerate() {
    setLoading(true)
    setNarrative(null)
    setError(null)
    try {
      const result = await generateNarrative({
        data: {
          dateFrom,
          dateTo,
          totalIncome: stats.totalIncome,
          totalExpenses: stats.totalExpenses,
          net: stats.net,
          savingsRate,
          topCategories: byCat.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total })),
          periodDelta: periodDelta ?? null,
          currency: "EUR",
        },
      })
      if (result.error) setError(result.error)
      else setNarrative(result.narrative)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="ai-gradient border-primary/15 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="rounded-md bg-primary/15 p-1 text-primary">
            <Sparkles className="size-3.5" />
          </div>
          AI Financial Summary
        </CardTitle>
        <CardAction>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 rounded-md px-2 py-1 hover:bg-primary/8"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            {narrative ? "Regenerate" : "Generate"}
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {narrative ? (
          <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground/70 italic">
            {loading
              ? "Analysing your financial data…"
              : "Generate an AI-written narrative summary of your finances for this period."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Chart color palette ────────────────────────────────────────────────────────

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
]

// ── Charts ────────────────────────────────────────────────────────────────────

function SpendingPieChart({ data }: { data: { categoryName: string; categoryColor: string; total: number; count: number }[] }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
      <ResponsiveContainer width="100%" height={200} className="sm:w-[50%] sm:flex-shrink-0">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={82}
            innerRadius={44}
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.categoryColor} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1 overflow-auto max-h-48">
        {data.map((d) => (
          <div key={d.categoryName} className="flex items-center gap-2 text-sm py-0.5 group">
            <div className="h-2 w-2 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: d.categoryColor }} />
            <span className="flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">{d.categoryName}</span>
            <span className="font-semibold tabular-nums text-xs">{formatCurrency(d.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpendingBarChart({ data }: { data: { categoryName: string; categoryColor: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={20}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.categoryColor ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function SpendingTrendsChart({
  data,
  categories,
}: {
  data: Record<string, any>[]
  categories: { name: string; color: string }[]
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No trend data.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          content={<ChartTooltip labelFormatter={formatMonth} />}
        />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
        {categories.map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function IncomeExpensesChart({
  data,
}: {
  data: { month: string; income: number; expenses: number; net: number }[]
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
  }

  const dataWithRate = data.map((d) => ({
    ...d,
    savingsRate: d.income > 0 ? Math.round((d.net / d.income) * 100) : null,
  }))

  const interval = data.length > 6 ? Math.floor(data.length / 6) : 0
  const formatted = dataWithRate.map((d) => ({ ...d, month: formatMonth(d.month) }))

  const hasRateData = data.filter((d) => d.income > 0).length >= 2

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={interval} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        {hasRateData && (
          <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        )}
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
        <ReferenceLine yAxisId="left" y={0} stroke="oklch(0.5 0 0 / 0.15)" strokeWidth={1.5} />
        <Line yAxisId="left" type="monotone" dataKey="income" name="Income" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="net" name="Net" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        {hasRateData && (
          <Line yAxisId="rate" type="monotone" dataKey="savingsRate" name="Savings Rate" stroke="var(--color-chart-3)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

function TopMerchantsChart({ data }: { data: { name: string; total: number; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No merchant data.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 140, right: 40 }}>
        <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Cash Flow Table ────────────────────────────────────────────────────────────

function CashFlowTable({
  data,
  stats,
}: {
  data: { month: string; income: number; expenses: number; net: number }[]
  stats: { totalIncome: number; totalExpenses: number; net: number; count: number }
}) {
  if (data.length < 2) return null
  const dataWithRate = data.map((r) => ({
    ...r,
    savingsRate: r.income > 0 ? r.net / r.income : null,
  }))
  const { sorted, sortKey, sortDir, toggle } = useSortable(dataWithRate, "month")

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <SortableHead id="month" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="pl-5">Month</SortableHead>
              <SortableHead id="income" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Income</SortableHead>
              <SortableHead id="expenses" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Expenses</SortableHead>
              <SortableHead id="net" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Net</SortableHead>
              <SortableHead id="savingsRate" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right pr-5 hidden sm:table-cell">Savings Rate</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const net = row.net
              const savingsRate = row.income > 0 ? `${((net / row.income) * 100).toFixed(0)}%` : "—"
              const savingsPositive = row.income > 0 && net > 0
              return (
                <TableRow key={row.month} className="hover:bg-muted/30">
                  <TableCell className="pl-5 font-medium">{formatMonth(row.month)}</TableCell>
                  <TableCell className="text-right text-positive tabular-nums">{formatCurrency(row.income)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.expenses)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums font-semibold", net >= 0 ? "text-positive" : "text-negative")}>
                    {formatCurrency(net)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums pr-5 hidden sm:table-cell", savingsPositive ? "text-positive" : "text-muted-foreground")}>
                    {savingsRate}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold pl-5">Total</TableCell>
              <TableCell className="text-right text-positive tabular-nums font-bold">{formatCurrency(stats.totalIncome)}</TableCell>
              <TableCell className="text-right tabular-nums font-bold text-muted-foreground">{formatCurrency(stats.totalExpenses)}</TableCell>
              <TableCell className={cn("text-right tabular-nums font-bold", stats.net >= 0 ? "text-positive" : "text-negative")}>
                {formatCurrency(stats.net)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums font-bold pr-5 hidden sm:table-cell", stats.totalIncome > 0 && stats.net > 0 ? "text-positive" : "text-muted-foreground")}>
                {stats.totalIncome > 0 ? `${((stats.net / stats.totalIncome) * 100).toFixed(0)}%` : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
