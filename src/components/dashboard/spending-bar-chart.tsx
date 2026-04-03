import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChartTooltip, CHART_COLORS } from "@/components/chart-tooltip"
import { formatCurrency } from "@/lib/utils"

export function SpendingBarChart({ data, currency = "EUR" }: {
  data: { categoryName: string; categoryColor: string; total: number }[]
  currency?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: -45, right: 16 }}>
        <XAxis type="number" tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 10 }} width={80} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Bar dataKey="total" radius={[0, 5, 5, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.categoryColor ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
