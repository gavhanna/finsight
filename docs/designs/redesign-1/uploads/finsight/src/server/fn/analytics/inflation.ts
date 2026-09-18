import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions, categories } from "../../../db/schema"
import { eq, and, gte, lte, lt, sql } from "drizzle-orm"

export const getInflationRate = createServerFn().handler(async () => {
  const today = new Date()
  const currentYear = today.getFullYear()
  const priorYear = currentYear - 1

  const currentFrom = `${currentYear}-01-01`
  const currentTo = today.toISOString().slice(0, 10)
  const priorFrom = `${priorYear}-01-01`
  const priorTo = `${priorYear}-12-31`

  async function fetchByCategory(dateFrom: string, dateTo: string) {
    return db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          lt(transactions.amount, 0),
          gte(transactions.bookingDate, dateFrom),
          lte(transactions.bookingDate, dateTo),
        ),
      )
      .groupBy(transactions.categoryId, categories.name, categories.color)
  }

  const [current, prior] = await Promise.all([
    fetchByCategory(currentFrom, currentTo),
    fetchByCategory(priorFrom, priorTo),
  ])

  const daysElapsed =
    Math.floor((today.getTime() - new Date(currentFrom).getTime()) / 86_400_000) + 1
  const annualisationFactor = 365 / daysElapsed

  const priorMap = new Map(prior.map((r) => [r.categoryId, r]))

  type CategoryInflation = {
    categoryId: number | null
    categoryName: string
    categoryColor: string
    priorTotal: number
    currentTotal: number
    currentAnnualised: number
    changePercent: number
  }

  const rows: CategoryInflation[] = []
  let weightedSum = 0
  let totalPriorWeight = 0

  for (const curr of current) {
    const prev = priorMap.get(curr.categoryId)
    if (!prev || prev.total === 0) continue
    const currentAnnualised = curr.total * annualisationFactor
    const changePercent = ((currentAnnualised - prev.total) / prev.total) * 100
    rows.push({
      categoryId: curr.categoryId,
      categoryName: curr.categoryName ?? "Uncategorised",
      categoryColor: curr.categoryColor ?? "#94a3b8",
      priorTotal: prev.total,
      currentTotal: curr.total,
      currentAnnualised,
      changePercent,
    })
    weightedSum += changePercent * prev.total
    totalPriorWeight += prev.total
  }

  const overallRate = totalPriorWeight > 0 ? weightedSum / totalPriorWeight : 0

  return {
    categories: rows.sort((a, b) => b.priorTotal - a.priorTotal),
    overallRate,
    currentYear,
    priorYear,
    daysElapsed,
  }
})

export type InflationData = Awaited<ReturnType<typeof getInflationRate>>
