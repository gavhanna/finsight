import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getSpendingByCategory,
  getSpendingTrends,
  getTopMerchants,
  getIncomeVsExpenses,
  getSummaryStats,
  getAccounts,
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
  ComposedChart,
  ReferenceLine,
} from "recharts"
import { TrendingDown, TrendingUp, ArrowLeftRight, Hash } from "lucide-react"
import { z } from "zod"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      {/* Header + Filters */}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        {/* Date presets */}
        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={(v) => v && setPreset(v as DatePreset)}>
            <TabsList>
              {(Object.entries(PRESET_LABELS) as [DatePreset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="whitespace-nowrap">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Custom date range */}
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

          {/* Account filter */}
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
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          sub="outgoing"
          delta={periodDelta?.expenses != null ? -periodDelta.expenses : undefined}
        />
        <StatCard
          label="Total Income"
          value={formatCurrency(stats.totalIncome)}
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          sub="incoming"
          delta={periodDelta?.income}
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
        <div className="rounded-lg border-2 border-dashed p-8 sm:p-16 text-center">
          <p className="text-muted-foreground">No transaction data for this period.</p>
          <p className="text-sm text-muted-foreground mt-1">Connect a bank account and sync transactions to get started.</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Monthly Cash Flow — full width */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <IncomeExpensesChart data={incomeVsExp} />
            </CardContent>
          </Card>

          {/* 2-col grid: Category + Trends */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Spending by category */}
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardAction>
                  <Tabs value={chartType} onValueChange={(v) => v && setChartType(v as "pie" | "bar")}>
                    <TabsList>
                      <TabsTrigger value="pie">Pie</TabsTrigger>
                      <TabsTrigger value="bar">Bar</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardAction>
              </CardHeader>
              <CardContent>
                {chartType === "pie" ? (
                  <SpendingPieChart data={byCat} />
                ) : (
                  <SpendingBarChart data={byCat} />
                )}
              </CardContent>
            </Card>

            {/* Spending trends */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendingTrendsChart data={trendData} categories={trendCategories} />
              </CardContent>
            </Card>
          </div>

          {/* Month by Month table — full width */}
          <CashFlowTable data={incomeVsExp} stats={stats} />

          {/* Top merchants — full width */}
          <Card>
            <CardHeader>
              <CardTitle>Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <TopMerchantsChart data={merchants} />
            </CardContent>
          </Card>
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
  delta,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  valueClass?: string
  delta?: number | null
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className={`text-xl sm:text-2xl font-bold tabular-nums ${valueClass ?? ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground capitalize">{sub}</p>
        {delta != null && (
          <p className={`text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs prior period
          </p>
        )}
      </CardContent>
    </Card>
  )
}

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
            outerRadius={80}
            innerRadius={40}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.categoryColor} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 overflow-auto max-h-48">
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

function CashFlowTable({
  data,
  stats,
}: {
  data: { month: string; income: number; expenses: number; net: number }[]
  stats: { totalIncome: number; totalExpenses: number; net: number; count: number }
}) {
  if (data.length < 2) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Month by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Savings Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const net = row.net
              const savingsRate = row.income > 0 ? `${((net / row.income) * 100).toFixed(0)}%` : "—"
              const savingsPositive = row.income > 0 && net > 0
              return (
                <TableRow key={row.month}>
                  <TableCell>{formatMonth(row.month)}</TableCell>
                  <TableCell className="text-right text-green-600 tabular-nums">{formatCurrency(row.income)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.expenses)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {formatCurrency(net)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${savingsPositive ? "text-green-600" : ""}`}>
                    {savingsRate}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right text-green-600 tabular-nums font-semibold">{formatCurrency(stats.totalIncome)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(stats.totalExpenses)}</TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${stats.net >= 0 ? "text-green-600" : "text-red-500"}`}>
                {formatCurrency(stats.net)}
              </TableCell>
              <TableCell className={`text-right tabular-nums font-semibold ${stats.totalIncome > 0 && stats.net > 0 ? "text-green-600" : ""}`}>
                {stats.totalIncome > 0 ? `${((stats.net / stats.totalIncome) * 100).toFixed(0)}%` : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
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
  const interval = data.length > 6 ? Math.floor(data.length / 6) : 0
  const formatted = data.map((d) => ({ ...d, month: formatMonth(d.month) }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={interval} />
        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
        <Legend />
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
        <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
        <Bar dataKey="net" name="Net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
