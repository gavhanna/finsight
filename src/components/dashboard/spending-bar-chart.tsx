import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChartTooltip, CHART_COLORS } from "@/components/chart-tooltip"

export function SpendingBarChart({ data }: {
  data: { categoryName: string; categoryColor: string; total: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: -45, right: 16 }}>
        <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={20}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.categoryColor ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
