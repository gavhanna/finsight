import { createFileRoute } from "@tanstack/react-router"
import { getSpendingPatterns } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import { getPresetDates, type PresetKey } from "@/lib/presets"
import { formatCurrency } from "@/lib/utils"
import { BarChart2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHelp } from "@/components/ui/page-help"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts"
import { z } from "zod"

const SearchSchema = z.object({
  preset: z.enum(["month", "3months", "6months", "ytd", "12months", "all"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.number().optional(),
})

export const Route = createFileRoute("/analytics/patterns")({
  validateSearch: SearchSchema,
  component: PatternsPage,
  loaderDeps: ({ search }) => {
    const dates =
      !search.dateFrom && !search.dateTo
        ? getPresetDates((search.preset ?? "6months") as PresetKey)
        : { dateFrom: search.dateFrom, dateTo: search.dateTo }
    return { ...search, dateFrom: dates.dateFrom, dateTo: dates.dateTo }
  },
  loader: async ({ deps }) => {
    const [patterns, currency] = await Promise.all([
      getSpendingPatterns({
        data: {
          dateFrom: deps.dateFrom,
          dateTo: deps.dateTo,
          categoryId: deps.categoryId,
        },
      }),
      getSetting({ data: "preferred_currency" }),
    ])
    return { patterns, currency: currency ?? "EUR", categoryId: deps.categoryId }
  },
})

type Preset = "month" | "3months" | "6months" | "ytd" | "12months" | "all"

const PRESET_LABELS: Record<Preset, string> = {
  month: "Month",
  "3months": "3M",
  "6months": "6M",
  ytd: "YTD",
  "12months": "12M",
  all: "All",
}

function PatternsPage() {
  const { patterns, currency, categoryId } = Route.useLoaderData()
  const { dowData, domData, categories } = patterns
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const activePreset = !search.dateFrom && !search.dateTo ? (search.preset ?? "6months") : null

  function setPreset(p: Preset) {
    navigate({ search: (prev) => ({ ...prev, preset: p, dateFrom: undefined, dateTo: undefined }) })
  }

  function setCategory(value: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        categoryId: value === "all" ? undefined : Number(value),
      }),
    })
  }

  // Find the busiest DOW and DOM for highlighting
  const maxDow = Math.max(...dowData.map((d) => d.total), 1)
  const maxDom = Math.max(...domData.map((d) => d.total), 1)
  const busiestDow = dowData.reduce((a, b) => (b.total > a.total ? b : a), dowData[0])
  const medianDomTotal =
    [...domData].filter((d) => d.total > 0).sort((a, b) => a.total - b.total)[
      Math.floor(domData.filter((d) => d.total > 0).length / 2)
    ]?.total ?? 0

  const hasData = dowData.some((d) => d.total > 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Spending Patterns</h1>
        <PageHelp title="Spending Patterns">
          <p>When do you spend? Two views reveal your habits across different time dimensions.</p>
          <p><strong className="text-foreground">Day of week</strong> — which days you spend most. Useful for spotting habitual patterns (e.g. weekend splurges).</p>
          <p><strong className="text-foreground">Day of month</strong> — when in the month your spending clusters. Payday effects, rent day, and end-of-month bills often show up clearly here.</p>
          <p>Filter by category to drill into specific spending types.</p>
        </PageHelp>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={activePreset ?? ""} onValueChange={(v) => setPreset(v as Preset)}>
          <TabsList className="h-8">
            {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs px-2.5 h-6">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select
          value={categoryId != null ? String(categoryId) : "all"}
          onValueChange={setCategory}
        >
          <SelectTrigger className="w-auto min-w-[160px] h-8 text-xs">
            <SelectValue>
              {categoryId != null
                ? (categories.find((c) => c.id === categoryId)?.name ?? "All categories")
                : "All categories"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <BarChart2 className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No data for this period</p>
            <p className="text-sm text-muted-foreground">Try a wider date range or different category.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Day of week */}
          <div className="space-y-2 animate-in stagger-1">
            <div className="flex items-baseline gap-2 px-0.5">
              <p className="section-label">Spend by Day of Week</p>
              {busiestDow && (
                <span className="text-xs text-muted-foreground">
                  busiest: <span className="text-foreground font-medium">{busiestDow.day}</span>
                </span>
              )}
            </div>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dowData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          formatCurrency(v, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        }
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value, currency), "Total spend"]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {dowData.map((entry) => (
                          <Cell
                            key={entry.day}
                            fill={entry.total === maxDow ? "var(--chart-1)" : "var(--chart-1)"}
                            fillOpacity={entry.total === maxDow ? 1 : 0.55}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day of month */}
          <div className="space-y-2 animate-in stagger-2">
            <p className="section-label px-0.5">Spend by Day of Month</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-1">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={domData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={1}
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          formatCurrency(v, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        }
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value, currency), "Total spend"]}
                        labelFormatter={(label) => `Day ${label}`}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      {medianDomTotal > 0 && (
                        <ReferenceLine
                          y={medianDomTotal}
                          stroke="var(--chart-2)"
                          strokeDasharray="4 3"
                          strokeOpacity={0.6}
                          label={{
                            value: "median",
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: "var(--chart-2)",
                          }}
                        />
                      )}
                      <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={24}>
                        {domData.map((entry) => (
                          <Cell
                            key={entry.day}
                            fill="var(--chart-2)"
                            fillOpacity={entry.total === maxDom ? 1 : 0.55}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
