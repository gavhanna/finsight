import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { formatCurrency, formatYearMonth } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

export function SpendingTrendsChart({
  data,
  categories,
  currency = "EUR",
}: {
  data: Record<string, any>[]
  categories: { name: string; color: string }[]
  currency?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No trend data.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip labelFormatter={formatYearMonth} currency={currency} />} />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
        {categories.map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
