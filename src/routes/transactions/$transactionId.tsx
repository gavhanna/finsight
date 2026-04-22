import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  Building2,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  type LucideIcon,
  Receipt,
  Repeat2,
  Shapes,
  ShieldCheck,
  Store,
  TrendingUp,
} from "lucide-react"
import type { ReactNode } from "react"
import { getCategories } from "@/server/fn/categories"
import {
  getTransactionDetail,
  updateTransactionCategory,
} from "@/server/fn/transactions"
import { withOfflineCache } from "@/lib/loader-cache"
import { cn, formatCurrency, formatDate, formatYearMonth } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartTooltip } from "@/components/chart-tooltip"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const SearchSchema = z.object({
  page: z.coerce.number().default(1),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  accountIds: z.array(z.string()).optional(),
})

type MerchantInsightCard = {
  title: string
  value: string
  description: string
  tone?: "default" | "primary" | "warning" | "danger"
  icon?: LucideIcon
}

export const Route = createFileRoute("/transactions/$transactionId")({
  validateSearch: SearchSchema,
  loader: async ({ params }) =>
    withOfflineCache(`transaction:${params.transactionId}`, async () => {
      const transactionId = decodeURIComponent(params.transactionId)
      const [detail, categories] = await Promise.all([
        getTransactionDetail({ data: { id: transactionId } }),
        getCategories(),
      ])
      return { detail, categories }
    }),
  component: TransactionDetailPage,
})

