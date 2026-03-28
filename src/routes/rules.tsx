import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { getAllRules, getCategories, deleteRule } from "../server/fn/categories"
import { recategoriseAll } from "../server/fn/transactions"
import { Plus, Search, Filter, RefreshCw } from "lucide-react"
import { PageHelp } from "@/components/ui/page-help"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { Category } from "../db/schema"
import type { RuleWithMeta } from "@/components/rules/types"
import { RuleRow } from "@/components/rules/rule-row"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { CategoryDot } from "@/components/rules/category-dot"

export const Route = createFileRoute("/rules")({
  component: RulesPage,
  loader: async () => {
    const [ruleList, cats] = await Promise.all([getAllRules(), getCategories()])
    return { rules: ruleList, categories: cats }
  },
})

function RulesPage() {
  const { rules, categories } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [filterCatId, setFilterCatId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)

  async function handleApplyAll() {
    setApplying(true)
    try {
      const result = await recategoriseAll()
      router.invalidate()
      toast.success(`Updated ${result.updated} of ${result.total} transactions`)
    } finally {
      setApplying(false)
    }
  }

  const filtered = useMemo(() => {
    let list = rules as RuleWithMeta[]
    if (filterCatId !== null) list = list.filter(r => r.categoryId === filterCatId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.patterns.some(p => p.pattern.toLowerCase().includes(q)) ||
        r.category?.name.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [rules, search, filterCatId])

  async function handleDelete(id: number) {
    if (!confirm("Delete this rule and all its patterns?")) return
    await deleteRule({ data: id })
    router.invalidate()
  }

  const ruleCategories = useMemo(() => {
    const seen = new Map<number, Category>()
    for (const r of rules as RuleWithMeta[]) {
      if (r.category) seen.set(r.category.id, r.category)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rules])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="animate-in space-y-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Rules</h1>
            <PageHelp title="Categorisation Rules">
              <p>Rules automatically assign a category to transactions based on patterns matched against the payee name or description.</p>
              <p><strong className="text-foreground">Priority</strong> — rules are evaluated from highest to lowest. The first match wins. Drag to reorder.</p>
              <p><strong className="text-foreground">Patterns</strong> — each rule can have multiple patterns. A transaction matches if <em>any</em> pattern is found (case-insensitive substring match).</p>
              <p><strong className="text-foreground">Apply to history</strong> — re-runs all rules over every transaction, updating categories in bulk. Manually set categories are preserved.</p>
            </PageHelp>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleApplyAll} disabled={applying}>
              <RefreshCw className={cn("h-4 w-4", applying && "animate-spin")} />
              {applying ? "Applying…" : "Apply to history"}
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Auto-categorise transactions by matching patterns against payee or description. Higher priority runs first.
        </p>
      </div>

      {/* Search + filter */}
      {(rules as RuleWithMeta[]).length > 3 && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rules or patterns…"
              className="pl-9"
            />
          </div>
          {ruleCategories.length > 1 && (
            <Select
              value={filterCatId !== null ? String(filterCatId) : "all"}
              onValueChange={v => setFilterCatId(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-44">
                <Filter className="size-3.5 text-muted-foreground mr-1" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {ruleCategories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <CategoryDot category={c} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {search || filterCatId !== null
              ? "No rules match your filters."
              : "No rules yet. Add one to start auto-categorising transactions."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden divide-y">
          {filtered.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              categories={categories}
              isExpanded={expandedId === rule.id}
              onToggle={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              onDelete={() => handleDelete(rule.id)}
              onRefresh={() => router.invalidate()}
            />
          ))}
        </div>
      )}

      <RuleDialog
        open={showNew}
        onOpenChange={setShowNew}
        categories={categories}
        onSaved={() => { setShowNew(false); router.invalidate() }}
      />
    </div>
  )
}
