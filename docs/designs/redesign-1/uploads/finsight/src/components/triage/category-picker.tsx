import { cn } from "@/lib/utils"
import type { Category } from "@/db/schema"
import { PageHelp } from "@/components/ui/page-help"

export function CategoryPicker({
  categories,
  onSelect,
}: {
  categories: Category[]
  onSelect: (categoryId: number | null) => void
}) {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="animate-in space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Review transactions</h2>
          <PageHelp title="Triage">
            <p>Triage lets you quickly review and correct transaction categories one by one.</p>
            <p><strong className="text-foreground">Pick a category</strong> — choose which category to review, or select <em>Uncategorised</em> to work through transactions with no category yet.</p>
            <p><strong className="text-foreground">During triage</strong> — you can reassign the category, skip a transaction, or create a new rule so similar transactions are handled automatically in future.</p>
          </PageHelp>
        </div>
        <p className="text-sm text-muted-foreground">Pick a category to go through and fix.</p>
      </div>
      <div className="animate-in stagger-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
            "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10 bg-muted-foreground/40" />
          <span className="truncate text-xs font-semibold">Uncategorised</span>
        </button>
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            style={{ animationDelay: `${i * 20}ms` }}
            className={cn(
              "animate-in flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3 text-left text-sm font-medium",
              "transition-all hover:bg-accent hover:border-primary/30 hover:shadow-sm hover:-translate-y-px",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="size-2.5 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: cat.color }} />
            <span className="truncate text-xs font-semibold">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
