import { cn } from "@/lib/utils"
import type { Category } from "@/db/schema"

export function CategoryGrid({
  categories,
  currentCategoryId,
  onSelect,
  disabled,
}: {
  categories: Category[]
  currentCategoryId?: number | null
  onSelect: (id: number) => void
  disabled: boolean
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {categories.map((cat, i) => {
        const isCurrent = cat.id === currentCategoryId
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            disabled={disabled}
            style={{ animationDelay: `${i * 20}ms` }}
            className={cn(
              "animate-in flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
              "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent && "border-primary/40 bg-accent/50",
            )}
          >
            <span className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: cat.color }} />
            <span className="truncate text-xs font-semibold">{cat.name}</span>
          </button>
        )
      })}
    </div>
  )
}
