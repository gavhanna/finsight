import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions } from "../../../db/schema"
import { and, gte, lte, sql } from "drizzle-orm"
import { fetchRecurringItems } from "../../services/recurring.server"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

export const getMonthlyFinanceScore = createServerFn().handler(async () => {
  const today = new Date()
  const currentMonthFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const currentMonthTo = today.toISOString().slice(0, 10)

  const priorMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const priorMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const priorMonthFrom = `${priorMonthDate.getFullYear()}-${pad(priorMonthDate.getMonth() + 1)}-01`
  const priorMonthTo = `${priorMonthDate.getFullYear()}-${pad(priorMonthDate.getMonth() + 1)}-${pad(priorMonthLastDay)}`

  async function getMonthSummary(dateFrom: string, dateTo: string) {
    const rows = await db
      .select({
        income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`,
      })
      .from(transactions)
      .where(and(gte(transactions.bookingDate, dateFrom), lte(transactions.bookingDate, dateTo)))
    return rows[0] ?? { income: 0, expenses: 0 }
  }

  const [currentMonth, priorMonth, activeRecurring] = await Promise.all([
    getMonthSummary(currentMonthFrom, currentMonthTo),
    getMonthSummary(priorMonthFrom, priorMonthTo),
    fetchRecurringItems(true),
  ])

  // Savings Rate Score (40%) — 20% savings rate = 100 score
  const savingsRate =
    currentMonth.income > 0
      ? ((currentMonth.income - currentMonth.expenses) / currentMonth.income) * 100
      : 0
  const savingsScore = Math.max(0, Math.min(100, (savingsRate / 20) * 100))

  // Budget Adherence Score (35%) — prior month as implicit budget
  let adherenceScore = 75
  if (priorMonth.expenses > 0 && currentMonth.expenses > 0) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysElapsed = today.getDate()
    const scaledCurrentExpenses = currentMonth.expenses * (daysInMonth / daysElapsed)
    const overspendRatio = Math.max(
      0,
      (scaledCurrentExpenses - priorMonth.expenses) / priorMonth.expenses,
    )
    adherenceScore = Math.max(0, Math.min(100, (1 - overspendRatio) * 100))
  }

  // Recurring Cost Trend Score (25%) — stable/decreasing is good
  const currentRecurringTotal = activeRecurring.reduce((s, r) => s + r.monthlyEquiv, 0)
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10)
  const establishedRecurring = activeRecurring.filter(
    (r) => r.transactionCount >= 4 || r.lastSeen <= ninetyDaysAgoStr,
  )
  const priorRecurringTotal = establishedRecurring.reduce((s, r) => s + r.monthlyEquiv, 0)

  let recurringScore = 75
  if (priorRecurringTotal > 0) {
    const changePct =
      ((currentRecurringTotal - priorRecurringTotal) / priorRecurringTotal) * 100
    recurringScore = Math.max(0, Math.min(100, 50 - changePct * 5))
  }

  const totalScore = Math.round(
    0.4 * savingsScore + 0.35 * adherenceScore + 0.25 * recurringScore,
  )

  return {
    score: totalScore,
    savingsScore: Math.round(savingsScore),
    adherenceScore: Math.round(adherenceScore),
    recurringScore: Math.round(recurringScore),
    savingsRate,
    currentExpenses: currentMonth.expenses,
    currentIncome: currentMonth.income,
    monthLabel: today.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  }
})

export type FinanceScore = Awaited<ReturnType<typeof getMonthlyFinanceScore>>
