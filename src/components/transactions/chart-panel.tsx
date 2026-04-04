import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts"
import type { getTransactionStats } from "@/server/fn/transactions"

type ChartStats = Awaited<ReturnType<typeof getTransactionStats>>

export function TransactionChartPanel({
  chartStats,
  loading,
}: {
  chartStats: ChartStats | null
  loading: boolean
}) {
  return (
    <div className="border-b px-4 py-4 space-y-4 bg-muted/20">
      {loading || !chartStats ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="size-3 text-negative" />
                Total out
              </div>
              <p className="font-semibold tabular-nums text-sm">{formatCurrency(Math.abs(chartStats.totalOut))}</p>
            </div>
            <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="size-3 text-positive" />
                Total in
              </div>
              <p className="font-semibold tabular-nums text-sm text-positive">{formatCurrency(chartStats.totalIn)}</p>
            </div>
            <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Minus className="size-3" />
                Net · {chartStats.count} txns
              </div>
              <p className={cn("font-semibold tabular-nums text-sm", chartStats.totalAmount >= 0 ? "text-positive" : "")}>
                {formatCurrency(chartStats.totalAmount)}
              </p>
            </div>
          </div>

          {chartStats.byMonth.length > 1 && (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartStats.byMonth.map(d => ({ ...d, display: -d.amount }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `€${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`} />
                <ReferenceLine y={0} stroke="oklch(0.5 0 0 / 0.2)" />
                <Tooltip
                  formatter={(v: unknown) => [formatCurrency(-(v as number)), "Amount"]}
                  labelFormatter={(label: unknown) => formatYearMonth(label as string)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.5 0 0 / 0.15)" }}
                />
                <Line type="monotone" dataKey="display" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--color-primary)" }} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  )
}
