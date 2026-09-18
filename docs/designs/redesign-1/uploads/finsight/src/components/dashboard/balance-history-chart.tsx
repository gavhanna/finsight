import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { formatCurrency } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

export function BalanceHistoryChart({
  data,
  currency = "EUR",
}: {
  data: { date: string; total: number }[]
  currency?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No balance history yet. Sync your account to start tracking.</p>
  }

  const formatLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.65 0.15 250)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.65 0.15 250)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatLabel} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 })}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip labelFormatter={formatLabel} currency={currency} />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="oklch(0.65 0.15 250)"
          strokeWidth={2}
          fill="url(#balanceGradient)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0, fill: "oklch(0.65 0.15 250)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
