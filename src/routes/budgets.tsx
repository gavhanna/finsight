import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getBudgetHistory,
  getBudgets,
  getBudgetVsActual,
  getExpenseCategoriesAndGroups,
} from "@/server/fn/budgets";
import { getSetting } from "@/server/fn/settings";
import { withOfflineCache } from "@/lib/loader-cache";
import { formatYearMonthLong, stepMonth } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CurrentBudgetView,
  PlanBudgetView,
  BudgetHistoryView,
} from "@/components/budgets/console-budget-views";

const SearchSchema = z.object({
  month: z.string().optional(),
  view: z.enum(["this-month", "plan", "history"]).optional(),
  range: z.enum(["6m", "12m"]).optional(),
});

export const Route = createFileRoute("/budgets")({
  validateSearch: SearchSchema,
  component: BudgetsPage,
  loaderDeps: ({ search }) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      month:
        search.month ??
        (search.view === "plan" ? stepMonth(currentMonth, 1) : currentMonth),
    };
  },
  loader: async ({ deps }) =>
    withOfflineCache(`budgets-console:${deps.month}`, async () => {
      const [vsActual, allBudgets, history, categoriesAndGroups, currency] =
        await Promise.all([
          getBudgetVsActual({ data: { month: deps.month } }),
          getBudgets(),
          getBudgetHistory({ data: { endMonth: deps.month, months: 12 } }),
          getExpenseCategoriesAndGroups(),
          getSetting({ data: "preferred_currency" }).catch(() => "EUR"),
        ]);
      return {
        vsActual,
        allBudgets,
        history,
        ...categoriesAndGroups,
        currency: currency ?? "EUR",
      };
    }),
});

function BudgetsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = search.view ?? "this-month";
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month =
    search.month ??
    (view === "plan" ? stepMonth(currentMonth, 1) : currentMonth);
  const scopeMonth = month;
  const historyRange = search.range ?? "6m";

  function setMonth(value: string) {
    navigate({ search: (current) => ({ ...current, month: value }) });
  }

  return (
    <div className="console-page space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Budgets</p>
          <h1 className="mt-2 text-xl font-semibold">
            {view === "this-month"
              ? "This month"
              : view === "plan"
                ? `Plan ${formatYearMonthLong(scopeMonth)}`
                : "How the plan has held"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {view === "history"
              ? `${data.history.length} months of plan history`
              : `${formatYearMonthLong(scopeMonth)} · ${data.allBudgets.length} envelopes`}
          </p>
        </div>
        {view !== "history" ? (
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous month"
              variant="outline"
              size="icon-sm"
              onClick={() => setMonth(stepMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-36 text-center font-mono text-xs">
              {formatYearMonthLong(scopeMonth)}
            </span>
            <Button
              aria-label="Next month"
              variant="outline"
              size="icon-sm"
              onClick={() => setMonth(stepMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : (
          <Tabs
            value={historyRange}
            onValueChange={(value) =>
              value &&
              navigate({
                search: (current) => ({
                  ...current,
                  range: value as "6m" | "12m",
                }),
              })
            }
          >
            <TabsList>
              <TabsTrigger value="6m">6M</TabsTrigger>
              <TabsTrigger value="12m">12M</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      {view === "this-month" && (
        <CurrentBudgetView
          data={data.vsActual}
          allBudgets={data.allBudgets}
          currency={data.currency}
          month={month}
        />
      )}
      {view === "plan" && (
      <PlanBudgetView
        key={`${scopeMonth}:${data.allBudgets.map((budget) => `${budget.id}:${budget.monthlyAmount}:${budget.note ?? ""}:${budget.categoryId ?? ""}:${budget.categoryGroupId ?? ""}`).join("|")}`}
        data={data.vsActual}
          allBudgets={data.allBudgets}
          history={data.history}
          categories={data.categories}
          groups={data.groups}
          currency={data.currency}
          month={scopeMonth}
        />
      )}
      {view === "history" && (
        <BudgetHistoryView
          history={data.history}
          allBudgets={data.allBudgets}
          currency={data.currency}
          monthCount={historyRange === "12m" ? 12 : 6}
        />
      )}
    </div>
  );
}
