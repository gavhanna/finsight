import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  getAccounts,
  getIncomeVsExpenses,
  getRecurringTransactions,
  getSpendingByCategory,
  getSummaryStats,
  getTopMerchants,
  getTotalBalance,
} from "@/server/fn/insights";
import { getNetWorthProjection } from "@/server/fn/analytics";
import { getCategories } from "@/server/fn/categories";
import { getUncategorisedCount } from "@/server/fn/transactions";
import { getSetting } from "@/server/fn/settings";
import { getBudgetVsActual } from "@/server/fn/budgets";
import { formatCurrency, formatYearMonthLong, stepMonth } from "@/lib/utils";
import { withOfflineCache } from "@/lib/loader-cache";
import { getPresetDates } from "@/lib/presets";
import { buildProjection } from "@/lib/net-worth-projection";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHelp } from "@/components/ui/page-help";
import { NetWorthProjectionChart } from "@/components/analytics/net-worth-projection-chart";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CashFlowView, MonthReviewView } from "@/components/home/home-views";

const SearchSchema = z.object({
  view: z.enum(["overview", "cash-flow", "month-review"]).optional(),
  month: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  preset: z.enum(["month"]).default("month"),
});

export const Route = createFileRoute("/")({
  validateSearch: SearchSchema,
  component: DashboardPage,
  loaderDeps: ({ search }) => {
    const dates =
      !search.dateFrom && !search.dateTo
        ? getPresetDates("month")
        : { dateFrom: search.dateFrom, dateTo: search.dateTo };
    const previous = new Date();
    previous.setMonth(previous.getMonth() - 1);
    return {
      ...search,
      reviewMonth: search.month ?? previous.toISOString().slice(0, 7),
      ...dates,
    };
  },
  loader: async ({ deps }) => {
    const filters = {
      dateFrom: deps.dateFrom,
      dateTo: deps.dateTo,
      accountIds: deps.accountIds ?? [],
    };
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [reviewYear, reviewMonthNumber] = deps.reviewMonth
      .split("-")
      .map(Number);
    const reviewFrom = `${deps.reviewMonth}-01`;
    const reviewTo = new Date(reviewYear, reviewMonthNumber, 0)
      .toISOString()
      .slice(0, 10);
    const priorDate = new Date(reviewYear, reviewMonthNumber - 2, 1);
    const priorMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, "0")}`;
    const priorFrom = `${priorMonth}-01`;
    const priorTo = new Date(
      priorDate.getFullYear(),
      priorDate.getMonth() + 1,
      0,
    )
      .toISOString()
      .slice(0, 10);
    return withOfflineCache(
      `dashboard-console:${deps.reviewMonth}`,
      async () => {
        const [
          byCat,
          stats,
          accounts,
          currency,
          budgetVsActual,
          categories,
          totalBalance,
          projection,
          recurring,
          monthHistory,
          uncategorisedCount,
          reviewStats,
          reviewCategories,
          previousReviewCategories,
          reviewBudget,
          previousReviewBudget,
          reviewMerchants,
        ] = await Promise.all([
          getSpendingByCategory({ data: filters }).catch(() => []),
          getSummaryStats({ data: filters }).catch(() => ({
            totalIncome: 0,
            totalMoneyIn: 0,
            totalExpenses: 0,
            net: 0,
            count: 0,
          })),
          getAccounts().catch(() => []),
          getSetting({ data: "preferred_currency" }).catch(() => "EUR"),
          getBudgetVsActual({ data: { month: currentMonth } }).catch(() => ({
            month: currentMonth,
            categoryBudgets: [],
            groupBudgets: [],
            unbudgeted: [],
            incomeActual: 0,
            incomeAvg3m: 0,
          })),
          getCategories().catch(() => []),
          getTotalBalance().catch(() => ({
            balances: {} as Record<string, number>,
            hasData: false,
          })),
          getNetWorthProjection({
            data: { currency: "EUR", accountIds: filters.accountIds },
          }).catch(() => ({ history: [], fit: null })),
          getRecurringTransactions({ data: { includeIgnored: false } }).catch(
            () => [],
          ),
          getIncomeVsExpenses({
            data: { accountIds: filters.accountIds },
          }).catch(() => []),
          getUncategorisedCount().catch(() => 0),
          getSummaryStats({
            data: {
              dateFrom: reviewFrom,
              dateTo: reviewTo,
              accountIds: filters.accountIds,
            },
          }),
          getSpendingByCategory({
            data: {
              dateFrom: reviewFrom,
              dateTo: reviewTo,
              accountIds: filters.accountIds,
            },
          }),
          getSpendingByCategory({
            data: {
              dateFrom: priorFrom,
              dateTo: priorTo,
              accountIds: filters.accountIds,
            },
          }),
          getBudgetVsActual({ data: { month: deps.reviewMonth } }),
          getBudgetVsActual({ data: { month: priorMonth } }),
          getTopMerchants({
            data: {
              dateFrom: reviewFrom,
              dateTo: reviewTo,
              accountIds: filters.accountIds,
              limit: 5,
              excludeRecurring: false,
            },
          }),
        ]);
        const resolvedCurrency = currency ?? "EUR";
        const incomeCategoryId =
          categories.find(
            (category) =>
              category.type === "income" &&
              category.name.toLowerCase() === "income",
          )?.id ??
          categories.find((category) => category.type === "income")?.id;
        return {
          byCat,
          stats,
          accounts,
          currency: resolvedCurrency,
          budgetVsActual,
          currentMonth,
          totalBalance,
          projection,
          recurring,
          monthHistory,
          uncategorisedCount,
          incomeCategoryId,
          reviewMonth: deps.reviewMonth,
          reviewStats,
          reviewCategories,
          previousReviewCategories,
          reviewBudget,
          previousReviewBudget,
          reviewMerchants,
        };
      },
    );
  },
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const NET_WORTH_HORIZONS = [
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
] as const;

function monthName(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function shortMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${String(year).slice(2)}`;
}

