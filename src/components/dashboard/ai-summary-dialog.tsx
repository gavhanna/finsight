import { PageAiSummaryDialog } from "@/components/ai-summary-dialog"

type BudgetSummaryRow = {
  name: string
  budgeted: number
  spent: number
}

export function AiSummaryDialog({
  stats,
  byCat,
  topMerchants,
  incomeVsExp,
  budgets,
  periodDelta,
  dateFrom,
  dateTo,
  presetLabel,
  accountLabel,
  excludeRecurring,
  currency = "EUR",
}: {
  stats: { totalIncome: number; totalExpenses: number; net: number; count?: number | string }
  byCat: { categoryName: string; total: number }[]
  topMerchants: { name: string; total: number; count: number | string }[]
  incomeVsExp: { month: string; income: number; expenses: number; net: number }[]
  budgets: BudgetSummaryRow[]
  periodDelta: { income: number | null; expenses: number | null } | null
  dateFrom?: string
  dateTo?: string
  presetLabel: string
  accountLabel: string
  excludeRecurring: boolean
  currency?: string
}) {
  const savingsRate = stats.totalIncome > 0 ? (stats.net / stats.totalIncome) * 100 : null

  return (
    <PageAiSummaryDialog
      request={{
        pageTitle: "Dashboard",
        filters: {
          dateFrom,
          dateTo,
          presetLabel,
          accountLabel,
          excludeRecurringFromMerchants: excludeRecurring,
        },
        totalIncome: stats.totalIncome,
        totalExpenses: stats.totalExpenses,
        net: stats.net,
        transactionCount: stats.count ?? null,
        savingsRate,
        topCategories: byCat.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total })),
        topMerchants: topMerchants.slice(0, 5),
        cashFlow: incomeVsExp.slice(-6),
        budgets: budgets.slice(0, 5),
        periodDelta: periodDelta ?? null,
        currency,
      }}
    />
  )
}
