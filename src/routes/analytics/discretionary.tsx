import { createFileRoute } from "@tanstack/react-router"
import { getDiscretionarySpending } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import {
  startOfWeek,
  startOfLastWeek,
  endOfLastWeek,
  startOfLastMonth,
  endOfLastMonth,
  todayStr,
  daysAgo,
  formatCurrency,
  formatDate,
} from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { PageHelp } from "@/components/ui/page-help"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Button } from "@/components/ui/button"
import { z } from "zod"
import { addDays, format, parseISO } from "date-fns"

type Preset = "this-week" | "last-week" | "last-2-weeks" | "last-month"

const PRESET_LABELS: Record<Preset, string> = {
  "this-week": "This Week",
  "last-week": "Last Week",
  "last-2-weeks": "Last 2 Wks",
  "last-month": "Last Month",
}

function getPresetDates(preset: Preset): { dateFrom: string; dateTo: string } {
  const today = todayStr()
  switch (preset) {
    case "this-week":
      return { dateFrom: startOfWeek(), dateTo: today }
    case "last-week":
      return { dateFrom: startOfLastWeek(), dateTo: endOfLastWeek() }
    case "last-2-weeks":
      return { dateFrom: daysAgo(14), dateTo: today }
    case "last-month":
      return { dateFrom: startOfLastMonth(), dateTo: endOfLastMonth() }
  }
}

