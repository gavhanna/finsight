import { toolDefinition } from "@tanstack/ai"
import { z } from "zod"
import type { ChatContext, ChatScope } from "@/lib/ai-chat.types"
import { financeToolResultSchema } from "@/lib/ai-chat.types"
import {
  getIncomeVsExpenses,
  getRecurringTransactions,
  getSpendingByCategory,
  getSpendingTrends,
  getSummaryStats,
  getTopMerchants,
  getYearOverYearComparison,
} from "@/server/fn/insights"
import { getBudgetVsActual } from "@/server/fn/budgets"
import { getMerchantDetail } from "@/server/fn/merchants"
import { getTransactionStats, getTransactions } from "@/server/fn/transactions"

function toInsightFilters(context: ChatContext) {
  return {
    dateFrom: context.filters.dateFrom,
    dateTo: context.filters.dateTo,
    accountIds: context.filters.accountIds ?? [],
  }
}

function getMonthForBudget(context: ChatContext) {
  if (context.filters.dateTo) return context.filters.dateTo.slice(0, 7)
  if (context.filters.dateFrom) return context.filters.dateFrom.slice(0, 7)
  return new Date().toISOString().slice(0, 7)
}

type BudgetOpportunity = {
  name: string
  type: "category" | "group" | "unbudgeted"
  classification: "fixed" | "essential" | "discretionary" | "mixed"
  savingsPotential: "low" | "medium" | "high"
  reason: string
  budgeted?: number
  spent: number
  overspend?: number
  suggestedReviewAmount?: number
}

const FIXED_BUDGET_KEYWORDS = [
  "mortgage",
  "rent",
  "loan",
  "debt",
  "tax",
  "insurance",
  "childcare",
  "tuition",
  "utilities",
  "electric",
  "gas",
  "internet",
  "phone",
]

const ESSENTIAL_BUDGET_KEYWORDS = [
  "grocer",
  "grocery",
  "food",
  "health",
  "medical",
  "pharmacy",
  "transport",
  "fuel",
  "pet",
  "home",
  "car",
]

const DISCRETIONARY_BUDGET_KEYWORDS = [
  "entertain",
  "hobbies",
  "shopping",
  "dining",
  "takeaway",
  "restaurants",
  "coffee",
  "travel",
  "holiday",
  "subscriptions",
  "charity",
  "spending",
]

function classifyBudgetItem(name: string) {
  const value = name.toLowerCase()
  if (FIXED_BUDGET_KEYWORDS.some((keyword) => value.includes(keyword))) return "fixed" as const
  if (DISCRETIONARY_BUDGET_KEYWORDS.some((keyword) => value.includes(keyword))) return "discretionary" as const
  if (ESSENTIAL_BUDGET_KEYWORDS.some((keyword) => value.includes(keyword))) return "essential" as const
  return "mixed" as const
}

function getSavingsPotential(classification: ReturnType<typeof classifyBudgetItem>, amount: number) {
  if (amount < 10) return "low" as const
  if (classification === "fixed") return "low" as const
  if (classification === "discretionary" && amount >= 50) return "high" as const
  if (classification === "essential") return "medium" as const
  return "medium" as const
}

function buildBudgetOpportunities(data: Awaited<ReturnType<typeof getBudgetVsActual>>) {
  const opportunities: BudgetOpportunity[] = []

  for (const row of data.categoryBudgets) {
    const classification = classifyBudgetItem(row.categoryName)
    const overspend = Math.max(row.spent - row.budgeted, 0)
    if (row.spent < 10 || overspend <= 0) continue

    opportunities.push({
      name: row.categoryName,
      type: "category",
      classification,
      savingsPotential: getSavingsPotential(classification, row.spent),
      reason:
        classification === "fixed"
          ? "Large fixed commitment that is worth monitoring, but not usually an immediate savings lever."
          : overspend > row.budgeted * 0.15
            ? "Meaningfully over budget this month."
            : "Slightly over budget and worth reviewing.",
      budgeted: row.budgeted,
      spent: row.spent,
      overspend,
      suggestedReviewAmount: classification === "fixed" ? undefined : Math.min(overspend, row.spent * 0.15),
    })
  }

  for (const row of data.unbudgeted) {
    const classification = classifyBudgetItem(row.categoryName)
    if (row.spent < 10) continue

    opportunities.push({
      name: row.categoryName,
      type: "unbudgeted",
      classification,
      savingsPotential: getSavingsPotential(classification, row.spent),
      reason:
        classification === "fixed"
          ? "Unbudgeted fixed-like spending should usually be planned for rather than treated as an easy cut."
          : "Spending happened without a budget, so it is a good review candidate.",
      spent: row.spent,
      suggestedReviewAmount: classification === "fixed" ? undefined : Math.min(row.spent * 0.2, row.spent),
    })
  }

  return opportunities
    .sort((left, right) => {
      const score = (item: BudgetOpportunity) => {
        const potentialScore = item.savingsPotential === "high" ? 3 : item.savingsPotential === "medium" ? 2 : 1
        const classificationPenalty = item.classification === "fixed" ? -2 : item.classification === "essential" ? -1 : 0
        return potentialScore * 100 + item.spent + classificationPenalty * 25
      }
      return score(right) - score(left)
    })
    .slice(0, 8)
}

