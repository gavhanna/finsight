import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { formatCurrency } from "@/lib/utils"
import { ChartTooltip } from "@/components/chart-tooltip"

export function SpendingPieChart({ data }: {
  data: { categoryName: string; categoryColor: string; total: number; count: number }[]
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
      <ResponsiveContainer width="100%" height={200} className="sm:w-[50%] sm:flex-shrink-0">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            outerRadius={82}
            innerRadius={44}
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.categoryColor} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1 overflow-auto max-h-48">
        {data.map((d) => (
          <div key={d.categoryName} className="flex items-center gap-2 text-sm py-0.5 group">
            <div className="h-2 w-2 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: d.categoryColor }} />
            <span className="flex-1 truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">{d.categoryName}</span>
            <span className="font-semibold tabular-nums text-xs">{formatCurrency(d.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
