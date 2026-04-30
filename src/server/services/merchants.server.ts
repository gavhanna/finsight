import { and, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm"
import { db } from "../../db/index.server"
import { categories, transactions } from "../../db/schema"
import { normalizeMerchantName, resolveAlias } from "../../lib/merchant-utils"
import { loadAliasMap } from "./merchant-aliases.server"

export type MerchantFilters = {
  dateFrom?: string
  dateTo?: string
  accountIds?: string[]
}

export type MerchantSpendSummary = {
  name: string
  total: number
  count: number
  avgAmount: number
  lastSeen: string
  firstSeen: string
}

export type MerchantSpendDetail = {
  transactions: Array<{
    id: string
    bookingDate: string
    amount: number
    currency: string
    description: string | null
    categoryId: number | null
    categoryName: string
    categoryColor: string
  }>
  monthlySpend: Array<{
    month: string
    total: number
    count: number
  }>
}

const rawPayeeExpr = sql<string>`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown')`

function buildMerchantConditions(filters: MerchantFilters) {
  const conditions = []
  if (filters.dateFrom) conditions.push(gte(transactions.bookingDate, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.bookingDate, filters.dateTo))
  if (filters.accountIds?.length) {
    conditions.push(inArray(transactions.accountId, filters.accountIds))
  }
  return conditions
}

export async function getMerchantSpendList(
  filters: MerchantFilters,
): Promise<MerchantSpendSummary[]> {
  const [rows, aliases] = await Promise.all([
    db
      .select({
        rawName: rawPayeeExpr,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
        lastSeen: sql<string>`MAX(${transactions.bookingDate})`,
        firstSeen: sql<string>`MIN(${transactions.bookingDate})`,
      })
      .from(transactions)
      .where(and(...buildMerchantConditions(filters), lt(transactions.amount, 0)))
      .groupBy(rawPayeeExpr),
    loadAliasMap(),
  ])

  const byMerchant = new Map<
    string,
    {
      name: string
      total: number
      count: number
      lastSeen: string
      firstSeen: string
    }
  >()

  for (const row of rows) {
    const name = resolveAlias(normalizeMerchantName(row.rawName), aliases)
    const total = Number(row.total)
    const count = Number(row.count)
    const existing = byMerchant.get(name)
    if (existing) {
      existing.total += total
      existing.count += count
      if (row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen
      if (row.firstSeen < existing.firstSeen) existing.firstSeen = row.firstSeen
    } else {
      byMerchant.set(name, {
        name,
        total,
        count,
        lastSeen: row.lastSeen,
        firstSeen: row.firstSeen,
      })
    }
  }

  return Array.from(byMerchant.values())
    .map((merchant) => ({
      name: merchant.name,
      total: Math.abs(merchant.total),
      count: merchant.count,
      avgAmount: Math.abs(merchant.total) / merchant.count,
      lastSeen: merchant.lastSeen,
      firstSeen: merchant.firstSeen,
    }))
    .sort((a, b) => b.total - a.total)
}

export async function findRawPayeeNamesForMerchant(merchantName: string): Promise<string[]> {
  const [allRaw, aliases] = await Promise.all([
    db.selectDistinct({ raw: rawPayeeExpr }).from(transactions),
    loadAliasMap(),
  ])

  return allRaw
    .map((entry) => entry.raw)
    .filter((name) => resolveAlias(normalizeMerchantName(name), aliases) === merchantName)
}

export async function getMerchantSpendDetail(
  merchantName: string,
  filters: MerchantFilters,
): Promise<MerchantSpendDetail> {
  const matchingRaw = await findRawPayeeNamesForMerchant(merchantName)

  if (!matchingRaw.length) {
    return { transactions: [], monthlySpend: [] }
  }

  const nameCondition = or(
    ...matchingRaw.map((name) =>
      sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown') = ${name}`,
    ),
  )

  const baseConditions = and(
    ...buildMerchantConditions(filters),
    lt(transactions.amount, 0),
    nameCondition,
  )

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
    transactions: txs.map((transaction) => ({
      ...transaction,
      amount: Math.abs(transaction.amount),
      categoryName: transaction.categoryName ?? "Uncategorised",
      categoryColor: transaction.categoryColor ?? "#94a3b8",
    })),
    monthlySpend: monthlyRows.map((row) => ({
      month: row.month,
      total: Math.abs(Number(row.total)),
      count: Number(row.count),
    })),
  }
}
