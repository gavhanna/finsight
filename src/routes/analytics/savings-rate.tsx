import { createFileRoute } from "@tanstack/react-router"
import { getSavingsRateHistory } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import { formatCurrency, formatYearMonth } from "@/lib/utils"
import { PiggyBank, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/dashboard/stat-card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { PageHelp } from "@/components/ui/page-help"

export const Route = createFileRoute("/analytics/savings-rate")({
  component: SavingsRatePage,
  loader: async () => {
    const [history, currency] = await Promise.all([
      getSavingsRateHistory(),
      getSetting({ data: "preferred_currency" }),
    ])
    return { history, currency: currency ?? "EUR" }
  },
})

function SavingsRatePage() {
  const { history, currency } = Route.useLoaderData()

  const latest = history[history.length - 1]
  const prev = history[history.length - 2]
  const avg12 =
    history.length > 0
      ? history.slice(-12).reduce((s, r) => s + r.savingsRate, 0) /
      Math.min(history.length, 12)
      : 0

  const trend =
    latest && prev ? latest.savingsRate - prev.savingsRate : null

  const hasData = history.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Savings Rate</h1>
        <PageHelp title="Savings Rate">
          <p>Your savings rate is the percentage of income you keep each month after expenses.</p>
          <p><strong className="text-foreground">Formula</strong> — (Income − Expenses) ÷ Income × 100</p>
          <p><strong className="text-foreground">Target line</strong> — The 20% reference line is a commonly cited savings benchmark. Above it is healthy; below is an opportunity to improve.</p>
          <p><strong className="text-foreground">Rolling average</strong> — The dashed line smooths out one-off months to show the underlying trend.</p>
        </PageHelp>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="This Month"
          value={latest ? `${latest.savingsRate.toFixed(1)}%` : "—"}
          icon={<PiggyBank className="h-4 w-4 text-positive" />}
          sub="savings rate"
          accent={latest && latest.savingsRate >= 20 ? "positive" : latest && latest.savingsRate >= 0 ? "neutral" : "negative"}
          delta={trend ?? undefined}
          className="animate-in stagger-1"
        />
        <StatCard
          label="12-Month Avg"
          value={`${avg12.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          sub="rolling average"
          accent="neutral"
          className="animate-in stagger-2"
        />
        <StatCard
          label="This Month Net"
          value={latest ? formatCurrency(latest.net, currency) : "—"}
          icon={
            latest && latest.net >= 0
              ? <TrendingUp className="h-4 w-4 text-positive" />
              : <TrendingDown className="h-4 w-4 text-negative" />
          }
          sub={latest && latest.net >= 0 ? "surplus" : "deficit"}
          accent={latest && latest.net >= 0 ? "positive" : "negative"}
          valueClass={latest && latest.net >= 0 ? "text-positive" : "text-negative"}
          className="animate-in stagger-3"
        />
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <PiggyBank className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No data yet</p>
            <p className="text-sm text-muted-foreground">Sync transactions to start tracking your savings rate.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 animate-in stagger-4">
          <p className="section-label px-0.5">Monthly Savings Rate</p>
          <Card>
            <CardContent className="pt-5">
              <div className="chart-bg p-3 -ml-8 -mr-4">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatYearMonth}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => [
                        `${(value as number).toFixed(1)}%`,
                        name === "savingsRate" ? "Savings Rate" : "3-Month Avg",
                      ]}
                      labelFormatter={(label: unknown) => formatYearMonth(label as string)}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "savingsRate" ? "Savings Rate" : "3-Month Avg"
                      }
                    />
                    <ReferenceLine
                      y={20}
                      stroke="var(--color-positive)"
                      strokeDasharray="6 3"
                      strokeOpacity={0.6}
                      label={{ value: "20% target", position: "insideTopRight", fontSize: 10, fill: "var(--color-positive)" }}
                    />
                    <ReferenceLine y={0} stroke="var(--color-negative)" strokeOpacity={0.4} />
                    <Line
                      type="monotone"
                      dataKey="savingsRate"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rollingAvg"
                      stroke="var(--chart-2)"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasData && (
        <div className="space-y-2 animate-in stagger-5">
          <p className="section-label px-0.5">Month by Month</p>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pl-5 py-3 font-medium text-muted-foreground">Month</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Income</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Expenses</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Net</th>
                      <th className="py-3 pr-5 text-right font-medium text-muted-foreground">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().slice(0, 24).map((row) => (
                      <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="pl-5 py-3 tabular-nums text-muted-foreground">{formatYearMonth(row.month)}</td>
                        <td className="py-3 text-right tabular-nums text-positive">{formatCurrency(row.income, currency)}</td>
                        <td className="py-3 text-right tabular-nums text-negative">{formatCurrency(row.expenses, currency)}</td>
                        <td className={`py-3 text-right tabular-nums font-medium ${row.net >= 0 ? "text-positive" : "text-negative"}`}>
                          {formatCurrency(row.net, currency)}
                        </td>
                        <td className="py-3 pr-5 text-right tabular-nums">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${row.savingsRate >= 20 ? "text-positive" : row.savingsRate >= 0 ? "text-foreground" : "text-negative"}`}>
                            {row.savingsRate >= 20 ? <TrendingUp className="size-3" /> : row.savingsRate < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
                            {row.savingsRate.toFixed(1)}%
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
      )}
    </div>
  )
}