async function getDashboardContext(context: ChatContext) {
  const filters = toInsightFilters(context)
  const [summary, topCategories, topMerchants, cashFlow] = await Promise.all([
    getSummaryStats({ data: filters }),
    getSpendingByCategory({ data: filters }),
    getTopMerchants({ data: { ...filters, limit: 6, excludeRecurring: false } }),
    getIncomeVsExpenses({ data: filters }),
  ])

  return {
    summary: "Dashboard totals, top categories, top merchants, and recent cash-flow trends.",
    data: {
      summary,
      topCategories: topCategories.slice(0, 6),
      topMerchants,
      cashFlow: cashFlow.slice(-6),
    },
  }
}

async function getTransactionsContext(context: ChatContext) {
  const filters = {
    dateFrom: context.filters.dateFrom,
    dateTo: context.filters.dateTo,
    accountIds: context.filters.accountIds ?? [],
    categoryId: context.filters.categoryId ?? undefined,
    search: context.filters.search,
  }

  const [stats, list] = await Promise.all([
    getTransactionStats({ data: filters }),
    getTransactions({ data: { ...filters, page: 1, pageSize: 20 } }),
  ])

  return {
    summary: "Transaction totals and a sample of matching transactions from the current filters.",
    data: {
      stats,
      sample: list.transactions.slice(0, 12).map((tx) => ({
        id: tx.id,
        bookingDate: tx.bookingDate,
        amount: tx.amount,
        currency: tx.currency,
        payee: tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown",
        category: tx.category?.name ?? "Uncategorised",
      })),
      total: list.total,
    },
  }
}

async function getRecurringContext() {
  const items = await getRecurringTransactions()

  return {
    summary: "Recurring payments ranked by monthly equivalent cost.",
    data: {
      topItems: items.slice(0, 10),
      totalMonthlyEquivalent: items.reduce((sum, item) => sum + item.monthlyEquiv, 0),
      activeCount: items.filter((item) => item.isActive).length,
    },
  }
}

async function getBudgetsContext(context: ChatContext) {
  const month = getMonthForBudget(context)
  const data = await getBudgetVsActual({ data: { month } })
  const opportunities = buildBudgetOpportunities(data)
  const fixedCommitments = opportunities
    .filter((item) => item.classification === "fixed")
    .slice(0, 5)

  return {
    summary: `Budget performance for ${month}.`,
    data: {
      month,
      categoryBudgets: data.categoryBudgets.slice(0, 12),
      groupBudgets: data.groupBudgets,
      unbudgeted: data.unbudgeted.slice(0, 8),
      incomeActual: data.incomeActual,
      incomeAvg3m: data.incomeAvg3m,
      realisticSavingsOpportunities: opportunities.filter((item) => item.classification !== "fixed"),
      fixedCostWatchlist: fixedCommitments,
      budgetingNotes: [
        "Treat fixed housing, debt, tax, insurance, and utility costs as low short-term savings levers unless the user explicitly asks about restructuring them.",
        "Ignore tiny categories when looking for savings opportunities.",
        "Prioritize over-budget discretionary or unbudgeted spending over fully allocated fixed costs.",
      ],
    },
  }
}

async function getCategoryTrendsContext(context: ChatContext) {
  const trends = await getSpendingTrends({ data: toInsightFilters(context) })
  const totals = await getSpendingByCategory({ data: toInsightFilters(context) })

  return {
    summary: "Category trend rows and total spend by category for the selected filters.",
    data: {
      months: [...new Set(trends.map((trend) => trend.month))],
      topCategories: totals.slice(0, 10),
      trendRows: trends.slice(-60),
    },
  }
}

