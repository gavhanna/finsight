import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getSpendingForecast, getNetWorthProjection } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import { formatCurrency } from "@/lib/utils"
import { Telescope, TrendingDown, TrendingUp, Repeat, Wallet, CalendarClock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import { PageHelp } from "@/components/ui/page-help"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NetWorthProjectionChart } from "@/components/analytics/net-worth-projection-chart"
import { buildProjection } from "@/lib/net-worth-projection"
import { withOfflineCache } from "@/lib/loader-cache"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

export const Route = createFileRoute("/analytics/forecast")({
  component: ForecastPage,
  loader: () =>
    withOfflineCache("analytics:forecast", async () => {
      const currency = (await getSetting({ data: "preferred_currency" })) ?? "EUR"
      const [forecast, projection] = await Promise.all([
        getSpendingForecast(),
        getNetWorthProjection({ data: { currency } }),
      ])
      return { forecast, projection, currency }
    }),
})

const HORIZONS = [
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
] as const

const CONFIDENCE_LABEL = {
  low: "Low confidence — short history",
  moderate: "Moderate confidence",
  high: "High confidence",
} as const

function ForecastPage() {
  const { forecast, projection, currency } = Route.useLoaderData()
  const { fixedTotal, variableTotal, grandTotal, variableCategories, topRecurring, totalVariance, nextMonthLabel } = forecast

  const [horizonMonths, setHorizonMonths] = useState(12)
  const horizonLabel = HORIZONS.find((h) => h.months === horizonMonths)?.label ?? `${horizonMonths}M`
  const projected = projection?.fit ? buildProjection(projection.fit, horizonMonths) : null

  const chartData = [
    {
      name: nextMonthLabel,
      Fixed: fixedTotal,
      Variable: variableTotal,
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Spending Forecast</h1>
        <PageHelp title="Spending Forecast">
          <p>Estimates your total spend for next month by combining two components.</p>
          <p><strong className="text-foreground">Fixed</strong> — your active recurring payments (subscriptions, bills, rent). These are known amounts.</p>
          <p><strong className="text-foreground">Variable</strong> — a 3-month rolling average of your non-recurring category spend. This smooths out one-off months.</p>
          <p><strong className="text-foreground">Confidence</strong> — based on how much your variable spending has varied month-to-month. Low variance = higher confidence.</p>
        </PageHelp>
      </div>

      {/* Net Worth Projection */}
      <div className="space-y-3 animate-in stagger-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="section-label px-0.5">Net Worth Projection</p>
            <PageHelp title="Net Worth Projection">
              <p>Fits a trend line to your recent net worth (sum of tracked account balances) and extends it forward.</p>
              <p><strong className="text-foreground">The dashed line</strong> continues from today at your current rate of change. The shaded band is a likely range (~80%) that widens the further out we project.</p>
              <p><strong className="text-foreground">Assumes nothing changes</strong> — it's a mechanical extrapolation of past balances, not advice. Large one-off events and short history reduce accuracy.</p>
            </PageHelp>
          </div>
          {projected && (
            <Tabs value={String(horizonMonths)} onValueChange={(v) => v && setHorizonMonths(Number(v))}>
              <TabsList className="h-7">
                {HORIZONS.map((h) => (
                  <TabsTrigger key={h.months} value={String(h.months)} className="text-xs px-2.5">
                    {h.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        {projected && projection?.fit ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard
                label="Current Net Worth"
                value={formatCurrency(projection.fit.lastValue, currency)}
                icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                sub="tracked balances"
                accent="neutral"
              />
              <StatCard
                label="Monthly Change"
                value={`${projected.milestones.monthlyChange >= 0 ? "+" : ""}${formatCurrency(projected.milestones.monthlyChange, currency)}`}
                icon={projected.milestones.trendingUp
                  ? <TrendingUp className="h-4 w-4 text-positive" />
                  : <TrendingDown className="h-4 w-4 text-negative" />}
                sub="at current rate"
                accent={projected.milestones.trendingUp ? "positive" : "negative"}
              />
              <StatCard
                label={`Projected in ${horizonLabel}`}
                value={formatCurrency(projected.milestones.projectedValue, currency)}
                icon={<Telescope className="h-4 w-4 text-muted-foreground" />}
                sub="if trend holds"
                accent={projected.milestones.projectedValue >= projection.fit.lastValue ? "positive" : "negative"}
              />
              <StatCard
                label="Runway to €0"
                value={projected.milestones.zeroDate
                  ? new Date(projected.milestones.zeroDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                  : "—"}
                icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
                sub={projected.milestones.zeroDate ? "at current rate" : "trending up — no crossing"}
                accent={projected.milestones.zeroDate ? "negative" : "positive"}
              />
            </div>

            <Card>
              <CardContent className="pt-5">
                <div className="chart-bg p-3 -mx-2">
                  <NetWorthProjectionChart
                    history={projection.history}
                    fit={projection.fit}
                    horizonMonths={horizonMonths}
                    currency={currency}
                    zeroDate={projected.milestones.zeroDate}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3 px-1">
                  {CONFIDENCE_LABEL[projected.milestones.confidence]} · fitted over {projection.fit.windowDays} days of history
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-muted-foreground text-center">
                Not enough balance history yet to project. Sync your accounts over a few weeks to build a trend.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Forecast Total"
          value={formatCurrency(grandTotal, currency)}
          icon={<Telescope className="h-4 w-4 text-muted-foreground" />}
          sub={nextMonthLabel}
          accent="neutral"
          className="animate-in stagger-1"
        />
        <StatCard
          label="Fixed (Recurring)"
          value={formatCurrency(fixedTotal, currency)}
          icon={<Repeat className="h-4 w-4 text-negative" />}
          sub="known commitments"
          accent="negative"
          className="animate-in stagger-2"
        />
        <StatCard
          label="Variable"
          value={formatCurrency(variableTotal, currency)}
          icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
          sub="3-month rolling avg"
          accent="neutral"
          className="animate-in stagger-3"
        />
        <StatCard
          label="Variance (±)"
          value={formatCurrency(totalVariance, currency)}
          icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
          sub="monthly variation"
          accent="neutral"
          className="animate-in stagger-4"
        />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 animate-in stagger-5">
        {/* Stacked bar chart */}
        <div className="space-y-2">
          <p className="section-label px-0.5">Forecast Breakdown</p>
          <Card>
            <CardContent className="pt-5">
              <div className="chart-bg p-3 -mx-10 ">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                    />
                    <Tooltip
                      formatter={((value: number | undefined, name: string) => {
                        if (value == null) return []
                        return [formatCurrency(value, currency), name]
                      }) as any}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Fixed" stackId="a" fill="var(--chart-5)" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Variable" stackId="a" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fixed commitments */}
        <div className="space-y-2">
          <p className="section-label px-0.5">Fixed Commitments (Top Recurring)</p>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-[280px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr>
                      <th className="pl-5 py-3 text-left font-medium text-muted-foreground">Payee</th>
                      <th className="pr-5 py-3 text-right font-medium text-muted-foreground">Monthly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRecurring.map((r) => (
                      <tr key={r.payee} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="pl-5 py-2.5 font-medium truncate max-w-[180px]">{r.payee}</td>
                        <td className="pr-5 py-2.5 text-right tabular-nums text-negative">
                          {formatCurrency(r.monthlyEquiv, currency)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-medium">
                      <td className="pl-5 py-2.5">Total Fixed</td>
                      <td className="pr-5 py-2.5 text-right tabular-nums text-negative">
                        {formatCurrency(fixedTotal, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Variable category breakdown */}
      <div className="space-y-2 animate-in stagger-6">
        <p className="section-label px-0.5">Variable Category Forecast</p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pl-5 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="py-3 text-right font-medium text-muted-foreground">3-Mo Avg</th>
                    <th className="py-3 pr-5 text-right font-medium text-muted-foreground">Variance ±</th>
                  </tr>
                </thead>
                <tbody>
                  {variableCategories.map((cat) => (
                    <tr key={String(cat.categoryId)} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="pl-5 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.categoryColor }}
                          />
                          <span className="font-medium">{cat.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatCurrency(cat.forecastAmount, currency)}
                      </td>
                      <td className="py-3 pr-5 text-right tabular-nums text-muted-foreground">
                        ±{formatCurrency(cat.variance, currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-medium border-t">
                    <td className="pl-5 py-3">Total Variable</td>
                    <td className="py-3 text-right tabular-nums">{formatCurrency(variableTotal, currency)}</td>
                    <td className="py-3 pr-5 text-right tabular-nums text-muted-foreground">
                      ±{formatCurrency(totalVariance, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
