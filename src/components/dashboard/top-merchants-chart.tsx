import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { ChartTooltip, CHART_COLORS } from "@/components/chart-tooltip"
import { formatCurrency } from "@/lib/utils"

export function TopMerchantsChart({ data, currency = "EUR" }: {
  data: { name: string; total: number; count: number }[]
  currency?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No merchant data.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: -45, right: 16 }}>
        <XAxis type="number" tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