const SearchSchema = z.object({
  preset: z.enum(["this-week", "last-week", "last-2-weeks", "last-month"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  recurringFilter: z.enum(["active", "all"]).default("active"),
})

export const Route = createFileRoute("/analytics/discretionary")({
  validateSearch: SearchSchema,
  component: DiscretionaryPage,
  loaderDeps: ({ search }) => {
    const hasCustomDates = search.dateFrom || search.dateTo
    const { dateFrom, dateTo } = hasCustomDates
      ? { dateFrom: search.dateFrom, dateTo: search.dateTo }
      : getPresetDates((search.preset ?? "this-week") as Preset)
    return {
      dateFrom,
      dateTo,
      recurringFilter: search.recurringFilter,
      preset: hasCustomDates ? undefined : (search.preset ?? "this-week"),
    }
  },
  loader: async ({ deps }) => {
    const [data, currency] = await Promise.all([
      getDiscretionarySpending({
        data: {
          dateFrom: deps.dateFrom,
          dateTo: deps.dateTo,
          activeOnly: deps.recurringFilter !== "all",
        },
      }),
      getSetting({ data: "preferred_currency" }),
    ])
    return { data, currency: currency ?? "EUR", deps }
  },
})

function DiscretionaryPage() {
  const { data, currency, deps } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const activePreset = deps.preset as Preset | undefined

  function setPreset(p: Preset) {
    navigate({
      search: (prev) => ({ ...prev, preset: p, dateFrom: undefined, dateTo: undefined }),
    })
  }

  function setDateFrom(v: string | undefined) {
    navigate({
      search: (prev) => ({ ...prev, dateFrom: v, preset: undefined }),
    })
  }

  function setDateTo(v: string | undefined) {
    navigate({
      search: (prev) => ({ ...prev, dateTo: v, preset: undefined }),
    })
  }

  function setRecurringFilter(v: "active" | "all") {
    navigate({ search: (prev) => ({ ...prev, recurringFilter: v }) })
  }

  const hasData = data.byCategory.length > 0

  function shiftWeek(direction: -1 | 1) {
    const from = deps.dateFrom ? parseISO(deps.dateFrom) : new Date()
    const to = deps.dateTo ? parseISO(deps.dateTo) : new Date()
    navigate({
      search: (prev) => ({
        ...prev,
        dateFrom: format(addDays(from, direction * 7), "yyyy-MM-dd"),
        dateTo: format(addDays(to, direction * 7), "yyyy-MM-dd"),
        preset: undefined,
      }),
    })
  }

  function getPeriodLabel() {
    if (!deps.dateFrom || !deps.dateTo) return activePreset ? PRESET_LABELS[activePreset] : "Custom range"
    const from = parseISO(deps.dateFrom)
    const to = parseISO(deps.dateTo)
    const sameYear = from.getFullYear() === to.getFullYear()
    return `${format(from, "d MMM")} – ${format(to, sameYear ? "d MMM" : "d MMM yyyy")}`
  }

  const canGoForward = !deps.dateTo || deps.dateTo < todayStr()

  // Format X-axis label for daily chart based on period length
  const dayCount = data.daily.length
  function formatDayLabel(dateStr: string) {
    const d = parseISO(dateStr)
    return dayCount <= 7 ? format(d, "EEE") : format(d, "d MMM")
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Discretionary Spend</h1>
        <PageHelp title="Discretionary Spend">
          <p>See what you're actually spending on day-to-day purchases, with recurring payments filtered out.</p>
          <p><strong className="text-foreground">Active recurring</strong> — excludes only payees that are currently active (charged within the expected interval).</p>
          <p><strong className="text-foreground">All recurring</strong> — excludes any payee that has ever been detected as recurring, even if inactive.</p>
          <p>Use the date range to scope to a specific period, or pick a preset.</p>
        </PageHelp>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={activePreset ?? ""}
          onValueChange={(v) => v && setPreset(v as Preset)}
        >
          <TabsList className="h-8">
            {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs px-2.5 h-6">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Week navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftWeek(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs font-medium px-2 min-w-[130px] text-center tabular-nums">
            {getPeriodLabel()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canGoForward}
            onClick={() => shiftWeek(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DatePicker
            value={search.dateFrom}
            onChange={setDateFrom}
            placeholder="From"
            className="w-[130px] h-8 text-xs"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <DatePicker
            value={search.dateTo}
            onChange={setDateTo}
            placeholder="To"
            className="w-[130px] h-8 text-xs"
          />
        </div>

        {/* Recurring filter toggle */}
        <div className="flex items-center rounded-md border bg-muted/40 p-0.5 gap-0.5">
          <button
            onClick={() => setRecurringFilter("active")}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              search.recurringFilter !== "all"
                ? "bg-background shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active recurring
          </button>
          <button
            onClick={() => setRecurringFilter("all")}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              search.recurringFilter === "all"
                ? "bg-background shadow-sm font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All recurring
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="section-label mb-1">Total Spent</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(data.total, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="section-label mb-1">Avg / Day</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(data.avgPerDay, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="section-label mb-1">Transactions</p>
            <p className="text-2xl font-bold tabular-nums">{data.transactionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="section-label mb-1">Recurring Excluded</p>
            <p className="text-2xl font-bold tabular-nums">{data.excludedPayeeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {search.recurringFilter === "all" ? "all detected" : "active payees"}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <ShoppingBag className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No discretionary spending in this period</p>
            <p className="text-sm text-muted-foreground">Try a wider date range, or switch to "All recurring" to see more.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Daily bar chart */}
          {data.daily.length > 1 && (
            <div className="space-y-2 animate-in stagger-1">
              <p className="section-label px-0.5">Daily Breakdown</p>
              <Card>
                <CardContent className="pt-5">
                  <div className="chart-bg p-3 -mx-1">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.daily} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDayLabel}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval={dayCount > 20 ? 2 : 0}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            formatCurrency(v, currency, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          }
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={60}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatCurrency(value, currency),
                            "Spent",
                          ]}
                          labelFormatter={(label) => formatDate(label)}
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={32}>
                          {data.daily.map((entry) => (
                            <Cell
                              key={entry.date}
                              fill="var(--chart-1)"
                              fillOpacity={0.8}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Category breakdown + Top merchants side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <div className="space-y-2 animate-in stagger-2">
              <p className="section-label px-0.5">By Category</p>
              <Card>
                <CardContent className="pt-4 pb-4 space-y-3">
                  {data.byCategory.map((cat) => {
                    const pct = data.total > 0 ? (cat.total / data.total) * 100 : 0
                    return (
                      <div key={cat.categoryId ?? "uncat"} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="size-2.5 rounded-full flex-shrink-0"
                              style={{ background: cat.categoryColor }}
                            />
                            <span className="font-medium truncate">{cat.categoryName}</span>
                            <span className="text-muted-foreground text-xs flex-shrink-0">
                              {cat.count} tx
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums ml-3 flex-shrink-0">
                            {formatCurrency(cat.total, currency)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: cat.categoryColor,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Top merchants */}
            <div className="space-y-2 animate-in stagger-3">
              <p className="section-label px-0.5">Top Merchants</p>
              <Card>
                <CardContent className="pt-2 pb-2">
                  {data.topMerchants.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No merchants to show</p>
                  ) : (
                    data.topMerchants.map((merchant, i) => (
                      <div
                        key={merchant.name}
                        className="flex items-center justify-between py-2.5 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium truncate">{merchant.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(merchant.total, currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">{merchant.count} tx</div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
