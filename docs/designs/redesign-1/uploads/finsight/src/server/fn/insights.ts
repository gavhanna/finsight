import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories, accounts, settings, balanceHistory } from "../../db/schema"
import { eq, and, gte, lte, inArray, sql, lt } from "drizzle-orm"
import { z } from "zod"
import { generateFinancialNarrative } from "../services/ollama.server"
import { createHash } from "crypto"
import { narrativeCache } from "../../db/schema"
import {
  fetchRecurringItems,
  fetchRecurringItemsWithCategories,
  type RecurringItem,
} from "../services/recurring.server"
import { getTopMerchantSpend } from "../services/merchants.server"

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
  .inputValidator(InsightFilters.extend({ limit: z.number().default(10), excludeRecurring: z.boolean().default(false) }))
  .handler(async ({ data: filters }) => {
    const recurringItems = filters.excludeRecurring ? await fetchRecurringItems(true) : []
    return getTopMerchantSpend({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      accountIds: filters.accountIds,
      limit: filters.limit,
      excludeMerchantNames: new Set(recurringItems.map((item) => item.payee)),
    })
  })

export const getIncomeVsExpenses = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)

    const rows = await db
      .select({
        month: monthExpr,
        income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 AND ${categories.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
        moneyIn: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(monthExpr)
      .orderBy(monthExpr)

    return rows.map((r) => ({
      month: r.month,
      income: r.income ?? 0,
      moneyIn: r.moneyIn ?? 0,
      expenses: Math.abs(r.expenses),
      net: (r.moneyIn ?? 0) + r.expenses,
    }))
  })

export const getSummaryStats = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)

    const rows = await db
      .select({
        totalIncome: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 AND ${categories.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
        totalMoneyIn: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        totalExpenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(conditions.length ? and(...conditions) : undefined)

    const row = rows[0]
    return {
      totalIncome: row?.totalIncome ?? 0,
      totalMoneyIn: row?.totalMoneyIn ?? 0,
      totalExpenses: Math.abs(row?.totalExpenses ?? 0),
      net: (row?.totalMoneyIn ?? 0) + (row?.totalExpenses ?? 0),
      count: Number(row?.count ?? 0),
    }
  })

export const getYearOverYearComparison = createServerFn()
  .inputValidator(InsightFilters)
  .handler(async ({ data: filters }) => {
    const today = new Date()

    // When no date range given (all time), default to current calendar year vs last
    let currentFrom = filters.dateFrom
    let currentTo = filters.dateTo
    if (!currentFrom && !currentTo) {
      currentFrom = `${today.getFullYear()}-01-01`
      currentTo = today.toISOString().slice(0, 10)
    }

    function shiftOneYear(dateStr: string, direction: -1 | 1): string {
      const d = new Date(dateStr)
      d.setFullYear(d.getFullYear() + direction)
      return d.toISOString().slice(0, 10)
    }

    const lastYearFrom = currentFrom ? shiftOneYear(currentFrom, -1) : undefined
    const lastYearTo = currentTo ? shiftOneYear(currentTo, -1) : undefined

    async function fetchMonthly(dateFrom?: string, dateTo?: string) {
      const conditions = buildConditions({ dateFrom, dateTo, accountIds: filters.accountIds })
      const rows = await db
        .select({
          month: monthExpr,
          income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 AND ${categories.type} = 'income' THEN ${transactions.amount} ELSE 0 END)`,
          moneyIn: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
          expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(monthExpr)
        .orderBy(monthExpr)

      return rows.map((r) => ({
        month: r.month,
        income: r.income ?? 0,
        moneyIn: r.moneyIn ?? 0,
        expenses: Math.abs(r.expenses ?? 0),
        net: (r.moneyIn ?? 0) + (r.expenses ?? 0),
      }))
    }

    const [current, lastYear] = await Promise.all([
      fetchMonthly(currentFrom, currentTo),
      fetchMonthly(lastYearFrom, lastYearTo),
    ])

    return { current, lastYear }
  })

export const getAccounts = createServerFn().handler(async () => {
  return db.select().from(accounts)
})

export const getTotalBalance = createServerFn().handler(async () => {
  const allAccounts = await db.select().from(accounts)
  const balanceMap = new Map<string, number>()
  for (const acc of allAccounts) {
    if (acc.balance != null && acc.balanceCurrency != null) {
      const current = balanceMap.get(acc.balanceCurrency) ?? 0
      balanceMap.set(acc.balanceCurrency, current + acc.balance)
    }
  }
  return { balances: Object.fromEntries(balanceMap), hasData: allAccounts.some(a => a.balance != null) }
})

export const getBalanceHistory = createServerFn()
  .inputValidator(z.object({
    days: z.number().default(90),
    currency: z.string().default("EUR"),
  }))
  .handler(async ({ data: { days, currency } }) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const history = await db
      .select()
      .from(balanceHistory)
      .where(
        and(
          eq(balanceHistory.currency, currency),
          gte(balanceHistory.recordedAt, cutoffDate)
        )
      )
      .orderBy(balanceHistory.recordedAt)

    // Get the latest balance per account for each day
    // Since history is ordered by recordedAt ascending, later records will overwrite earlier ones.
    const latestBalancesPerAccount = new Map<string, number>()
    for (const record of history) {
      const dateKey = new Date(record.recordedAt).toISOString().slice(0, 10)
      const key = `${dateKey}|${record.accountId}`
      latestBalancesPerAccount.set(key, record.balance)
    }

    // Sum across all accounts for each day
    const dailyTotals = new Map<string, number>()
    for (const [key, balance] of latestBalancesPerAccount.entries()) {
      const [dateKey] = key.split("|")
      const current = dailyTotals.get(dateKey) ?? 0
      dailyTotals.set(dateKey, current + balance)
    }

    return Array.from(dailyTotals.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
  })

export const generateNarrative = createServerFn()
  .inputValidator(z.object({
    kind: z.enum([
      "dashboard",
      "transactions",
      "budgets",
      "recurring",
      "merchant-detail",
      "category-trends",
      "monthly-comparison",
    ]),
    pageTitle: z.string().optional(),
    filters: z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      presetLabel: z.string().optional(),
      accountLabel: z.string().optional(),
      excludeRecurringFromMerchants: z.boolean().optional(),
    }).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    totalIncome: z.number(),
    totalExpenses: z.number(),
    net: z.number(),
    transactionCount: z.coerce.number().nullable().optional(),
    savingsRate: z.number().nullable(),
    topCategories: z.array(z.object({ name: z.string(), total: z.number() })),
    topMerchants: z.array(z.object({
      name: z.string(),
      total: z.number(),
      count: z.coerce.number(),
    })).optional(),
    cashFlow: z.array(z.object({
      month: z.string(),
      income: z.number(),
      expenses: z.number(),
      net: z.number(),
    })).optional(),
    budgets: z.array(z.object({
      name: z.string(),
      budgeted: z.number(),
      spent: z.number(),
    })).optional(),
    contextSections: z.array(z.object({
      title: z.string(),
      lines: z.array(z.string()),
    })).optional(),
    periodDelta: z.object({
      income: z.number().nullable(),
      expenses: z.number().nullable(),
    }).nullable(),
    currency: z.string().default("EUR"),
    force: z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const { force, ...cacheInputs } = data
    const cacheKey = createHash("sha256").update(JSON.stringify(cacheInputs)).digest("hex")

    if (!force) {
      const cached = await db.select().from(narrativeCache).where(eq(narrativeCache.key, cacheKey)).limit(1)
      if (cached.length > 0) return { narrative: cached[0].narrative, error: null, cached: true }
    }

    const settingRows = await db.select().from(settings)
    const settingMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]))
    const ollamaUrl = settingMap["ollama_url"]
    const ollamaModel = settingMap["ollama_model"] ?? "llama3"

    if (!ollamaUrl) return { narrative: null, error: "Ollama is not configured. Add a URL in Settings.", cached: false }

    const narrative = await generateFinancialNarrative(data, ollamaUrl, ollamaModel)
    if (!narrative) return { narrative: null, error: "Ollama did not return a response. Check that it is running.", cached: false }

    await db.insert(narrativeCache).values({ key: cacheKey, narrative })
      .onConflictDoUpdate({ target: narrativeCache.key, set: { narrative, createdAt: sql`now()` } })

    return { narrative, error: null, cached: false }
  })

export type { RecurringItem }

export const getRecurringTransactions = createServerFn().handler(async (): Promise<RecurringItem[]> => {
  return fetchRecurringItemsWithCategories(false)
})
