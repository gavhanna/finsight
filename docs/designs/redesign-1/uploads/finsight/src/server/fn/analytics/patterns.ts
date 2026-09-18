import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions, categories } from "../../../db/schema"
import { eq, and, gte, lte, lt, sql } from "drizzle-orm"
import { z } from "zod"

export const getSpendingPatterns = createServerFn()
  .inputValidator(
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      categoryId: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const conditions = [lt(transactions.amount, 0)]
    if (data.dateFrom) conditions.push(gte(transactions.bookingDate, data.dateFrom))
    if (data.dateTo) conditions.push(lte(transactions.bookingDate, data.dateTo))
    if (data.categoryId != null) conditions.push(eq(transactions.categoryId, data.categoryId))

    const [dowRows, domRows, cats] = await Promise.all([
      db
        .select({
          dow: sql<number>`EXTRACT(DOW FROM ${transactions.bookingDate}::date)`,
          total: sql<number>`SUM(ABS(${transactions.amount}))`,
          count: sql<number>`COUNT(*)`,
          avg: sql<number>`AVG(ABS(${transactions.amount}))`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(sql`EXTRACT(DOW FROM ${transactions.bookingDate}::date)`)
        .orderBy(sql`EXTRACT(DOW FROM ${transactions.bookingDate}::date)`),
      db
        .select({
          dom: sql<number>`EXTRACT(DAY FROM ${transactions.bookingDate}::date)`,
          total: sql<number>`SUM(ABS(${transactions.amount}))`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...conditions))
        .groupBy(sql`EXTRACT(DAY FROM ${transactions.bookingDate}::date)`)
        .orderBy(sql`EXTRACT(DAY FROM ${transactions.bookingDate}::date)`),
      db
        .select({ id: categories.id, name: categories.name, color: categories.color })
        .from(categories)
        .where(eq(categories.type, "expense"))
        .orderBy(categories.name),
    ])

    // PostgreSQL DOW: 0=Sun…6=Sat → convert to Mon-first
    const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const dowData = DOW_LABELS.map((label, i) => {
      const pgDow = (i + 1) % 7
      const row = dowRows.find((r) => Math.round(r.dow) === pgDow)
      return { day: label, total: row?.total ?? 0, count: row?.count ?? 0, avg: row?.avg ?? 0 }
    })

    const domData = Array.from({ length: 31 }, (_, i) => {
      const dom = i + 1
      const row = domRows.find((r) => Math.round(r.dom) === dom)
      return { day: dom, total: row?.total ?? 0, count: row?.count ?? 0 }
    })

    return { dowData, domData, categories: cats }
  })

export type PatternsData = Awaited<ReturnType<typeof getSpendingPatterns>>
