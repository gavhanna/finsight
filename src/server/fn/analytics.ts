import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories } from "../../db/schema"
import { eq, and, gte, lte, lt, sql, inArray } from "drizzle-orm"
import { z } from "zod"
import { getMedian, classifyInterval, toMonthlyEquiv } from "../../lib/recurring"

const monthExpr = sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`

function pad(n: number) {
  return String(n).padStart(2, "0")
}

// ─── Shared: fetch recurring items inline (avoids cross-server-fn calls) ────

async function fetchRecurringItems(activeOnly = true) {
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

  const payeeMap = new Map<string, typeof txns>()
  for (const tx of txns) {
    const payee = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"
    if (payee === "Unknown") continue
    if (!payeeMap.has(payee)) payeeMap.set(payee, [])
    payeeMap.get(payee)!.push(tx)
  }

  const results: Array<{
    payee: string
    monthlyEquiv: number
    annualCost: number
    avgAmount: number
    medianInterval: number
    lastSeen: string
    nextExpected: string
    daysSinceLastSeen: number
    isActive: boolean
    transactionCount: number
    categoryId: number | null
  }> = []

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
    const monthlyEquiv = toMonthlyEquiv(avgAmount, frequency)
    const lastTx = sorted[sorted.length - 1]
    const lastSeen = lastTx.bookingDate
    const nextExpected = new Date(new Date(lastSeen).getTime() + medianInterval * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const daysSinceLastSeen = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)
    results.push({
      payee,
      monthlyEquiv,
      annualCost: monthlyEquiv * 12,
      avgAmount,
      medianInterval,
      lastSeen,
      nextExpected,
      daysSinceLastSeen,
      isActive: daysSinceLastSeen < medianInterval * 2,
      transactionCount: txList.length,
      categoryId: lastTx.categoryId,
    })
  }

  return activeOnly ? results.filter((r) => r.isActive) : results
}

async function fetchActiveRecurring() {
  return fetchRecurringItems(true)
}

// ─── Savings Rate History ────────────────────────────────────────────────────

export const getSavingsRateHistory = createServerFn().handler(async () => {
  const rows = await db
    .select({
      month: monthExpr,
      income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
      expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`,
    })
    .from(transactions)
    .groupBy(monthExpr)
    .orderBy(monthExpr)

  const withRate = rows
    .filter((r) => r.income > 0)
    .map((r) => {
      const net = r.income - r.expenses
      const savingsRate = (net / r.income) * 100
      return { month: r.month, income: r.income, expenses: r.expenses, net, savingsRate }
    })

  // 3-month rolling average
  return withRate.map((row, i, arr) => {
    const window = arr.slice(Math.max(0, i - 2), i + 1)
    const rollingAvg = window.reduce((s, r) => s + r.savingsRate, 0) / window.length
    return { ...row, rollingAvg }
  })
})

export type SavingsRateRow = Awaited<ReturnType<typeof getSavingsRateHistory>>[number]

// ─── Personal Inflation Rate ─────────────────────────────────────────────────

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

  // Annualise current year totals based on days elapsed
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

// ─── Spending Forecast ───────────────────────────────────────────────────────

