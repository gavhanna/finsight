import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import {
  getBudgetVsActual,
  getBudgets,
  getExpenseCategoriesAndGroups,
} from "../server/fn/budgets"
import { getSetting } from "../server/fn/settings"
import { withOfflineCache } from "@/lib/loader-cache"
import { cn, stepMonth, formatYearMonthLong } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"
import { PageHelp } from "@/components/ui/page-help"
import { OverviewTab } from "@/components/budgets/overview-tab"
import { ManageTab } from "@/components/budgets/manage-tab"

// ─── Route ────────────────────────────────────────────────────────────────────

const SearchSchema = z.object({
  month: z.string().optional(),
  tab: z.enum(["overview", "manage"]).optional(),
})

export const Route = createFileRoute("/budgets")({
  validateSearch: SearchSchema,
  component: () => <BudgetsPage />,
  loaderDeps: ({ search }) => ({
    month: search.month ?? new Date().toISOString().slice(0, 7),
    tab: search.tab ?? "overview",
  }),
  loader: async ({ deps }) =>
    withOfflineCache(`budgets:${deps.month}`, async () => {
      const [vsActual, allBudgets, catsAndGroups, currency] = await Promise.all([
        getBudgetVsActual({ data: { month: deps.month } }),
        getBudgets(),
        getExpenseCategoriesAndGroups(),
        getSetting({ data: "preferred_currency" }),
      ])
      return { vsActual, allBudgets, ...catsAndGroups, currency: currency ?? "GBP" }
    }),
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { vsActual, allBudgets, categories, groups, currency } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const today = new Date().toISOString().slice(0, 7)
  const month = search.month ?? today
  const tab   = search.tab   ?? "overview"

  const isCurrentMonth = month === today
  function setMonth(m: string) {
    navigate({ search: (s) => ({ ...s, month: m === today ? undefined : m }) })
  }

  function setTab(t: "overview" | "manage") {
    navigate({ search: (s) => ({ ...s, tab: t === "overview" ? undefined : t }) })
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Budgets</h1>
          <PageHelp title="Budgets">
            <p>Track your monthly spending against targets you set per category or group.</p>
            <p><strong className="text-foreground">Progress bars</strong> turn amber at 75% and red when you exceed the budget.</p>
            <p><strong className="text-foreground">Overrides</strong> let you set a one-off amount for a specific month without changing your standing budget.</p>
            <p><strong className="text-foreground">Unbudgeted spending</strong> shows what you&apos;re spending on categories that have no budget set.</p>
          </PageHelp>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md overflow-hidden border">
            {(["overview", "manage"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 text-sm transition-colors capitalize",
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="flex items-center gap-1">
              {!isCurrentMonth && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMonth(today)}>
                  <TrendingUp className="size-3.5" />
                  This month
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setMonth(stepMonth(month, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[110px] text-center">{formatYearMonthLong(month)}</span>
              <Button variant="outline" size="icon" onClick={() => setMonth(stepMonth(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {tab === "overview" ? (
        <OverviewTab vsActual={vsActual} currency={currency} month={month} />
      ) : (
        <ManageTab allBudgets={allBudgets} categories={categories} groups={groups} currency={currency} />
      )}
    </div>
  )
}
