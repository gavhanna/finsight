import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Label,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ChartType = "area" | "bar"

type ChartItem = {
  id: number | null
  name: string
  color: string
}

export function TrendsChart({
  chartData,
  visibleItems,
  allItems,
  selected,
  months,
  avgByKey,
  chartType,
  viewMode,
  isSingle,
  hasGroups,
  onToggleItem,
  onIsolateItem,
  onSelectAll,
  onChartTypeChange,
  onViewModeChange,
}: {
  chartData: Record<string, any>[]
  visibleItems: ChartItem[]
  allItems: ChartItem[]
  selected: Set<string>
  months: string[]
  avgByKey: Map<string, number>
  chartType: ChartType
  viewMode: "categories" | "groups"
  isSingle: boolean
  hasGroups: boolean
  onToggleItem: (key: string) => void
  onIsolateItem: (key: string) => void
  onSelectAll: () => void
  onChartTypeChange: (t: ChartType) => void
  onViewModeChange: (v: "categories" | "groups") => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isSingle ? visibleItems[0].name : viewMode === "groups" ? "Spending by Group" : "Spending by Category"}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            {hasGroups && (
              <Tabs value={viewMode} onValueChange={v => onViewModeChange(v as "categories" | "groups")}>
                <TabsList>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                  <TabsTrigger value="groups">Groups</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Tabs value={chartType} onValueChange={v => onChartTypeChange(v as ChartType)}>
              <TabsList>
                <TabsTrigger value="area">Area</TabsTrigger>
                <TabsTrigger value="bar">Bar</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {allItems.map(item => {
            const key = String(item.id)
            const active = selected.has(key)
            return (
              <button
                key={key}
                onClick={() => onToggleItem(key)}
                onDoubleClick={() => onIsolateItem(key)}
                title="Click to toggle · Double-click to isolate"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                  active
                    ? "border-transparent text-foreground"
                    : "border-border bg-transparent text-muted-foreground opacity-40",
                )}
                style={active ? { backgroundColor: item.color + "22", borderColor: item.color + "66" } : {}}
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: active ? item.color : undefined, background: active ? item.color : "currentColor" }} />
                {item.name}
              </button>
            )
          })}
          {selected.size < allItems.length && (
            <button
              onClick={onSelectAll}
              className="inline-flex items-center rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Show all
            </button>
          )}
        </div>

        {/* Chart */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(480, chartData.length * 56) }}>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    {visibleItems.map(item => (
                      <linearGradient key={item.id} id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={item.color} stopOpacity={isSingle ? 0.25 : 0.12} />
                        <stop offset="95%" stopColor={item.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const item = allItems.find(c => String(c.id) === name)
                      return [formatCurrency(Number(v)), item?.name ?? name]
                    }}
                    labelFormatter={(label: any) => formatYearMonth(String(label))}
                  />
                  {!isSingle && <Legend formatter={name => allItems.find(c => String(c.id) === name)?.name ?? name} />}
                  {visibleItems.map(item => (
                    <Area
                      key={item.id}
                      type="monotone"
                      dataKey={String(item.id)}
                      stroke={item.color}
                      strokeWidth={isSingle ? 2.5 : 1.5}
                      fill={`url(#grad-${item.id})`}
                      dot={isSingle ? { r: 3, fill: item.color } : false}
                    />
                  ))}
                  {months.length >= 3 && visibleItems.map(item => {
                    const avg = avgByKey.get(String(item.id))
                    if (!avg) return null
                    return (
                      <ReferenceLine key={`avg-${item.id}`} y={avg} stroke={item.color} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 4">
                        {isSingle && <Label value="avg" position="insideRight" fontSize={10} fill={item.color} fillOpacity={0.7} />}
                      </ReferenceLine>
                    )
                  })}
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={formatYearMonth} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `€${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip
                    formatter={(v: any, name: any) => {
                      const item = allItems.find(c => String(c.id) === name)
                      return [formatCurrency(Number(v)), item?.name ?? name]
                    }}
                    labelFormatter={(label: any) => formatYearMonth(String(label))}
                  />
                  {!isSingle && <Legend formatter={name => allItems.find(c => String(c.id) === name)?.name ?? name} />}
                  {visibleItems.map(item => (
                    <Bar key={item.id} dataKey={String(item.id)} fill={item.color} radius={[3, 3, 0, 0]} />
                  ))}
                  {months.length >= 3 && visibleItems.map(item => {
                    const avg = avgByKey.get(String(item.id))
                    if (!avg) return null
                    return (
                      <ReferenceLine key={`avg-${item.id}`} y={avg} stroke={item.color} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 4">
                        {isSingle && <Label value="avg" position="insideRight" fontSize={10} fill={item.color} fillOpacity={0.7} />}
                      </ReferenceLine>
                    )
                  })}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
