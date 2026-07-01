import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions, categories } from "../../../db/schema"
import { eq, and, lt, gte, sql } from "drizzle-orm"
import { fetchRecurringItems } from "../../services/recurring.server"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

const monthExpr = sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`

export const getSpendingForecast = createServerFn().handler(async () => {
  const today = new Date()

  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
  const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${pad(threeMonthsAgo.getMonth() + 1)}-01`

  const [activeRecurring, variableRows] = await Promise.all([
    fetchRecurringItems(true),
    db
      .select({
        month: monthExpr,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(lt(transactions.amount, 0), gte(transactions.bookingDate, threeMonthsAgoStr)),
      )
      .groupBy(monthExpr, transactions.categoryId, categories.name, categories.color)
      .orderBy(monthExpr),
  ])

  const fixedTotal = activeRecurring.reduce((s, r) => s + r.monthlyEquiv, 0)
  const recurringCategoryIds = new Set(
    activeRecurring.map((r) => r.categoryId).filter((id): id is number => id !== null),
  )

  const byCat = new Map<
    number | null,
    { name: string; color: string; monthTotals: Map<string, number> }
  >()
  for (const row of variableRows) {
    if (recurringCategoryIds.has(row.categoryId as number)) continue
    if (!byCat.has(row.categoryId)) {
      byCat.set(row.categoryId, {
        name: row.categoryName ?? "Uncategorised",
        color: row.categoryColor ?? "#94a3b8",
        monthTotals: new Map(),
      })
    }
    const existing = byCat.get(row.categoryId)!.monthTotals.get(row.month) ?? 0
    byCat.get(row.categoryId)!.monthTotals.set(row.month, existing + row.total)
  }

  const variableCategories = Array.from(byCat.entries())
    .map(([categoryId, { name, color, monthTotals }]) => {
      const totals = Array.from(monthTotals.values())
      const avg = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / 3 : 0
      const variance =
        totals.length > 1
          ? Math.sqrt(
              totals.map((t) => Math.pow(t - avg, 2)).reduce((s, v) => s + v, 0) / totals.length,
            )
          : 0
      return { categoryId, categoryName: name, categoryColor: color, forecastAmount: avg, variance }
    })
    .filter((r) => r.forecastAmount > 0)
    .sort((a, b) => b.forecastAmount - a.forecastAmount)

  const variableTotal = variableCategories.reduce((s, c) => s + c.forecastAmount, 0)
  const totalVariance = variableCategories.reduce((s, c) => s + c.variance, 0)

  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nextMonthLabel = nextMonthDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  return {
    fixedTotal,
    variableTotal,
    grandTotal: fixedTotal + variableTotal,
    variableCategories,
    topRecurring: activeRecurring
      .sort((a, b) => b.monthlyEquiv - a.monthlyEquiv)
      .slice(0, 8)
      .map((r) => ({ payee: r.payee, monthlyEquiv: r.monthlyEquiv, categoryId: r.categoryId })),
    totalVariance,
    nextMonthLabel,
  }
})

export type ForecastData = Awaited<ReturnType<typeof getSpendingForecast>>
