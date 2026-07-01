import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions, categories } from "../../../db/schema"
import { and, lt, gte, lte, sql } from "drizzle-orm"
import { z } from "zod"
import { fetchRecurringItems } from "../../services/recurring.server"

export const getDiscretionarySpending = createServerFn()
  .inputValidator(
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      activeOnly: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: filters }) => {
    const recurringItems = await fetchRecurringItems(filters.activeOnly)
    const recurringPayees = recurringItems.map((r) => r.payee)

    const conditions = [lt(transactions.amount, 0)] as ReturnType<typeof lt>[]
    if (filters.dateFrom) conditions.push(gte(transactions.bookingDate, filters.dateFrom))
    if (filters.dateTo) conditions.push(lte(transactions.bookingDate, filters.dateTo))
    if (recurringPayees.length > 0) {
      conditions.push(
        sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}) NOT IN (${sql.join(recurringPayees.map((p) => sql`${p}`), sql`, `)})` as any,
      )
    }

    const payeeExpr = sql<string>`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown')`

    const [byCategory, topMerchants, daily] = await Promise.all([
      db
        .select({
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryColor: categories.color,
          total: sql<number>`SUM(ABS(${transactions.amount}))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .leftJoin(categories, sql`${categories.id} = ${transactions.categoryId}`)
        .where(and(...conditions))
        .groupBy(transactions.categoryId, categories.name, categories.color)
        .orderBy(sql`SUM(ABS(${transactions.amount})) DESC`),

      db
        .select({
          payee: payeeExpr,
          total: sql<number>`SUM(ABS(${transactions.amount}))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(payeeExpr)
        .orderBy(sql`SUM(ABS(${transactions.amount})) DESC`)
        .limit(8),

      db
        .select({
          date: transactions.bookingDate,
          total: sql<number>`SUM(ABS(${transactions.amount}))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(transactions.bookingDate)
        .orderBy(transactions.bookingDate),
    ])

    const total = byCategory.reduce((s, r) => s + r.total, 0)
    const txCount = byCategory.reduce((s, r) => s + Number(r.count), 0)

    const days =
      filters.dateFrom && filters.dateTo
        ? Math.max(
            1,
            Math.round(
              (new Date(filters.dateTo).getTime() - new Date(filters.dateFrom).getTime()) /
                86_400_000,
            ) + 1,
          )
        : 1

    return {
      total,
      avgPerDay: total / days,
      transactionCount: txCount,
      excludedPayeeCount: recurringPayees.length,
      byCategory: byCategory.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? "Uncategorised",
        categoryColor: r.categoryColor ?? "#94a3b8",
        total: r.total,
        count: Number(r.count),
      })),
      topMerchants: topMerchants.map((r) => ({
        name: r.payee,
        total: r.total,
        count: Number(r.count),
      })),
      daily: daily.map((r) => ({
        date: r.date,
        total: r.total,
        count: Number(r.count),
      })),
    }
  })

export type DiscretionaryData = Awaited<ReturnType<typeof getDiscretionarySpending>>
