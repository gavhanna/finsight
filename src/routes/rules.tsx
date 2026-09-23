import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { getAllRules, getCategories, deleteRule, reorderRules } from "../server/fn/categories"
import { recategoriseAll } from "../server/fn/transactions"
import { Plus, Search, Filter, RefreshCw } from "lucide-react"
import { PageHelp } from "@/components/ui/page-help"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectGroup } from "@/components/ui/select"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { withOfflineCache } from "@/lib/loader-cache"
import type { Category } from "../db/schema"
import type { RuleWithMeta } from "@/components/rules/types"
import { RuleRow } from "@/components/rules/rule-row"
import { RuleDialog } from "@/components/rules/rule-dialog"
import { CategoryDot } from "@/components/rules/category-dot"

export const Route = createFileRoute("/rules")({
  component: RulesPage,
  loader: () =>
    withOfflineCache("rules", async () => {
      const [ruleList, cats] = await Promise.all([getAllRules(), getCategories()])
      return { rules: ruleList, categories: cats }
    }),
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
    return list
  }, [rules, search, filterCatId])

  async function handleDelete(id: number) {
    if (!confirm("Delete this rule and all its patterns?")) return
    await deleteRule({ data: id })
    router.invalidate()
  }

  async function moveRule(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= filtered.length) return
    const ids = filtered.map((rule) => rule.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await reorderRules({ data: { ids } })
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
    <div className="console-page flex flex-col gap-5">
      {/* Header */}
      <div className="animate-in flex flex-col gap-1">
        <p className="section-label">First match wins</p>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Categorisation rules</h1>
            <PageHelp title="Categorisation Rules">
              <p>Rules automatically assign a category to transactions based on patterns matched against the payee name or description.</p>
              <p><strong className="text-foreground">Priority</strong> — rules are evaluated from highest to lowest. The first match wins. Drag to reorder.</p>
              <p><strong className="text-foreground">Patterns</strong> — each rule can have multiple patterns. A transaction matches if <em>any</em> pattern is found (case-insensitive substring match).</p>
              <p><strong className="text-foreground">Apply to history</strong> — re-runs all rules over every transaction, updating categories in bulk. Manually set categories are preserved.</p>
            </PageHelp>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={handleApplyAll} disabled={applying}>
              <RefreshCw data-icon="inline-start" className={cn(applying && "animate-spin")} />
              {applying ? "Applying…" : "Apply to history"}
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus data-icon="inline-start" />
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
                <SelectGroup>
                  <SelectItem value="all">All categories</SelectItem>
                  {ruleCategories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} label={c.name} startIcon={<CategoryDot category={c} />}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No matching rules</CardTitle>
            <CardDescription>
            {search || filterCatId !== null
              ? "No rules match your filters."
              : "No rules yet. Add one to start auto-categorising transactions."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden divide-y">
          {filtered.map((rule, index) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              categories={categories}
              isExpanded={expandedId === rule.id}
              onToggle={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              onDelete={() => handleDelete(rule.id)}
              onRefresh={() => router.invalidate()}
              onMoveUp={!search.trim() && filterCatId === null && index > 0 ? () => moveRule(index, -1) : undefined}
              onMoveDown={!search.trim() && filterCatId === null && index < filtered.length - 1 ? () => moveRule(index, 1) : undefined}
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
