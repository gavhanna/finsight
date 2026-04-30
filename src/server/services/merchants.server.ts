import { and, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm"
import { db } from "../../db/index.server"
import { categories, transactions } from "../../db/schema"
import { normalizeMerchantName, resolveAlias } from "../../lib/merchant-utils"
import { classifyInterval, getMedian, toMonthlyEquiv } from "../../lib/recurring"
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

export type MerchantTransactionContext = {
  merchant: {
    canonicalName: string
    transactionCount: number
    totalSpend: number
    averageSpend: number
    firstSeen: string | null
    lastSeen: string | null
    recentTransactions: Array<{
      id: string
      bookingDate: string
      amount: number
      currency: string
      description: string | null
      categoryName: string
      categoryColor: string
    }>
    monthlySpend: Array<{
      month: string
      total: number
      count: number
    }>
  }
  merchantContext: {
    recurring: {
      frequency: string
      averageAmount: number
      monthlyEquivalent: number
      nextExpected: string
      lastSeen: string
      transactionCount: number
      isActive: boolean
    } | null
    spendingPattern: {
      averageHistoricalAmount: number
      ratioToAverage: number
      priorTransactionCount: number
      isUnusuallyLarge: boolean
    } | null
  }
}

type PayeeFields = {
  creditorName?: string | null
  debtorName?: string | null
  description?: string | null
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

function rawPayeeCondition(rawName: string) {
  return sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown') = ${rawName}`
}

function rawPayeeConditionAny(rawNames: string[]) {
  if (rawNames.length === 1) return rawPayeeCondition(rawNames[0])
  return or(...rawNames.map(rawPayeeCondition))
}

function rawPayeeFromFields(row: PayeeFields) {
  return row.creditorName ?? row.debtorName ?? row.description ?? ""
}

export async function canonicalMerchantName(rawPayee: string): Promise<string> {
  const aliases = await loadAliasMap()
  return resolveAlias(normalizeMerchantName(rawPayee), aliases)
}

export async function excludeCanonicalMerchants<T extends PayeeFields>(
  rows: T[],
  excludedMerchantNames: Set<string>,
): Promise<T[]> {
  const aliases = await loadAliasMap()
  return rows.filter((row) => {
    const rawPayee = rawPayeeFromFields(row)
    if (!rawPayee) return true
    const merchantName = resolveAlias(normalizeMerchantName(rawPayee), aliases)
    return !excludedMerchantNames.has(merchantName)
  })
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

export async function getTopMerchantSpend(
  filters: MerchantFilters & {
    limit: number
    excludeMerchantNames?: Set<string>
  },
) {
  const merchants = await getMerchantSpendList(filters)
  const filtered = filters.excludeMerchantNames
    ? merchants.filter((merchant) => !filters.excludeMerchantNames!.has(merchant.name))
    : merchants

  return filtered.slice(0, filters.limit).map((merchant) => ({
    name: merchant.name,
    total: merchant.total,
    count: merchant.count,
  }))
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

export async function getHistoricalMerchantExpenseAmounts(
  rawPayee: string,
  options: {
    dateFrom?: string
    beforeDate?: string
  } = {},
): Promise<number[]> {
  const merchantName = await canonicalMerchantName(rawPayee)
  const matchingRaw = await findRawPayeeNamesForMerchant(merchantName)
  if (!matchingRaw.length) return []

  const conditions = [lt(transactions.amount, 0), rawPayeeConditionAny(matchingRaw)]
  if (options.dateFrom) conditions.push(gte(transactions.bookingDate, options.dateFrom))
  if (options.beforeDate) conditions.push(lt(transactions.bookingDate, options.beforeDate))

  const rows = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(and(...conditions))

  return rows.map((row) => Math.abs(row.amount))
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

export async function getMerchantContextForTransaction(input: {
  rawPayee: string
  bookingDate: string
  amount: number
}): Promise<MerchantTransactionContext | null> {
  const canonicalName = await canonicalMerchantName(input.rawPayee)
  const matchingRaw = await findRawPayeeNamesForMerchant(canonicalName)
  if (!matchingRaw.length) return null

  const nameCondition = rawPayeeConditionAny(matchingRaw)
  const ninetyDaysAgo = new Date(`${input.bookingDate}T00:00:00Z`)
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90)
  const historyWindowStart = ninetyDaysAgo.toISOString().slice(0, 10)

  const [statsRows, recentRows, monthlyRows, timelineRows, historicalRows] = await Promise.all([
    db
      .select({
        count: sql<number>`COUNT(*)`,
        totalSpend: sql<number>`SUM(ABS(${transactions.amount}))`,
        averageSpend: sql<number>`AVG(ABS(${transactions.amount}))`,
        firstSeen: sql<string>`MIN(${transactions.bookingDate})`,
        lastSeen: sql<string>`MAX(${transactions.bookingDate})`,
      })
      .from(transactions)
      .where(and(lt(transactions.amount, 0), nameCondition)),
    db
      .select({
        id: transactions.id,
        bookingDate: transactions.bookingDate,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(lt(transactions.amount, 0), nameCondition))
      .orderBy(desc(transactions.bookingDate), desc(transactions.id))
      .limit(6),
    db
      .select({
        month: sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`,
        total: sql<number>`SUM(ABS(${transactions.amount}))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(lt(transactions.amount, 0), nameCondition))
      .groupBy(sql`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`),
    db
      .select({
        bookingDate: transactions.bookingDate,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(and(lt(transactions.amount, 0), nameCondition))
      .orderBy(transactions.bookingDate),
    db
      .select({
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          lt(transactions.amount, 0),
          nameCondition,
          gte(transactions.bookingDate, historyWindowStart),
          lt(transactions.bookingDate, input.bookingDate),
        ),
      ),
  ])

  const stats = statsRows[0]
  const sortedTimeline = timelineRows
    .map((entry) => ({
      bookingDate: entry.bookingDate,
      amount: Math.abs(entry.amount),
    }))
    .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
  const intervals = sortedTimeline.slice(1).map((entry, index) => {
    const prev = new Date(`${sortedTimeline[index].bookingDate}T00:00:00Z`).getTime()
    const curr = new Date(`${entry.bookingDate}T00:00:00Z`).getTime()
    return Math.round((curr - prev) / 86_400_000)
  })
  const medianInterval = getMedian(intervals)
  const frequency = classifyInterval(medianInterval)
  const recurringAverage =
    sortedTimeline.length > 0
      ? sortedTimeline.reduce((sum, entry) => sum + entry.amount, 0) / sortedTimeline.length
      : 0
  const lastSeen = sortedTimeline[sortedTimeline.length - 1]?.bookingDate ?? null
  const nextExpected =
    lastSeen && medianInterval > 0
      ? new Date(new Date(`${lastSeen}T00:00:00Z`).getTime() + medianInterval * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : null
  const daysSinceLastSeen =
    lastSeen
      ? Math.floor((Date.now() - new Date(`${lastSeen}T00:00:00Z`).getTime()) / 86_400_000)
      : null
  const historicalAmounts = historicalRows.map((entry) => Math.abs(entry.amount))
  const averageHistoricalAmount =
    historicalAmounts.length > 0
      ? historicalAmounts.reduce((sum, amount) => sum + amount, 0) / historicalAmounts.length
      : 0
  const ratioToAverage =
    averageHistoricalAmount > 0 ? Math.abs(input.amount) / averageHistoricalAmount : 0

  return {
    merchant: {
      canonicalName,
      transactionCount: Number(stats?.count ?? 0),
      totalSpend: Number(stats?.totalSpend ?? 0),
      averageSpend: Number(stats?.averageSpend ?? 0),
      firstSeen: stats?.firstSeen ?? null,
      lastSeen: stats?.lastSeen ?? null,
      recentTransactions: recentRows.map((transaction) => ({
        id: transaction.id,
        bookingDate: transaction.bookingDate,
        amount: Math.abs(transaction.amount),
        currency: transaction.currency,
        description: transaction.description,
        categoryName: transaction.categoryName ?? "Uncategorised",
        categoryColor: transaction.categoryColor ?? "#94a3b8",
      })),
      monthlySpend: monthlyRows.map((row) => ({
        month: row.month,
        total: Number(row.total),
        count: Number(row.count),
      })),
    },
    merchantContext: {
      recurring:
        frequency && lastSeen && nextExpected && daysSinceLastSeen !== null
          ? {
              frequency,
              averageAmount: recurringAverage,
              monthlyEquivalent: toMonthlyEquiv(recurringAverage, frequency),
              nextExpected,
              lastSeen,
              transactionCount: sortedTimeline.length,
              isActive: daysSinceLastSeen < medianInterval * 2,
            }
          : null,
      spendingPattern:
        historicalAmounts.length >= 2
          ? {
              averageHistoricalAmount,
              ratioToAverage,
              priorTransactionCount: historicalAmounts.length,
              isUnusuallyLarge: ratioToAverage > 2,
            }
          : null,
    },
  }
}