async function getMerchantContext(context: ChatContext, merchantName?: string) {
  const name = merchantName ?? context.page.entityLabel
  if (!name) {
    return {
      summary: "No merchant is selected.",
      data: { merchantName: null, transactions: [], monthlySpend: [] },
    }
  }

  const detail = await getMerchantDetail({
    data: {
      merchantName: name,
      ...toInsightFilters(context),
    },
  })

  return {
    summary: `Merchant history for ${name}.`,
    data: {
      merchantName: name,
      transactions: detail.transactions.slice(0, 20),
      monthlySpend: detail.monthlySpend,
      totalSpend: detail.transactions.reduce((sum, tx) => sum + tx.amount, 0),
      transactionCount: detail.transactions.length,
    },
  }
}

async function getComparisonContext(context: ChatContext) {
  const data = await getYearOverYearComparison({ data: toInsightFilters(context) })

  return {
    summary: "Current-period versus prior-year monthly comparison.",
    data,
  }
}

const getCurrentPageContextDef = toolDefinition({
  name: "get_current_page_context",
  description: "Fetch the most relevant structured finance context for the current page and filters.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getDashboardContextDef = toolDefinition({
  name: "get_dashboard_context",
  description: "Fetch dashboard totals, spending categories, top merchants, and cash-flow context.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getTransactionsContextDef = toolDefinition({
  name: "get_transactions_context",
  description: "Fetch transaction totals and a sample of transactions for the current filters.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getRecurringContextDef = toolDefinition({
  name: "get_recurring_context",
  description: "Fetch recurring payments and their monthly-equivalent cost.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getBudgetsContextDef = toolDefinition({
  name: "get_budgets_context",
  description: "Fetch budget versus actual data for the month implied by the current page filters.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getCategoryTrendsContextDef = toolDefinition({
  name: "get_category_trends_context",
  description: "Fetch category trend rows and total category spend for the current filters.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getMerchantContextDef = toolDefinition({
  name: "get_merchant_context",
  description: "Fetch merchant spending history, recent transactions, and monthly totals. Use only when a merchant is explicitly in scope from the current page or the user clearly asks about a named merchant.",
  inputSchema: z.object({
    merchantName: z.string().optional().describe("Merchant name. Defaults to the merchant in the current page context when available."),
  }).optional().default({}),
  outputSchema: financeToolResultSchema,
})

const getComparisonContextDef = toolDefinition({
  name: "get_comparison_context",
  description: "Fetch current period and last-year monthly comparison data.",
  inputSchema: z.object({}).optional().default({}),
  outputSchema: financeToolResultSchema,
})

export function createFinanceTools(context: ChatContext, _scope: ChatScope) {
  const getCurrentPageContext = getCurrentPageContextDef.server(async () => {
    switch (context.page.kind) {
      case "dashboard":
        return getDashboardContext(context)
      case "transactions":
        return getTransactionsContext(context)
      case "budgets":
        return getBudgetsContext(context)
      case "recurring":
        return getRecurringContext()
      case "merchant-detail":
        return getMerchantContext(context)
      case "category-trends":
        return getCategoryTrendsContext(context)
      case "monthly-comparison":
        return getComparisonContext(context)
      case "unknown":
        return {
          summary: "Current page metadata only.",
          data: context,
        }
    }
  })

  const getDashboard = getDashboardContextDef.server(async () => getDashboardContext(context))
  const getTransactions = getTransactionsContextDef.server(async () => getTransactionsContext(context))
  const getRecurring = getRecurringContextDef.server(async () => getRecurringContext())
  const getBudgets = getBudgetsContextDef.server(async () => getBudgetsContext(context))
  const getCategoryTrends = getCategoryTrendsContextDef.server(async () => getCategoryTrendsContext(context))
  const getMerchant = getMerchantContextDef.server(async (input) => getMerchantContext(context, input?.merchantName))
  const getComparison = getComparisonContextDef.server(async () => getComparisonContext(context))

  const tools: Array<
    | typeof getCurrentPageContext
    | typeof getDashboard
    | typeof getTransactions
    | typeof getRecurring
    | typeof getBudgets
    | typeof getCategoryTrends
    | typeof getMerchant
    | typeof getComparison
  > = []
  tools.push(
    getCurrentPageContext,
    getDashboard,
    getTransactions,
    getRecurring,
    getBudgets,
    getCategoryTrends,
    getComparison,
  )

  if (context.page.kind === "merchant-detail" || context.page.entityLabel) {
    tools.push(getMerchant)
  }

  return tools
}