function TransactionDetailPage() {
  const { detail, categories } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [categoryValue, setCategoryValue] = useState(detail?.categoryId ? String(detail.categoryId) : "uncategorised")

  useEffect(() => {
    setCategoryValue(detail?.categoryId ? String(detail.categoryId) : "uncategorised")
  }, [detail?.categoryId])

  if (!detail) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Link
          to="/transactions"
          search={search}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Transactions
        </Link>

        <Card>
          <CardContent className="py-10 text-center">
            <Receipt className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="font-medium">Transaction not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or the link may be out of date.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const transaction = detail
  const primaryParty =
    transaction.creditorName ?? transaction.debtorName ?? transaction.description ?? "Unknown transaction"
  const secondaryParty =
    transaction.creditorName && transaction.debtorName
      ? `${transaction.debtorName} -> ${transaction.creditorName}`
      : transaction.description && transaction.description !== primaryParty
        ? transaction.description
        : null
  const isIncome = transaction.amount >= 0
  const categoryTone = transaction.category?.color ?? "var(--muted-foreground)"
  const merchantSearch = {
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    accountIds: search.accountIds,
  }
  const merchantChartData = transaction.merchant?.monthlySpend.map((entry) => ({
    ...entry,
    monthLabel: formatYearMonth(entry.month),
  })) ?? []
  const merchantInsightCardsRaw: Array<MerchantInsightCard | null> = [
    transaction.merchantContext?.recurring
      ? {
          title: "Recurring Pattern",
          value: transaction.merchantContext.recurring.frequency,
          description: `Typically ${formatCurrency(transaction.merchantContext.recurring.averageAmount, transaction.currency)}. Next expected ${formatDate(transaction.merchantContext.recurring.nextExpected)}.`,
          tone: transaction.merchantContext.recurring.isActive ? "primary" : "default",
          icon: Repeat2,
        }
      : null,
    transaction.merchantContext?.spendingPattern
      ? {
          title: "Usual Spend Check",
          value: `${formatRatio(transaction.merchantContext.spendingPattern.ratioToAverage)} usual`,
          description: `Compared with ${formatCurrency(transaction.merchantContext.spendingPattern.averageHistoricalAmount, transaction.currency)} across ${transaction.merchantContext.spendingPattern.priorTransactionCount} similar payments in the last 90 days.`,
          tone: transaction.merchantContext.spendingPattern.isUnusuallyLarge
            ? "warning"
            : "default",
          icon: AlertTriangle,
        }
      : null,
  ]
  const merchantInsightCards = merchantInsightCardsRaw.filter(
    (card): card is MerchantInsightCard => card !== null,
  )

  async function handleCategoryChange(nextValue: string) {
    const categoryId = nextValue === "uncategorised" ? null : Number(nextValue)
    setCategoryValue(nextValue)
    await updateTransactionCategory({ data: { id: transaction.id, categoryId } })
    router.invalidate()
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/transactions"
          search={search}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to transactions
        </Link>

        {!isIncome && primaryParty !== "Unknown transaction" && (
          <Link
            to="/merchants/$merchant"
            params={{ merchant: primaryParty }}
            search={merchantSearch}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Store className="size-4" />
            View merchant history
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                isIncome ? "bg-positive/12 text-positive" : "bg-muted text-foreground",
              )}
            >
              {isIncome ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{primaryParty}</h1>
                <Badge variant="outline">{isIncome ? "Money in" : "Money out"}</Badge>
                <Badge variant="outline">{transaction.currency}</Badge>
              </div>
              {secondaryParty && (
                <p className="max-w-3xl text-sm text-muted-foreground">{secondaryParty}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Booked {formatDate(transaction.bookingDate)}</span>
                {transaction.valueDate && <span>Value date {formatDate(transaction.valueDate)}</span>}
                <span>Account {transaction.account.name ?? transaction.account.iban ?? transaction.account.id}</span>
              </div>
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Amount</p>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums", isIncome && "text-positive")}>
              {formatCurrency(transaction.amount, transaction.currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Shapes}
          label="Category"
          value={transaction.category?.name ?? "Uncategorised"}
          accent={transaction.category ? categoryTone : undefined}
        />
        <SummaryCard
          icon={CreditCard}
          label="Account"
          value={transaction.account.name ?? transaction.account.iban ?? transaction.account.id}
          secondary={transaction.connection?.institutionName ?? transaction.account.ownerName ?? undefined}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Categorised by"
          value={formatCategorisedBy(transaction.categorisedBy)}
        />
        <SummaryCard
          icon={Building2}
          label="Institution"
          value={transaction.connection?.institutionName ?? "Unknown institution"}
          secondary={transaction.connection?.status ?? undefined}
        />
      </div>

      {transaction.categoryContext && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {transaction.categoryContext.budgetedAmount && (
            <InsightCard
              title="Budget Impact"
              value={formatPercent(transaction.categoryContext.transactionShareOfBudget)}
              description={`of ${formatCurrency(transaction.categoryContext.budgetedAmount, transaction.currency)} monthly budget`}
              tone="primary"
            />
          )}
          <InsightCard
            title="Category Share"
            value={formatPercent(transaction.categoryContext.transactionShareOfMonth)}
            description={`of ${formatCurrency(transaction.categoryContext.monthSpent, transaction.currency)} spent in this category this month`}
          />
          {transaction.categoryContext.monthBudgetUsed !== null && (
            <InsightCard
              title="Month Budget Used"
              value={formatPercent(transaction.categoryContext.monthBudgetUsed)}
              description="already spent in this category this month"
              tone={
                transaction.categoryContext.monthBudgetUsed > 1
                  ? "danger"
                  : transaction.categoryContext.monthBudgetUsed >= 0.75
                    ? "warning"
                    : "default"
              }
            />
          )}
        </div>
      )}

      {merchantInsightCards.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {merchantInsightCards.map((card) => (
            <InsightCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              tone={card.tone}
              icon={card.icon}
            />
          ))}
        </div>
      )}

      {transaction.merchant && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Store}
            label="Merchant"
            value={transaction.merchant.canonicalName}
            secondary={
              transaction.merchant.lastSeen
                ? `Last seen ${formatDate(transaction.merchant.lastSeen)}`
                : undefined
            }
          />
          <SummaryCard
            icon={Repeat2}
            label="Visits"
            value={String(transaction.merchant.transactionCount)}
            secondary={
              transaction.merchant.firstSeen
                ? `Since ${formatDate(transaction.merchant.firstSeen)}`
                : undefined
            }
          />
          <SummaryCard
            icon={TrendingUp}
            label="Total spent"
            value={formatCurrency(transaction.merchant.totalSpend, transaction.currency)}
          />
          <SummaryCard
            icon={CalendarDays}
            label="Typical spend"
            value={formatCurrency(transaction.merchant.averageSpend, transaction.currency)}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
            <CardDescription>
              Core transaction data, categorisation, and import metadata.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Category">
                <select
                  value={categoryValue}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="uncategorised">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Categorised by">
                <span>{formatCategorisedBy(transaction.categorisedBy)}</span>
              </Field>
              <Field label="Booking date">
                <span>{formatDate(transaction.bookingDate)}</span>
              </Field>
              <Field label="Value date">
                <span>{transaction.valueDate ? formatDate(transaction.valueDate) : "Not provided"}</span>
              </Field>
              <Field label="Currency">
                <span>{transaction.currency}</span>
              </Field>
              <Field label="Merchant category code">
                <span>{transaction.merchantCategoryCode ?? "Not provided"}</span>
              </Field>
              <Field label="Description">
                <span className="whitespace-pre-wrap break-words">{transaction.description ?? "Not provided"}</span>
              </Field>
              <Field label="Account owner">
                <span>{transaction.account.ownerName ?? "Not provided"}</span>
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {transaction.merchant ? (
            <>
              {merchantChartData.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Spend Trend</CardTitle>
                    <CardDescription>
                      A quick view of how this merchant has shown up in your spending over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={merchantChartData} barSize={24}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.5 0 0 / 0.08)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            formatCurrency(value, transaction.currency, {
                              notation: "compact",
                              maximumFractionDigits: 1,
                              minimumFractionDigits: 0,
                            })
                          }
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={54}
                        />
                        <Tooltip content={<ChartTooltip currency={transaction.currency} />} />
                        <Bar
                          dataKey="total"
                          name="Spent"
                          fill="var(--color-chart-5)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="size-4 text-muted-foreground" />
                    <CardTitle>Recent At This Merchant</CardTitle>
                  </div>
                  <CardDescription>
                    A quick view of your latest transactions with this merchant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {transaction.merchant.recentTransactions.map((merchantTx) => {
                    const isCurrent = merchantTx.id === transaction.id
                    return (
                      <Link
                        key={merchantTx.id}
                        to="/transactions/$transactionId"
                        params={{ transactionId: encodeURIComponent(merchantTx.id) }}
                        search={search}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-muted/40",
                          isCurrent && "border-primary/30 bg-primary/5",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {formatDate(merchantTx.bookingDate)}
                            </p>
                            {isCurrent && <Badge variant="outline">This transaction</Badge>}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {merchantTx.description ?? transaction.merchant?.canonicalName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(merchantTx.amount, merchantTx.currency)}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: merchantTx.categoryColor }}
                          >
                            {merchantTx.categoryName}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Account Context</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Account IBAN">
                  <span className="break-all">{transaction.account.iban ?? "Not provided"}</span>
                </Field>
                <Field label="Account owner">
                  <span>{transaction.account.ownerName ?? "Not provided"}</span>
                </Field>
                <Field label="Institution status">
                  <span>{transaction.connection?.status ?? "Not provided"}</span>
                </Field>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raw Import Payload</CardTitle>
          <CardDescription>
            Expand this when you need the original bank transaction object for debugging or support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transaction.rawDataText ? (
            <details className="group rounded-xl border border-border bg-muted/20 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                <span className="group-open:hidden">Show raw payload</span>
                <span className="hidden group-open:inline">Hide raw payload</span>
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                {formatRawPayload(transaction.rawDataText)}
              </pre>
            </details>
          ) : (
            <p className="text-sm text-muted-foreground">No raw payload was stored for this transaction.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  secondary,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  secondary?: string
  accent?: string
}) {
  return (
    <Card className="py-3">
      <CardContent className="px-4">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="font-semibold" style={accent ? { color: accent } : undefined}>
          {value}
        </p>
        {secondary && <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>}
      </CardContent>
    </Card>
  )
}

function InsightCard({
  title,
  value,
  description,
  tone = "default",
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  tone?: "default" | "primary" | "warning" | "danger"
  icon?: LucideIcon
}) {
  const valueClass =
    tone === "danger"
      ? "text-negative"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground"

  return (
    <Card className="py-3">
      <CardContent className="px-4">
        {Icon ? (
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <Icon className="size-3.5" />
            <span className="text-xs">{title}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{title}</p>
        )}
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", valueClass)}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function formatCategorisedBy(value: string | null | undefined) {
  if (!value) return "Not categorised yet"
  if (value === "llm") return "AI suggestion"
  if (value === "mcc") return "Merchant code"
  if (value === "rule") return "Rule"
  if (value === "manual") return "Manual"
  return value
}

function formatRawPayload(rawDataText: string) {
  try {
    return JSON.stringify(JSON.parse(rawDataText), null, 2)
  } catch {
    return rawDataText
  }
}

function formatPercent(value: number | null) {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

function formatRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return `${value.toFixed(value >= 10 ? 0 : 1)}x`
}
