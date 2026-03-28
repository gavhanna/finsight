import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories, accounts, settings } from "../../db/schema"
import { eq, and, gte, lte, inArray, sql, lt } from "drizzle-orm"
import { z } from "zod"
import { generateFinancialNarrative } from "../services/ollama.server"
import { getMedian, classifyInterval, toMonthlyEquiv, type Frequency } from "../../lib/recurring"
import { createHash } from "crypto"
import { narrativeCache } from "../../db/schema"

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

    const payee = sql<string>`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}, 'Unknown')`

    const rows = await db
      .select({
        payee,
        total: sql<number>`SUM(${transactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(payee)
      .orderBy(sql`SUM(${transactions.amount})`)
      .limit(filters.limit)

    return rows.map((r) => ({
      name: r.payee,
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
          income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
          expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`,
        })
        .from(transactions)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(monthExpr)
        .orderBy(monthExpr)

      return rows.map((r) => ({
        month: r.month,
        income: r.income ?? 0,
        expenses: Math.abs(r.expenses ?? 0),
        net: (r.income ?? 0) + (r.expenses ?? 0),
      }))
    }

    const [current, lastYear] = await Promise.all([
      fetchMonthly(currentFrom, currentTo),
      fetchMonthly(lastYearFrom, lastYearTo),
    ])

    console.log("[yoy] current period:", currentFrom, "→", currentTo, "rows:", current.length)
    console.log("[yoy] last year period:", lastYearFrom, "→", lastYearTo, "rows:", lastYear.length)

    return { current, lastYear }
  })

export const getAccounts = createServerFn().handler(async () => {
  return db.select().from(accounts)
})

export const generateNarrative = createServerFn()
  .inputValidator(z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    totalIncome: z.number(),
    totalExpenses: z.number(),
    net: z.number(),
    savingsRate: z.number().nullable(),
    topCategories: z.array(z.object({ name: z.string(), total: z.number() })),
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

export type RecurringItem = {
  payee: string
  frequency: Frequency
  medianInterval: number
  avgAmount: number
  amountRange: { min: number; max: number }
  monthlyEquiv: number
  annualCost: number
  lastSeen: string
  nextExpected: string
  daysSinceLastSeen: number
  isActive: boolean
  transactionCount: number
  categoryId: number | null
  categoryName: string
  categoryColor: string
}

export const getRecurringTransactions = createServerFn().handler(async (): Promise<RecurringItem[]> => {
  // Fetch all expense transactions ordered by date ascending
  const txns = await db
    .select({
      bookingDate: transactions.bookingDate,
      amount: transactions.amount,
      creditorName: transactions.creditorName,
      debtorName: transactions.debtorName,
      description: transactions.description,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(lt(transactions.amount, 0))
    .orderBy(transactions.bookingDate)

  // Group by normalised payee in application code
  const payeeMap = new Map<string, typeof txns>()
  for (const tx of txns) {
    const payee = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"
    if (payee === "Unknown") continue
    if (!payeeMap.has(payee)) payeeMap.set(payee, [])
    payeeMap.get(payee)!.push(tx)
  }

  const results: Omit<RecurringItem, "categoryName" | "categoryColor">[] = []

  for (const [payee, txList] of payeeMap) {
    if (txList.length < 3) continue

    const sorted = [...txList].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].bookingDate).getTime()
      const curr = new Date(sorted[i].bookingDate).getTime()
      intervals.push(Math.round((curr - prev) / 86_400_000))
    }

    const medianInterval = getMedian(intervals)
    const frequency = classifyInterval(medianInterval)
    if (!frequency) continue

    const amounts = txList.map((t) => Math.abs(t.amount))
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const minAmount = Math.min(...amounts)
    const maxAmount = Math.max(...amounts)
    const monthlyEquiv = toMonthlyEquiv(avgAmount, frequency)

    const lastTx = sorted[sorted.length - 1]
    const lastSeen = lastTx.bookingDate
    const nextExpected = new Date(new Date(lastSeen).getTime() + medianInterval * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const daysSinceLastSeen = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)

    results.push({
      payee,
      frequency,
      medianInterval,
      avgAmount,
      amountRange: { min: minAmount, max: maxAmount },
      monthlyEquiv,
      annualCost: monthlyEquiv * 12,
      lastSeen,
      nextExpected,
      daysSinceLastSeen,
      isActive: daysSinceLastSeen < medianInterval * 2,
      transactionCount: txList.length,
      categoryId: lastTx.categoryId,
    })
  }

  // Resolve category names and colours with a single second query
  const uniqueCatIds = [...new Set(results.map((r) => r.categoryId).filter((id): id is number => id !== null))]
  const catRows = uniqueCatIds.length > 0
    ? await db.select().from(categories).where(inArray(categories.id, uniqueCatIds))
    : []
  const catMap = new Map(catRows.map((c) => [c.id, c]))

  return results
    .map((r) => ({
      ...r,
      categoryName: r.categoryId ? (catMap.get(r.categoryId)?.name ?? "Uncategorised") : "Uncategorised",
      categoryColor: r.categoryId ? (catMap.get(r.categoryId)?.color ?? "#94a3b8") : "#94a3b8",
    }))
    .sort((a, b) => b.monthlyEquiv - a.monthlyEquiv)
})
