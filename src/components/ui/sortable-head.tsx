import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SortDir } from "@/hooks/use-sortable"

interface SortableHeadProps {
  children: React.ReactNode
  id: string
  sortKey: string | null
  sortDir: SortDir
  onSort: (key: string) => void
  className?: string
}

export function SortableHead({ children, id, sortKey, sortDir, onSort, className }: SortableHeadProps) {
  const active = sortKey === id
  return (
    <TableHead
      className={cn("cursor-pointer select-none group", className)}
      onClick={() => onSort(id)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={cn("transition-opacity", active ? "opacity-70" : "opacity-0 group-hover:opacity-40")}>
          {active
            ? sortDir === "asc"
              ? <ChevronUp className="size-3.5" />
              : <ChevronDown className="size-3.5" />
            : <ChevronsUpDown className="size-3.5" />}
        </span>
      </span>
    </TableHead>
  )
}
