import { useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Metric = "expenses" | "income" | "net"

type MonthRow = { month: string; income: number; expenses: number; net: number }

function shortMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split("-")
  return new Date(Number(year), Number(month) - 1).toLocaleString("en-IE", { month: "short" })
}

function YoYTooltip({
  active, payload, label, metric, currency,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  metric: Metric
  currency: string
}) {
  if (!active || !payload?.length) return null

  const current = payload.find((p) => p.name === "This Period")
  const lastYear = payload.find((p) => p.name === "Last Year")
  const currentVal = current?.value ?? 0
  const lastYearVal = lastYear?.value ?? null

  const delta = lastYearVal != null && lastYearVal !== 0
    ? ((currentVal - lastYearVal) / lastYearVal) * 100
    : null

  const metricLabel = metric === "expenses" ? "Spend" : metric === "income" ? "Income" : "Net"
  const isPositiveDelta = metric === "income" || metric === "net"
    ? (delta ?? 0) >= 0
    : (delta ?? 0) <= 0

  return (
    <div className="rounded-xl border bg-card/95 backdrop-blur-sm shadow-xl px-3.5 py-2.5 text-sm min-w-44">
      <p className="font-semibold text-foreground text-xs mb-2 pb-1.5 border-b">{label}</p>
      <div className="space-y-1.5">
        {current && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
              <span className="text-muted-foreground text-xs">This Period</span>
            </div>
            <span className="font-semibold tabular-nums text-xs">{formatCurrency(currentVal, currency)}</span>
          </div>
        )}
        {lastYear && lastYearVal != null && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: lastYear.color }} />
              <span className="text-muted-foreground text-xs">Last Year</span>
            </div>
            <span className="font-semibold tabular-nums text-xs">{formatCurrency(lastYearVal, currency)}</span>
          </div>
        )}
        {delta != null && (
          <div className="pt-1 mt-1 border-t flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-xs">YoY {metricLabel}</span>
            <span className={`font-semibold tabular-nums text-xs ${isPositiveDelta ? "text-positive" : "text-negative"}`}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function YearOverYearChart({
  current,
  lastYear,
  currency = "EUR",
}: {
  current: MonthRow[]
  lastYear: MonthRow[]
  currency?: string
}) {
  const [metric, setMetric] = useState<Metric>("expenses")

  if (current.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data for this period.</p>
  }

  const data = current.map((c, i) => ({
    label: shortMonth(c.month),
    "This Period": c[metric],
    "Last Year": lastYear[i]?.[metric] ?? null,
  }))

  const hasLastYear = lastYear.length > 0
  const noComparisonData = !hasLastYear

  const currentColor = metric === "expenses"
    ? "var(--color-chart-5)"
    : metric === "income"
      ? "var(--color-chart-2)"
      : "var(--color-chart-1)"

  const lastYearColor = "var(--color-chart-3)"

  const tickFormatter = (v: number) =>
    formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {noComparisonData ? (
          <p className="text-xs text-muted-foreground italic">No data for the same period last year to compare against.</p>
        ) : (
          <span />
        )}
        <Tabs value={metric} onValueChange={(v) => v && setMetric(v as Metric)}>
          <TabsList className="h-7">
            <TabsTrigger value="expenses" className="text-xs px-2.5">Spend</TabsTrigger>
            <TabsTrigger value="income" className="text-xs px-2.5">Income</TabsTrigger>
            <TabsTrigger value="net" className="text-xs px-2.5">Net</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ left: -10, right: 8 }}>
          <defs>
            <linearGradient id="yoy-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={currentColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={currentColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="yoy-last" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lastYearColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={lastYearColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<YoYTooltip metric={metric} currency={currency} />} />
          {hasLastYear && (
            <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
          )}
          {hasLastYear && (
            <Area
              type="monotone"
              dataKey="Last Year"
              stroke={lastYearColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#yoy-last)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="This Period"
            stroke={currentColor}
            strokeWidth={2}
            fill="url(#yoy-current)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