export const getSpendingForecast = createServerFn().handler(async () => {
  const today = new Date()

  // Last 3 calendar months start
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
  const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${pad(threeMonthsAgo.getMonth() + 1)}-01`

  const [activeRecurring, variableRows] = await Promise.all([
    fetchActiveRecurring(),
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

  // Rolling 3-month average per non-recurring category
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

// ─── Cash Flow Calendar ──────────────────────────────────────────────────────

export const getCashFlowCalendar = createServerFn()
  .inputValidator(z.object({ year: z.number(), month: z.number() }))
  .handler(async ({ data: { year, month } }) => {
    const monthFrom = `${year}-${pad(month)}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthTo = `${year}-${pad(month)}-${pad(lastDay)}`

    const [dailyRows, activeRecurring] = await Promise.all([
      db
        .select({
          date: transactions.bookingDate,
          income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
          expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(gte(transactions.bookingDate, monthFrom), lte(transactions.bookingDate, monthTo)))
        .groupBy(transactions.bookingDate)
        .orderBy(transactions.bookingDate),
      fetchActiveRecurring(),
    ])

    const dailyMap = new Map(dailyRows.map((r) => [r.date, r]))

    // Build expected events that fall in this month
    const expectedByDate = new Map<string, Array<{ payee: string; amount: number }>>()
    for (const item of activeRecurring) {
      const next = new Date(item.nextExpected)
      if (next.getFullYear() === year && next.getMonth() + 1 === month) {
        const dateStr = `${year}-${pad(month)}-${pad(next.getDate())}`
        if (!expectedByDate.has(dateStr)) expectedByDate.set(dateStr, [])
        expectedByDate.get(dateStr)!.push({ payee: item.payee, amount: item.avgAmount })
      }
    }

    // First day-of-week offset (Mon=0 … Sun=6)
    const firstDow = new Date(year, month - 1, 1).getDay()
    const startOffset = (firstDow + 6) % 7

    const days = Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${pad(month)}-${pad(d)}`
      const actual = dailyMap.get(dateStr)
      return {
        date: dateStr,
        dayOfMonth: d,
        income: actual?.income ?? 0,
        expenses: actual?.expenses ?? 0,
        count: actual?.count ?? 0,
        expectedDebits: expectedByDate.get(dateStr) ?? [],
      }
    })

    return { days, startOffset, year, month }
  })

export type CalendarData = Awaited<ReturnType<typeof getCashFlowCalendar>>

// ─── Spending Patterns ───────────────────────────────────────────────────────

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

    // PostgreSQL DOW: 0=Sun…6=Sat → convert to Mon-first (Mon=0…Sun=6)
    const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const dowData = DOW_LABELS.map((label, i) => {
      const pgDow = (i + 1) % 7 // Mon→1, Tue→2…Sun→0
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

// ─── Monthly Finance Score ───────────────────────────────────────────────────

export const getMonthlyFinanceScore = createServerFn().handler(async () => {
  const today = new Date()
  const currentMonthFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const currentMonthTo = today.toISOString().slice(0, 10)

  const priorMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const priorMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const priorMonthFrom = `${priorMonthDate.getFullYear()}-${pad(priorMonthDate.getMonth() + 1)}-01`
  const priorMonthTo = `${priorMonthDate.getFullYear()}-${pad(priorMonthDate.getMonth() + 1)}-${pad(priorMonthLastDay)}`

  async function getMonthSummary(dateFrom: string, dateTo: string) {
    const rows = await db
      .select({
        income: sql<number>`SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END)`,
        expenses: sql<number>`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`,
      })
      .from(transactions)
      .where(and(gte(transactions.bookingDate, dateFrom), lte(transactions.bookingDate, dateTo)))
    return rows[0] ?? { income: 0, expenses: 0 }
  }

  const [currentMonth, priorMonth, activeRecurring] = await Promise.all([
    getMonthSummary(currentMonthFrom, currentMonthTo),
    getMonthSummary(priorMonthFrom, priorMonthTo),
    fetchActiveRecurring(),
  ])

  // 1. Savings Rate Score (40%) — 20% savings rate = 100 score
  const savingsRate =
    currentMonth.income > 0
      ? ((currentMonth.income - currentMonth.expenses) / currentMonth.income) * 100
      : 0
  const savingsScore = Math.max(0, Math.min(100, (savingsRate / 20) * 100))

  // 2. Budget Adherence Score (35%) — prior month as implicit budget
  let adherenceScore = 75 // neutral default when no prior data
  if (priorMonth.expenses > 0 && currentMonth.expenses > 0) {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysElapsed = today.getDate()
    const scaledCurrentExpenses = currentMonth.expenses * (daysInMonth / daysElapsed)
    const overspendRatio = Math.max(
      0,
      (scaledCurrentExpenses - priorMonth.expenses) / priorMonth.expenses,
    )
    adherenceScore = Math.max(0, Math.min(100, (1 - overspendRatio) * 100))
  }

  // 3. Recurring Cost Trend Score (25%) — stable/decreasing is good
  const currentRecurringTotal = activeRecurring.reduce((s, r) => s + r.monthlyEquiv, 0)
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().slice(0, 10)
  const establishedRecurring = activeRecurring.filter(
    (r) => r.transactionCount >= 4 || r.lastSeen <= ninetyDaysAgoStr,
  )
  const priorRecurringTotal = establishedRecurring.reduce((s, r) => s + r.monthlyEquiv, 0)

  let recurringScore = 75
  if (priorRecurringTotal > 0) {
    const changePct =
      ((currentRecurringTotal - priorRecurringTotal) / priorRecurringTotal) * 100
    // -10% or better → 100 score; +10% or worse → 0 score
    recurringScore = Math.max(0, Math.min(100, 50 - changePct * 5))
  }

  const totalScore = Math.round(
    0.4 * savingsScore + 0.35 * adherenceScore + 0.25 * recurringScore,
  )

  return {
    score: totalScore,
    savingsScore: Math.round(savingsScore),
    adherenceScore: Math.round(adherenceScore),
    recurringScore: Math.round(recurringScore),
    savingsRate,
    currentExpenses: currentMonth.expenses,
    currentIncome: currentMonth.income,
    monthLabel: today.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  }
})

export type FinanceScore = Awaited<ReturnType<typeof getMonthlyFinanceScore>>

// ─── Discretionary Spending ──────────────────────────────────────────────────

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
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
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
