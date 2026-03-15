import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import {
  getSpendingByCategory,
  getSpendingTrends,
  getTopMerchants,
  getIncomeVsExpenses,
  getSummaryStats,
  getAccounts,
} from "../server/fn/insights"
import { formatCurrency, startOfMonth, daysAgo, startOfYear, todayStr } from "../lib/utils"
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
} from "recharts"
import { TrendingDown, TrendingUp, ArrowLeftRight, Hash } from "lucide-react"
import { z } from "zod"

type DatePreset = "month" | "3months" | "6months" | "ytd" | "all"

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
  "3months": "Last 3 Months",
  "6months": "Last 6 Months",
  ytd: "Year to Date",
  all: "All Time",
}

function getPresetDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  const today = todayStr()
  switch (preset) {
    case "month":
      return { dateFrom: startOfMonth(), dateTo: today }
    case "3months":
      return { dateFrom: daysAgo(90), dateTo: today }
    case "6months":
      return { dateFrom: daysAgo(180), dateTo: today }
    case "ytd":
      return { dateFrom: startOfYear(), dateTo: today }
    case "all":
      return {}
  }
}

function DashboardPage() {
  const { byCat, trends, merchants, incomeVsExp, stats, accounts } =
    Route.useLoaderData()
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

  // Build trend chart data
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

  const hasData = byCat.length > 0

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex-1">Dashboard</h1>

        {/* Date presets */}
        <div className="flex gap-1 rounded-lg border p-1">
          {(Object.entries(PRESET_LABELS) as [DatePreset, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${preset === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex gap-2">
          <input
            type="date"
            value={search.dateFrom ?? ""}
            onChange={(e) => navigate({ search: { ...search, dateFrom: e.target.value || undefined, preset: undefined } })}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={search.dateTo ?? ""}
            onChange={(e) => navigate({ search: { ...search, dateTo: e.target.value || undefined, preset: undefined } })}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Account filter */}
        {accounts.length > 1 && (
          <select
            value={(search.accountIds ?? [])[0] ?? ""}
            onChange={(e) => navigate({ search: { ...search, accountIds: e.target.value ? [e.target.value] : undefined } })}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name ?? a.iban ?? a.id}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Spend"
          value={formatCurrency(stats.totalExpenses)}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          sub="outgoing"
        />
        <StatCard
          label="Total Income"
          value={formatCurrency(stats.totalIncome)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          sub="incoming"
        />
        <StatCard
          label="Net"
          value={formatCurrency(stats.net)}
          icon={<ArrowLeftRight className="h-4 w-4 text-blue-500" />}
          sub={stats.net >= 0 ? "surplus" : "deficit"}
          valueClass={stats.net >= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatCard
          label="Transactions"
          value={stats.count.toString()}
          icon={<Hash className="h-4 w-4 text-muted-foreground" />}
          sub="total"
        />
      </div>

      {!hasData ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center">
          <p className="text-muted-foreground">No transaction data for this period.</p>
          <p className="text-sm text-muted-foreground mt-1">Connect a bank account and sync transactions to get started.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spending by category */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Spending by Category</h2>
              <div className="flex gap-1 rounded border p-0.5">
                <button
                  onClick={() => setChartType("pie")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartType === "pie" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Pie
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${chartType === "bar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Bar
                </button>
              </div>
            </div>
            {chartType === "pie" ? (
              <SpendingPieChart data={byCat} />
            ) : (
              <SpendingBarChart data={byCat} />
            )}
          </div>

          {/* Income vs Expenses */}
          <div className="rounded-lg border p-4 space-y-3">
            <h2 className="font-semibold">Income vs Expenses</h2>
            <IncomeExpensesChart data={incomeVsExp} />
          </div>

          {/* Spending trends */}
          <div className="rounded-lg border p-4 space-y-3 lg:col-span-2">
            <h2 className="font-semibold">Spending Trends</h2>
            <SpendingTrendsChart data={trendData} categories={trendCategories} />
          </div>

          {/* Top merchants */}
          <div className="rounded-lg border p-4 space-y-3 lg:col-span-2">
            <h2 className="font-semibold">Top Merchants</h2>
            <TopMerchantsChart data={merchants} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
  valueClass,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueClass ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 capitalize">{sub}</p>
    </div>
  )
}

function SpendingPieChart({ data }: { data: { categoryName: string; categoryColor: string; total: number; count: number }[] }) {
  return (
    <div className="flex gap-4 items-center">
      <ResponsiveContainer width="50%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={45}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.categoryColor} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 overflow-auto max-h-52">
        {data.map((d) => (
          <div key={d.categoryName} className="flex items-center gap-2 text-sm">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.categoryColor }} />
            <span className="flex-1 truncate">{d.categoryName}</span>
            <span className="font-medium tabular-nums">{formatCurrency(d.total)}</span>
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
        <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11 }} width={80} />
        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.categoryColor} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        <Legend />
        {categories.map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
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
        <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        <Legend />
        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
