import { createFileRoute } from "@tanstack/react-router"
import { getInflationRate } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import { formatCurrency } from "@/lib/utils"
import { Activity, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { PageHelp } from "@/components/ui/page-help"
import { withOfflineCache } from "@/lib/loader-cache"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"

// UK CPI reference — update in Settings or hardcode for now
const CPI_REFERENCE = 2.5

export const Route = createFileRoute("/analytics/inflation")({
  component: InflationPage,
  loader: () =>
    withOfflineCache("analytics:inflation", async () => {
      const [data, currency] = await Promise.all([
        getInflationRate(),
        getSetting({ data: "preferred_currency" }),
      ])
      return { data, currency: currency ?? "EUR" }
    }),
})

function InflationPage() {
  const { data, currency } = Route.useLoaderData()
  const { categories, overallRate, currentYear, priorYear } = data

  const hasData = categories.length > 0

  const vsReference = overallRate - CPI_REFERENCE

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Personal Inflation Rate</h1>
        <PageHelp title="Personal Inflation Rate">
          <p>Your personal inflation rate compares what you're spending in each category this year vs last year — annualised so both periods are comparable.</p>
          <p><strong className="text-foreground">Positive = more expensive</strong> — a bar to the right means that category costs more than last year.</p>
          <p><strong className="text-foreground">CPI reference</strong> — the {CPI_REFERENCE}% line shows approximate headline inflation. Categories above it are outpacing general inflation; below means you're beating it.</p>
          <p><strong className="text-foreground">This year's spend</strong> is annualised based on how many days have elapsed, so it can be compared to the full prior year.</p>
        </PageHelp>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Your Inflation Rate"
          value={`${overallRate >= 0 ? "+" : ""}${overallRate.toFixed(1)}%`}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          sub={`${priorYear} → ${currentYear} (annualised)`}
          accent={overallRate > 5 ? "negative" : overallRate > 0 ? "neutral" : "positive"}
          valueClass={overallRate > 0 ? "text-negative" : "text-positive"}
          className="animate-in stagger-1"
        />
        <StatCard
          label="vs CPI Reference"
          value={`${vsReference >= 0 ? "+" : ""}${vsReference.toFixed(1)}%`}
          icon={
            vsReference > 0
              ? <TrendingUp className="h-4 w-4 text-negative" />
              : <TrendingDown className="h-4 w-4 text-positive" />
          }
          sub={`CPI reference: ${CPI_REFERENCE}%`}
          accent={vsReference > 0 ? "negative" : "positive"}
          valueClass={vsReference > 0 ? "text-negative" : "text-positive"}
          className="animate-in stagger-2"
        />
        <StatCard
          label="Categories Tracked"
          value={categories.length.toString()}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          sub="in both years"
          accent="neutral"
          className="animate-in stagger-3"
        />
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <Activity className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Not enough history</p>
            <p className="text-sm text-muted-foreground">Inflation rate requires transactions from both {priorYear} and {currentYear}.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 animate-in stagger-4">
            <p className="section-label px-0.5">Change by Category ({priorYear} → {currentYear})</p>
            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-10 -mr-4">
                  <ResponsiveContainer width="100%" height={Math.max(280, categories.length * 36)}>
                    <BarChart
                      data={categories}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoryName"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip
                        formatter={(value: unknown) => { const v = value as number; return [`${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, "Change"] }}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <ReferenceLine
                        x={0}
                        stroke="var(--border)"
                        strokeWidth={1}
                      />
                      <ReferenceLine
                        x={CPI_REFERENCE}
                        stroke="var(--color-warning, #f59e0b)"
                        strokeDasharray="5 3"
                        strokeOpacity={0.7}
                        label={{
                          value: `CPI ${CPI_REFERENCE}%`,
                          position: "insideTopRight",
                          fontSize: 10,
                          fill: "var(--color-warning, #f59e0b)",
                        }}
                      />
                      <Bar dataKey="changePercent" radius={[0, 3, 3, 0]}>
                        {categories.map((entry) => (
                          <Cell
                            key={entry.categoryName}
                            fill={entry.changePercent > 0 ? "var(--color-negative)" : "var(--color-positive)"}
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

          <div className="space-y-2 animate-in stagger-5">
            <p className="section-label px-0.5">Category Detail</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pl-5 py-3 font-medium text-muted-foreground">Category</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">{priorYear}</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">{currentYear} (ann.)</th>
                        <th className="py-3 pr-5 text-right font-medium text-muted-foreground">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.categoryName} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="pl-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: cat.categoryColor }}
                              />
                              <span className="font-medium">{cat.categoryName}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(cat.priorTotal, currency)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(cat.currentAnnualised, currency)}
                          </td>
                          <td className="py-3 pr-5 text-right tabular-nums">
                            <span
                              className={`font-medium ${cat.changePercent > 0 ? "text-negative" : "text-positive"}`}
                            >
                              {cat.changePercent >= 0 ? "+" : ""}
                              {cat.changePercent.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
