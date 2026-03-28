import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { formatYearMonth } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

export function SpendingTrendsChart({
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
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip labelFormatter={formatYearMonth} />} />
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