function DashboardPage() {
  const {
    byCat,
    stats,
    accounts,
    currency,
    budgetVsActual,
    currentMonth,
    totalBalance,
    projection,
    recurring,
    monthHistory,
    uncategorisedCount,
    incomeCategoryId,
    reviewMonth,
    reviewStats,
    reviewCategories,
    previousReviewCategories,
    reviewBudget,
    previousReviewBudget,
    reviewMerchants,
  } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [netWorthHorizon, setNetWorthHorizon] = useState(12);
  const view = search.view ?? "overview";

  if (view === "cash-flow") {
    return (
      <div className="console-page space-y-5">
        <div>
          <p className="section-label">Cash flow</p>
          <h1 className="mt-2 text-xl font-semibold">Cash flow</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Money in and out of the accounts you spend from · next 30 days
          </p>
        </div>
        <CashFlowView
          monthHistory={monthHistory}
          accounts={accounts}
          recurring={recurring}
          currency={currency}
        />
      </div>
    );
  }

  if (view === "month-review") {
    const latestClosedMonth = stepMonth(
      new Date().toISOString().slice(0, 7),
      -1,
    );
    return (
      <div className="console-page space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label">Home</p>
            <h1 className="mt-2 text-xl font-semibold">Month in review</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              A closed-month account of what changed and what needs a decision
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous month"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                navigate({
                  search: (current) => ({
                    ...current,
                    month: stepMonth(reviewMonth, -1),
                  }),
                })
              }
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-36 text-center font-mono text-xs">
              {formatYearMonthLong(reviewMonth)}
            </span>
            <Button
              aria-label="Next month"
              variant="outline"
              size="icon-sm"
              disabled={reviewMonth >= latestClosedMonth}
              onClick={() =>
                navigate({
                  search: (current) => ({
                    ...current,
                    month: stepMonth(reviewMonth, 1),
                  }),
                })
              }
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <MonthReviewView
          month={reviewMonth}
          stats={reviewStats}
          categories={reviewCategories}
          previousCategories={previousReviewCategories}
          budget={reviewBudget}
          previousBudget={previousReviewBudget}
          merchants={reviewMerchants}
          currency={currency}
        />
      </div>
    );
  }

  const today = new Date();
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const elapsedDays = Math.max(1, today.getDate());
  const remainingDays = Math.max(1, daysInMonth - elapsedDays);

  const budgetRows = [
    ...budgetVsActual.categoryBudgets.map((row) => ({
      name: row.categoryName,
      spent: row.spent,
      budgeted: row.budgeted,
    })),
    ...budgetVsActual.groupBudgets.map((row) => ({
      name: row.groupName,
      spent: row.spent,
      budgeted: row.budgeted,
    })),
  ];

  const planned = budgetRows.reduce((sum, row) => sum + row.budgeted, 0);
  const projectedSpend = (stats.totalExpenses / elapsedDays) * daysInMonth;
  const variance = projectedSpend - planned;
  const safeDaily =
    planned > 0
      ? Math.max(0, (planned - stats.totalExpenses) / remainingDays)
      : 0;
  const budgetProgress =
    planned > 0 ? Math.min(100, (stats.totalExpenses / planned) * 100) : 0;
  const monthProgress = (elapsedDays / daysInMonth) * 100;
  const activeRecurring = recurring.filter(
    (item) => item.isActive && !item.isIgnored,
  );
  const monthlyRecurring = activeRecurring.reduce(
    (sum, item) => sum + item.monthlyEquiv,
    0,
  );
  const monthlyChange = projection.fit
    ? buildProjection(projection.fit, 12).milestones.monthlyChange
    : null;
  const netWorthProjected = projection.fit
    ? buildProjection(projection.fit, netWorthHorizon)
    : null;
  const netWorth =
    totalBalance.balances[currency] ?? projection.fit?.lastValue ?? null;
  const overBudget = budgetRows
    .filter((row) => row.budgeted > 0 && row.spent > row.budgeted)
    .sort((a, b) => b.spent - b.budgeted - (a.spent - a.budgeted));
  const recentMonths = [...monthHistory].slice(-4).reverse();
  const topCategories = [...byCat]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const largestCategory = topCategories[0]?.total ?? 1;
  const monthLabel = monthName(currentMonth);
  const hasPlan = planned > 0;
  const onTrack = !hasPlan || variance <= 0;

  const transactionSearch = {
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    accountIds: search.accountIds,
    page: 1,
  };

  return (
    <div className="console-page flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
          {monthLabel}
        </span>
        {accounts.length > 1 && (
          <Select
            value={(search.accountIds ?? [])[0] ?? "all"}
            onValueChange={(value) =>
              navigate({
                search: {
                  ...search,
                  accountIds: value && value !== "all" ? [value] : undefined,
                },
              })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name ?? account.iban ?? account.id}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="animate-in gap-0 py-0">
        <CardHeader className="gap-3 px-5 py-5 sm:px-6 sm:py-5">
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.11em]">
            {today.toLocaleDateString("en", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · {remainingDays} days left
          </CardDescription>
          <CardTitle className="max-w-5xl text-pretty text-xl font-medium leading-[1.45] tracking-[-0.015em] sm:text-[25px]">
            {hasPlan ? (
              <>
                At today&rsquo;s pace you&rsquo;ll finish{" "}
                {MONTH_NAMES[today.getMonth()]} on{" "}
                <span className="font-mono font-semibold">
                  {formatCurrency(projectedSpend, currency)}
                </span>
                {variance > 0 ? (
                  <>
                    {" "}
                    &mdash;{" "}
                    <span className="font-semibold text-warning">
                      {formatCurrency(variance, currency)} over
                    </span>{" "}
                    your{" "}
                    <span className="font-mono">
                      {formatCurrency(planned, currency)}
                    </span>{" "}
                    plan. Holding to{" "}
                    <span className="font-mono font-semibold">
                      {formatCurrency(safeDaily, currency)}
                    </span>{" "}
                    a day brings it level.
                  </>
                ) : (
                  <>
                    {" "}
                    &mdash;{" "}
                    <span className="font-semibold text-positive">
                      {formatCurrency(Math.abs(variance), currency)} under
                    </span>{" "}
                    your{" "}
                    <span className="font-mono">
                      {formatCurrency(planned, currency)}
                    </span>{" "}
                    plan.
                  </>
                )}
              </>
            ) : (
              <>
                You&rsquo;ve spent{" "}
                <span className="font-mono font-semibold">
                  {formatCurrency(stats.totalExpenses, currency)}
                </span>{" "}
                so far this month. Add a budget to see your projected finish and
                safe daily spend.
              </>
            )}
          </CardTitle>
          <CardAction>
            <Badge
              variant={onTrack ? "secondary" : "outline"}
              className={cn(onTrack ? "text-positive" : "text-warning")}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  onTrack ? "bg-positive" : "bg-warning",
                )}
              />
              {hasPlan
                ? onTrack
                  ? "On track"
                  : "Trending over"
                : "No plan yet"}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="animate-in stagger-1 lg:col-span-7">
          <CardHeader>
            <CardTitle className="section-label">Month status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <p className="font-mono text-4xl font-semibold tracking-[-0.04em] sm:text-[42px]">
                {formatCurrency(stats.totalExpenses, currency)}
              </p>
              <p className="pb-1 text-xs text-muted-foreground">
                spent
                {hasPlan ? (
                  <>
                    {" "}
                    of{" "}
                    <span className="font-mono text-secondary-foreground">
                      {formatCurrency(planned, currency)}
                    </span>{" "}
                    planned
                  </>
                ) : (
                  " this month"
                )}
              </p>
            </div>

            {hasPlan && (
              <div className="flex flex-col gap-2">
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-positive"
                    style={{ width: `${budgetProgress}%` }}
                  />
                  <span
                    className="absolute inset-y-[-3px] w-0.5 bg-foreground/80"
                    style={{ left: `${monthProgress}%` }}
                  />
                </div>
                <div className="flex justify-between gap-3 font-mono text-[11px] text-muted-foreground">
                  <span>{Math.round(budgetProgress)}% of plan used</span>
                  <span>{Math.round(monthProgress)}% of month elapsed</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
              <StatusMetric
                label="Safe daily"
                value={hasPlan ? formatCurrency(safeDaily, currency) : "—"}
              />
              <StatusMetric
                label="Money in"
                value={formatCurrency(stats.totalMoneyIn, currency)}
              />
              <StatusMetric
                label="Kept"
                value={formatCurrency(stats.net, currency)}
                positive={stats.net >= 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in stagger-2 lg:col-span-5">
          <CardHeader>
            <CardTitle className="section-label">Needs you</CardTitle>
            <CardAction className="font-mono text-xs text-muted-foreground">
              {uncategorisedCount + overBudget.length}
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            {uncategorisedCount > 0 && (
              <ActionRow
                title={`${uncategorisedCount} transaction${uncategorisedCount === 1 ? "" : "s"} need a category`}
                meta="Ready to review"
                to="/triage"
                action="Review"
                warning
              />
            )}
            {overBudget.slice(0, 2).map((row) => (
              <ActionRow
                key={row.name}
                title={`${row.name} is ${formatCurrency(row.spent - row.budgeted, currency)} over plan`}
                meta={`${formatCurrency(row.spent, currency)} spent`}
                to="/budgets"
                action="Adjust"
              />
            ))}
            {uncategorisedCount === 0 && overBudget.length === 0 && (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
                <span className="size-2 rounded-full bg-positive" />
                <p className="text-sm font-medium">
                  Nothing needs your attention
                </p>
                <p className="text-xs text-muted-foreground">
                  Transactions and budgets look tidy.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in stagger-3 lg:col-span-4">
          <CardHeader>
            <CardTitle className="section-label">Where it went</CardTitle>
            <CardAction>
              <Link
                to="/category-trends"
                className="text-xs font-medium text-primary"
              >
                Explore &rsaquo;
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {topCategories.length > 0 ? (
              topCategories.map((category) => (
                <div
                  key={category.categoryId ?? category.categoryName}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-sm"
                      style={{ backgroundColor: category.categoryColor }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-foreground">
                      {category.categoryName}
                    </span>
                    <span className="font-mono text-xs">
                      {formatCurrency(category.total, currency)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(category.total / largestCategory) * 100}%`,
                        backgroundColor: category.categoryColor,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No spending this month.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in stagger-4 lg:col-span-4">
          <CardHeader>
            <CardTitle className="section-label">Net worth</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="font-mono text-[26px] font-semibold tracking-[-0.03em]">
              {netWorth == null ? "—" : formatCurrency(netWorth, currency)}
            </p>
            <p
              className={cn(
                "font-mono text-xs font-medium",
                monthlyChange == null
                  ? "text-muted-foreground"
                  : monthlyChange >= 0
                    ? "text-positive"
                    : "text-negative",
              )}
            >
              {monthlyChange == null
                ? "Sync balances to start tracking"
                : `${monthlyChange >= 0 ? "+" : ""}${formatCurrency(monthlyChange, currency)} per month`}
            </p>
            <Sparkline
              points={projection.history.map((point) => point.total)}
            />
            <div className="flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Trend confidence</span>
              <span className="font-mono text-secondary-foreground">
                {projection.fit
                  ? buildProjection(projection.fit, 12).milestones.confidence
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in stagger-5 lg:col-span-4">
          <CardHeader>
            <CardTitle className="section-label">Fixed costs</CardTitle>
            <CardAction>
              <Link
                to="/recurring"
                className="text-xs font-medium text-primary"
              >
                Recurring &rsaquo;
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2">
              <p className="font-mono text-[26px] font-semibold tracking-[-0.03em]">
                {formatCurrency(monthlyRecurring, currency)}
              </p>
              <span className="text-xs text-muted-foreground">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalExpenses > 0
                ? `${Math.round((monthlyRecurring / stats.totalExpenses) * 100)}% of this month’s spend`
                : "No monthly spend to compare"}{" "}
              · {formatCurrency(monthlyRecurring * 12, currency)} a year
            </p>
            <div className="flex flex-col gap-2.5">
              {activeRecurring.slice(0, 4).map((item) => (
                <div
                  key={item.payee}
                  className="flex items-center gap-3 text-xs"
                >
                  <span className="w-12 shrink-0 font-mono text-muted-foreground">
                    {new Date(item.nextExpected).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-secondary-foreground">
                    {item.payee}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(item.avgAmount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in stagger-6 lg:col-span-12">
          <CardHeader className="gap-y-2">
            <CardTitle className="flex items-center gap-2">
              <span className="section-label">Net worth projection</span>
              <PageHelp title="Net worth projection">
                <p>
                  Your tracked account balances over time, with the dashed line
                  projecting forward at your current rate of change.
                </p>
                <p>
                  The shaded band is a likely range that widens further into the
                  future. This is a mechanical extrapolation of past balances,
                  not financial advice.
                </p>
              </PageHelp>
            </CardTitle>
            <CardDescription>
              Balance history and projected trajectory
            </CardDescription>
            {projection.fit && (
              <CardAction>
                <Tabs
                  value={String(netWorthHorizon)}
                  onValueChange={(value) =>
                    value && setNetWorthHorizon(Number(value))
                  }
                >
                  <TabsList>
                    {NET_WORTH_HORIZONS.map((horizon) => (
                      <TabsTrigger
                        key={horizon.months}
                        value={String(horizon.months)}
                      >
                        {horizon.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {projection.fit && netWorthProjected ? (
              <div className="flex flex-col gap-3">
                <NetWorthProjectionChart
                  history={projection.history}
                  fit={projection.fit}
                  horizonMonths={netWorthHorizon}
                  currency={currency}
                  zeroDate={netWorthProjected.milestones.zeroDate}
                />
                <p className="px-1 text-xs text-muted-foreground">
                  {netWorthProjected.milestones.trendingUp
                    ? "Trending up"
                    : "Trending down"}{" "}
                  ~
                  {formatCurrency(
                    Math.abs(netWorthProjected.milestones.monthlyChange),
                    currency,
                  )}
                  /mo · fitted over {projection.fit.windowDays} days of history
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No balance history yet. Sync your accounts to start tracking.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in stagger-6 lg:col-span-12">
          <CardHeader>
            <CardTitle className="section-label">Month by month</CardTitle>
            <CardAction>
              <Link
                to="/comparison"
                className="text-xs font-medium text-primary"
              >
                Comparison &rsaquo;
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.3fr] border-b border-border px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              <span>Month</span>
              <span className="text-right">In</span>
              <span className="text-right">Out</span>
              <span className="text-right">Net</span>
              <span className="pl-6">Rate</span>
            </div>
            {recentMonths.map((month) => {
              const rate =
                month.income > 0 ? (month.net / month.income) * 100 : 0;
              return (
                <div
                  key={month.month}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_1.3fr] items-center border-b border-border/60 px-4 py-3 text-xs last:border-0"
                >
                  <span className="font-medium">{shortMonth(month.month)}</span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatCurrency(month.moneyIn, currency)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatCurrency(month.expenses, currency)}
                  </span>
                  <span
                    className={cn(
                      "text-right font-mono font-medium",
                      month.net >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatCurrency(month.net, currency)}
                  </span>
                  <span className="flex items-center gap-2 pl-6">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-positive"
                        style={{
                          width: `${Math.max(0, Math.min(100, rate))}%`,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-muted-foreground">
                      {Math.round(rate)}%
                    </span>
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Link
          to="/transactions"
          search={{ ...transactionSearch, amountSign: "out" }}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "justify-between",
          )}
        >
          Review spending <ArrowRight />
        </Link>
        <Link
          to="/transactions"
          search={{
            ...transactionSearch,
            amountSign: "in",
            categoryId: incomeCategoryId,
          }}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "justify-between",
          )}
        >
          Review income <ArrowRight />
        </Link>
        <Link
          to="/budgets"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "justify-between",
          )}
        >
          Manage budgets <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-r border-border px-3 py-3 last:border-0">
      <span className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono text-sm font-semibold sm:text-base",
          positive && "text-positive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ActionRow({
  title,
  meta,
  to,
  action,
  warning,
}: {
  title: string;
  meta: string;
  to: "/triage" | "/budgets";
  action: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 first:pt-0 last:border-0 last:pb-0">
      {warning ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      ) : (
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {meta}
        </p>
      </div>
      <Link
        to={to}
        className={buttonVariants({ variant: "outline", size: "xs" })}
      >
        {action}
      </Link>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-20 rounded-lg bg-muted/40" />;
  const sample = points.slice(-24);
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const range = Math.max(1, max - min);
  const coords = sample
    .map((value, index) => {
      const x = sample.length === 1 ? 0 : (index / (sample.length - 1)) * 300;
      const y = 70 - ((value - min) / range) * 60;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 300 80"
      className="h-20 w-full"
      preserveAspectRatio="none"
      aria-label="Net worth trend"
    >
      <polyline
        points={`${coords} 300,80 0,80`}
        fill="var(--primary)"
        opacity="0.1"
        stroke="none"
      />
      <polyline
        points={coords}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
