import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts"
import { formatCurrency, formatYearMonth } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

export function IncomeExpensesChart({ data, currency = "EUR" }: {
  data: { month: string; income: number; moneyIn: number; expenses: number; net: number }[]
  currency?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
  }

  const dataWithRate = data.map((d) => ({
    ...d,
    savingsRate: d.income > 0 ? Math.round((d.net / d.income) * 100) : null,
  }))

  const interval = data.length > 6 ? Math.floor(data.length / 6) : 0
  const formatted = dataWithRate.map((d) => ({ ...d, month: formatYearMonth(d.month) }))
  const hasRateData = data.filter((d) => d.income > 0).length >= 2

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={interval} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        {hasRateData && (
          <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        )}
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
        <ReferenceLine yAxisId="left" y={0} stroke="oklch(0.5 0 0 / 0.15)" strokeWidth={1.5} />
        <Line yAxisId="left" type="monotone" dataKey="income" name="Income" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="moneyIn" name="Money In" stroke="var(--color-chart-4)" strokeWidth={1.8} strokeDasharray="5 3" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="net" name="Net" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        {hasRateData && (
          <Line yAxisId="rate" type="monotone" dataKey="savingsRate" name="Savings Rate" stroke="var(--color-chart-3)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
