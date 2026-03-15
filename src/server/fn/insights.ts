import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db"
import { transactions, categories, accounts } from "../../db/schema"
import { eq, and, gte, lte, inArray, sql, lt } from "drizzle-orm"
import { z } from "zod"

const InsightFilters = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
})

function buildConditions(filters: z.infer<typeof InsightFilters>) {
  const conditions = []
  if (filters.dateFrom) conditions.push(gte(transactions.bookingDate, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.bookingDate, filters.dateTo))
  if (filters.accountIds?.length) {
    conditions.push(inArray(transactions.accountId, filters.accountIds))
  }
  return conditions
}

// PostgreSQL month format
const monthExpr = sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`

export const getSpendingByCategory = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = [
      ...buildConditions(filters),
      lt(transactions.amount, 0),
    ]

    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(transactions.categoryId, categories.name, categories.color)
      .orderBy(sql`SUM(${transactions.amount})`)

    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "Uncategorised",
      categoryColor: r.categoryColor ?? "#94a3b8",
      total: Math.abs(r.total),
      count: r.count,
    }))
  })

export const getSpendingTrends = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = [
      ...buildConditions(filters),
      lt(transactions.amount, 0),
    ]

    const rows = await db
      .select({
        month: monthExpr,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(monthExpr, transactions.categoryId, categories.name, categories.color)
      .orderBy(monthExpr)

    return rows.map((r) => ({
      month: r.month,
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "Uncategorised",
      categoryColor: r.categoryColor ?? "#94a3b8",
      total: Math.abs(r.total),
    }))
  })

export const getTopMerchants = createServerFn()
  .inputValidator(InsightFilters.extend({ limit: z.number().default(10) }))
  .handler(async ({ data: filters }) => {
    const conditions = [
      ...buildConditions(filters),
      lt(transactions.amount, 0),
    ]

    const rows = await db
      .select({
        creditorName: transactions.creditorName,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(transactions.creditorName)
      .orderBy(sql`SUM(${transactions.amount})`)
      .limit(filters.limit)

    return rows
      .filter((r) => r.creditorName)
      .map((r) => ({
        name: r.creditorName!,
        total: Math.abs(r.total),
        count: r.count,
      }))
  })

export const getIncomeVsExpenses = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)

    const rows = await db
      .select({
        month: monthExpr,
        income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(monthExpr)
      .orderBy(monthExpr)

    return rows.map((r) => ({
      month: r.month,
      income: r.income,
      expenses: Math.abs(r.expenses),
      net: r.income + r.expenses,
    }))
  })

export const getSummaryStats = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)

    const rows = await db
      .select({
        totalIncome: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        totalExpenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(conditions.length ? and(...conditions) : undefined)

    const row = rows[0]
    return {
      totalIncome: row?.totalIncome ?? 0,
      totalExpenses: Math.abs(row?.totalExpenses ?? 0),
      net: (row?.totalIncome ?? 0) + (row?.totalExpenses ?? 0),
      count: row?.count ?? 0,
    }
  })

export const getAccounts = createServerFn().handler(async () => {
  return db.select().from(accounts)
})
