import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories } from "../../db/schema"
import { eq, and, gte, lte, inArray, sql, lt, or } from "drizzle-orm"
import { z } from "zod"
import { normalizeMerchantName } from "../../lib/merchant-utils"

const MerchantFilters = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
})

function buildConditions(filters: z.infer<typeof MerchantFilters>) {
  const conditions = []
  if (filters.dateFrom) conditions.push(gte(transactions.bookingDate, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.bookingDate, filters.dateTo))
  if (filters.accountIds?.length) {
    conditions.push(inArray(transactions.accountId, filters.accountIds))
  }
  return conditions
}

const payeeExpr = sql<string>`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown')`

export const getMerchantList = createServerFn()
  .inputValidator(MerchantFilters)
  .handler(async ({ data: filters }) => {
    const rows = await db
      .select({
        rawName: payeeExpr,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
        lastSeen: sql<string>`MAX(${transactions.bookingDate})`,
        firstSeen: sql<string>`MIN(${transactions.bookingDate})`,
      })
      .from(transactions)
      .where(and(...buildConditions(filters), lt(transactions.amount, 0)))
      .groupBy(payeeExpr)

    // Normalize raw names and re-aggregate by normalized name
    const map = new Map<string, {
      name: string
      total: number
      count: number
      lastSeen: string
      firstSeen: string
    }>()

    for (const row of rows) {
      const name = normalizeMerchantName(row.rawName)
      const total = Number(row.total)
      const count = Number(row.count)
      const existing = map.get(name)
      if (existing) {
        existing.total += total
        existing.count += count
        if (row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen
        if (row.firstSeen < existing.firstSeen) existing.firstSeen = row.firstSeen
      } else {
        map.set(name, { name, total, count, lastSeen: row.lastSeen, firstSeen: row.firstSeen })
      }
    }

    return Array.from(map.values())
      .map((m) => ({
        name: m.name,
        total: Math.abs(m.total),
        count: m.count,
        avgAmount: Math.abs(m.total) / m.count,
        lastSeen: m.lastSeen,
        firstSeen: m.firstSeen,
      }))
      .sort((a, b) => b.total - a.total)
  })

export const getMerchantDetail = createServerFn()
  .inputValidator(MerchantFilters.extend({ merchantName: z.string() }))
  .handler(async ({ data: { merchantName, ...filters } }) => {
    // Find all raw payee names that normalize to this merchant
    const allRaw = await db
      .selectDistinct({ raw: payeeExpr })
      .from(transactions)
      .where(lt(transactions.amount, 0))

    const matchingRaw = allRaw
      .map((r) => r.raw)
      .filter((n) => normalizeMerchantName(n) === merchantName)

    if (!matchingRaw.length) {
      return { transactions: [], monthlySpend: [] }
    }

    const nameCondition = or(
      ...matchingRaw.map((name) =>
        sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown') = ${name}`,
      ),
    )!

    const baseConditions = and(...buildConditions(filters), lt(transactions.amount, 0), nameCondition)

    const [txs, monthlyRows] = await Promise.all([
      db
        .select({
          id: transactions.id,
          bookingDate: transactions.bookingDate,
          amount: transactions.amount,
          currency: transactions.currency,
          description: transactions.description,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryColor: categories.color,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(baseConditions)
        .orderBy(sql`${transactions.bookingDate} DESC`),

      db
        .select({
          month: sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`,
          total: sql<number>`SUM(${transactions.amount})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(baseConditions)
        .groupBy(sql`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`)
        .orderBy(sql`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`),
    ])

    return {
      transactions: txs.map((t) => ({
        ...t,
        amount: Math.abs(t.amount),
        categoryName: t.categoryName ?? "Uncategorised",
        categoryColor: t.categoryColor ?? "#94a3b8",
      })),
      monthlySpend: monthlyRows.map((r) => ({
        month: r.month,
        total: Math.abs(Number(r.total)),
        count: Number(r.count),
      })),
    }
  })
