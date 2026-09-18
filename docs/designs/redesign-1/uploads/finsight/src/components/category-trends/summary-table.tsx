import { cn, formatCurrency, formatYearMonth } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { TrendBadge } from "@/components/trend-badge"

type StatItem = {
  id: number | null
  name: string
  color: string
  total: number
  avgPerMonth: number
  peak: { month: string; total: number } | null
  trendPct: number | null
}

export function SummaryTable({
  items,
  selected,
  viewMode,
  onToggle,
}: {
  items: StatItem[]
  selected: Set<string>
  viewMode: "categories" | "groups"
  onToggle: (key: string) => void
}) {
  const { sorted, sortKey, sortDir, toggle } = useSortable(items, "total", "desc")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead id="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>
                {viewMode === "groups" ? "Group" : "Category"}
              </SortableHead>
              <SortableHead id="total" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Total</SortableHead>
              <SortableHead id="avgPerMonth" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden sm:table-cell">Avg / month</SortableHead>
              <TableHead className="text-right hidden md:table-cell">Peak month</TableHead>
              <SortableHead id="trendPct" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Trend</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => onToggle(String(item.id))}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className={cn("font-medium", !selected.has(String(item.id)) && "text-muted-foreground line-through")}>
                      {item.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(item.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                  {formatCurrency(item.avgPerMonth)}
                </TableCell>
                <TableCell className="text-right hidden md:table-cell">
                  {item.peak ? (
                    <span className="tabular-nums text-sm">
                      <span className="text-muted-foreground">{formatYearMonth(item.peak.month)}</span>
                      {" "}<span className="font-medium">{formatCurrency(item.peak.total)}</span>
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <TrendBadge pct={item.trendPct} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
