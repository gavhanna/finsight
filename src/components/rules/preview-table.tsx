import { Search, AlertTriangle } from "lucide-react"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PreviewTx } from "./types"

export function PreviewTable({ preview, previewing, manualCount, patternCount }: {
  preview: { count: number; capped: boolean; transactions: PreviewTx[] } | null
  previewing: boolean; manualCount: number; patternCount?: number
}) {
  const scope = patternCount && patternCount > 1 ? ` across ${patternCount} patterns` : ""
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Search className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          {previewing
            ? "Searching…"
            : preview
              ? `${preview.count}${preview.capped ? "+" : ""} matching transaction${preview.count !== 1 ? "s" : ""}${scope}${manualCount > 0 ? ` · ${manualCount} manual` : ""}`
              : "No matches"}
        </span>
        {manualCount > 0 && !previewing && <AlertTriangle className="size-3 text-warning shrink-0" />}
      </div>
      {preview && preview.transactions.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="py-1.5 text-xs">Date</TableHead>
                  <TableHead className="py-1.5 text-xs">Payee</TableHead>
                  <TableHead className="py-1.5 text-xs text-right">Amount</TableHead>
                  <TableHead className="py-1.5 text-xs">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.transactions.map(tx => (
                  <TableRow key={tx.id} className={cn(tx.categorisedBy === "manual" && "opacity-40")}>
                    <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.bookingDate)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs max-w-xs truncate">
                      {tx.creditorName ?? tx.debtorName ?? tx.description ?? "—"}
                    </TableCell>
                    <TableCell className={cn("py-1.5 text-xs text-right tabular-nums whitespace-nowrap", tx.amount >= 0 && "text-positive")}>
                      {formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      {tx.category
                        ? <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full shrink-0 inline-block" style={{ backgroundColor: tx.category.color }} />
                          {tx.category.name}
                          {tx.categorisedBy === "manual" && <span className="text-muted-foreground">(manual)</span>}
                        </span>
                        : <span className="text-muted-foreground">Uncategorised</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
