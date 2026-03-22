import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { getSpendingTrends, getIncomeVsExpenses, getAccounts } from "../server/fn/insights"
import { formatCurrency, formatYearMonth, todayStr } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { z } from "zod"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm shadow-xl px-3.5 py-2.5 text-sm min-w-36">
      {label && <p className="font-semibold text-foreground text-xs mb-2 pb-1.5 border-b">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? entry.fill }} />
              <span className="text-muted-foreground text-xs">{entry.name ?? "Spending"}</span>
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
    const dates = getPresetDates(p)
    navigate({ search: { ...search, ...dates, preset: p } })
  }

  const months = useMemo(() => {
    const set = new Set(trends.map((t) => t.month))
    return [...set].sort()
  }, [trends])

  const categories = useMemo(() => {
    const catMap = new Map<
      string,
      { name: string; color: string; byMonth: Map<string, number> }
    >()
    for (const row of trends) {
      if (!catMap.has(row.categoryName)) {
        catMap.set(row.categoryName, {
          name: row.categoryName,
          color: row.categoryColor,
          byMonth: new Map(),
        })
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header + Filters */}
      <div className="animate-in space-y-3">
        <h1 className="text-xl font-bold tracking-tight">Monthly Comparison</h1>

        <div className="overflow-x-auto">
          <Tabs value={preset} onValueChange={(v) => v && setPreset(v as Preset)}>
            <TabsList>
              {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="whitespace-nowrap">
                  {label}
                </TabsTrigger>
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
              onValueChange={(v) =>
                navigate({
                  search: {
                    ...search,
                    accountIds: v && v !== "all" ? [v] : undefined,
                  },
                })
              }
            >
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.iban ?? a.id}
                  </SelectItem>
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
          {/* Monthly totals chart */}
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
                      <YAxis
                        tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
                        tick={{ fontSize: 10 }}
                        width={48}
                        tickLine={false}
                        axisLine={false}
                      />
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

          {/* Comparison table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="sticky left-0 z-20 bg-muted/80 backdrop-blur px-4 py-3 min-w-[160px]">
                    Category
                  </TableHead>
                  {months.map((month) => (
                    <TableHead key={month} className="text-right px-4 py-3 whitespace-nowrap min-w-[110px]">
                      {formatYearMonth(month)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right px-4 py-3 text-muted-foreground whitespace-nowrap min-w-[90px]">
                    Avg / mo
                  </TableHead>
                  <TableHead className="text-right px-4 py-3 text-muted-foreground whitespace-nowrap min-w-[80px]">
                    Trend
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => {
                  const values = months.map((m) => cat.byMonth.get(m) ?? 0)
                  const nonZeroValues = values.filter((v) => v > 0)
                  const avg =
                    nonZeroValues.length > 0
                      ? nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length
                      : 0
                  const first = values.find((v) => v > 0) ?? 0
                  const last = [...values].reverse().find((v) => v > 0) ?? 0
                  const trendPct = first > 0 ? ((last - first) / first) * 100 : 0

                  return (
                    <TableRow key={cat.name} className="group">
                      <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 px-4 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate max-w-[130px]">{cat.name}</span>
                        </div>
                      </TableCell>
                      {values.map((val, i) => (
                        <TableCell key={months[i]} className="text-right px-4 py-2.5 tabular-nums">
                          {val > 0 ? (
                            formatCurrency(val)
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right px-4 py-2.5 tabular-nums text-muted-foreground">
                        {avg > 0 ? (
                          formatCurrency(avg)
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-4 py-2.5">
                        <TrendBadge pct={trendPct} hasData={nonZeroValues.length > 1} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t-2 font-semibold">
                  <TableCell className="sticky left-0 z-10 bg-muted/80 backdrop-blur px-4 py-3">
                    Total Spending
                  </TableCell>
                  {monthlyTotals.map(({ month, total }) => (
                    <TableCell key={month} className="text-right px-4 py-3 tabular-nums">
                      {formatCurrency(total)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right px-4 py-3 tabular-nums text-muted-foreground">
                    {formatCurrency(
                      monthlyTotals.reduce((s, m) => s + m.total, 0) /
                        (monthlyTotals.length || 1),
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted/30 px-4 py-3 font-medium text-positive">
                    Income
                  </TableCell>
                  {months.map((month) => {
                    const income = incomeByMonth.get(month) ?? 0
                    return (
                      <TableCell key={month} className="text-right px-4 py-3 tabular-nums text-positive">
                        {income > 0 ? (
                          formatCurrency(income)
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell colSpan={2} />
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted/30 px-4 py-3 font-medium">Net</TableCell>
                  {months.map((month) => {
                    const income = incomeByMonth.get(month) ?? 0
                    const spending = monthlyTotals.find((m) => m.month === month)?.total ?? 0
                    const net = income - spending
                    return (
                      <TableCell
                        key={month}
                        className={`text-right px-4 py-3 tabular-nums font-medium ${
                          net >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatCurrency(net)}
                      </TableCell>
                    )
                  })}
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

function TrendBadge({ pct, hasData }: { pct: number; hasData: boolean }) {
  if (!hasData) {
    return <span className="text-muted-foreground/30 text-xs">—</span>
  }
  const abs = Math.abs(pct)
  if (abs < 1) {
    return (
      <span className="text-muted-foreground text-xs inline-flex items-center gap-0.5 justify-end">
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }
  if (pct > 0) {
    return (
      <span className="text-negative text-xs inline-flex items-center gap-0.5 justify-end">
        <TrendingUp className="h-3 w-3" />+{abs.toFixed(0)}%
      </span>
    )
  }
  return (
    <span className="text-positive text-xs inline-flex items-center gap-0.5 justify-end">
      <TrendingDown className="h-3 w-3" />-{abs.toFixed(0)}%
    </span>
  )
}
