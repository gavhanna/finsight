import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import {
  transactions,
  categories,
  accounts,
  bankConnections,
  budgets,
  budgetOverrides,
} from "../../db/schema"
import { eq, and, gte, lte, desc, inArray, sql, lt, gt } from "drizzle-orm"
import { z } from "zod"
import { categorise } from "../services/categoriser.server"
import { log } from "../../lib/logger.server"
import { getMerchantContextForTransaction } from "../services/merchants.server"

const FiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  categoryId: z.number().optional(),
  amountSign: z.enum(["in", "out"]).optional(),
  search: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(50),
})

const StatsFiltersSchema = FiltersSchema.omit({ page: true, pageSize: true })

function buildConditions(filters: z.infer<typeof StatsFiltersSchema>) {
  const conditions = []
  if (filters.dateFrom) conditions.push(gte(transactions.bookingDate, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.bookingDate, filters.dateTo))
  if (filters.accountIds?.length) conditions.push(inArray(transactions.accountId, filters.accountIds))
  if (filters.categoryId !== undefined) {
    if (filters.categoryId === -1) {
      conditions.push(sql`${transactions.categoryId} IS NULL`)
    } else {
      conditions.push(eq(transactions.categoryId, filters.categoryId))
    }
  }
  if (filters.amountSign === "in") conditions.push(gt(transactions.amount, 0))
  if (filters.amountSign === "out") conditions.push(lt(transactions.amount, 0))
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      sql`(${transactions.creditorName} ILIKE ${term} OR ${transactions.debtorName} ILIKE ${term} OR ${transactions.description} ILIKE ${term})`,
    )
  }
  return conditions
}

export const getTransactionStats = createServerFn()
  .inputValidator(StatsFiltersSchema)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)
    const where = conditions.length ? and(...conditions) : undefined

    const [totalsRow, byMonth] = await Promise.all([
      db
        .select({
          totalAmount: sql<number>`sum(${transactions.amount})`,
          totalIn: sql<number>`sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end)`,
          totalOut: sql<number>`sum(case when ${transactions.amount} < 0 then ${transactions.amount} else 0 end)`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(where),
      db
        .select({
          month: sql<string>`substring(${transactions.bookingDate}, 1, 7)`,
          amount: sql<number>`sum(${transactions.amount})`,
          count: sql<number>`count(*)`,
        })
        .from(transactions)
        .where(where)
        .groupBy(sql`substring(${transactions.bookingDate}, 1, 7)`)
        .orderBy(sql`substring(${transactions.bookingDate}, 1, 7)`),
    ])

    return {
      totalAmount: Number(totalsRow[0]?.totalAmount ?? 0),
      totalIn: Number(totalsRow[0]?.totalIn ?? 0),
      totalOut: Number(totalsRow[0]?.totalOut ?? 0),
      count: Number(totalsRow[0]?.count ?? 0),
      byMonth: byMonth.map((r) => ({ month: r.month, amount: Number(r.amount), count: Number(r.count) })),
    }
  })

export const getTransactions = createServerFn()
  .inputValidator(FiltersSchema)
  .handler(async ({ data: filters }) => {
    const conditions = buildConditions(filters)
    const offset = (filters.page - 1) * filters.pageSize

    const rows = await db
      .select({
        transaction: transactions,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          icon: categories.icon,
        },
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.bookingDate), desc(transactions.id))
      .limit(filters.pageSize)
      .offset(offset)

    const totalRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(conditions.length ? and(...conditions) : undefined)

    return {
      transactions: rows.map((r) => ({ ...r.transaction, category: r.category })),
      total: Number(totalRows[0]?.count ?? 0),
      page: filters.page,
      pageSize: filters.pageSize,
    }
  })

export const getTransactionDetail = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const [row] = await db
      .select({
        transaction: transactions,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          icon: categories.icon,
          type: categories.type,
        },
        account: {
          id: accounts.id,
          name: accounts.name,
          iban: accounts.iban,
          currency: accounts.currency,
          ownerName: accounts.ownerName,
          connectionId: accounts.connectionId,
          lastSyncAt: accounts.lastSyncAt,
        },
        connection: {
          id: bankConnections.id,
          institutionId: bankConnections.institutionId,
          institutionName: bankConnections.institutionName,
          institutionLogo: bankConnections.institutionLogo,
          status: bankConnections.status,
          lastSyncAt: bankConnections.lastSyncAt,
        },
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(bankConnections, eq(accounts.connectionId, bankConnections.id))
      .where(eq(transactions.id, id))
      .limit(1)

    if (!row) return null

    const rawMerchantName =
      row.transaction.creditorName ??
      row.transaction.debtorName ??
      row.transaction.description ??
      null

    let merchant: {
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
    } | null = null

    let categoryContext: {
      month: string
      monthSpent: number
      transactionShareOfMonth: number | null
      budgetedAmount: number | null
      transactionShareOfBudget: number | null
      monthBudgetUsed: number | null
    } | null = null

    let merchantContext: {
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
    } | null = null

    if (row.transaction.amount < 0 && rawMerchantName && rawMerchantName !== "Unknown") {
      const context = await getMerchantContextForTransaction({
        rawPayee: rawMerchantName,
        bookingDate: row.transaction.bookingDate,
        amount: row.transaction.amount,
      })
      if (context) {
        merchant = context.merchant
        merchantContext = context.merchantContext
      }
    }

    if (row.transaction.categoryId && row.transaction.amount < 0) {
      const month = row.transaction.bookingDate.slice(0, 7)
      const [spendRows, budgetRows] = await Promise.all([
        db
          .select({
            monthSpent: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.categoryId, row.transaction.categoryId),
              lt(transactions.amount, 0),
              sql`to_char(${transactions.bookingDate}::date, 'YYYY-MM') = ${month}`,
            ),
          ),
        db
          .select({
            budgetedAmount: sql<number>`COALESCE(${budgetOverrides.amount}, ${budgets.monthlyAmount})`,
          })
          .from(budgets)
          .leftJoin(
            budgetOverrides,
            and(eq(budgetOverrides.budgetId, budgets.id), eq(budgetOverrides.month, month)),
          )
          .where(eq(budgets.categoryId, row.transaction.categoryId))
          .limit(1),
      ])

      const monthSpent = Number(spendRows[0]?.monthSpent ?? 0)
      const txAmount = Math.abs(row.transaction.amount)
      const budgetedAmount =
        budgetRows.length > 0 ? Number(budgetRows[0]?.budgetedAmount ?? 0) : null

      categoryContext = {
        month,
        monthSpent,
        transactionShareOfMonth: monthSpent > 0 ? txAmount / monthSpent : null,
        budgetedAmount,
        transactionShareOfBudget:
          budgetedAmount && budgetedAmount > 0 ? txAmount / budgetedAmount : null,
        monthBudgetUsed:
          budgetedAmount && budgetedAmount > 0 ? monthSpent / budgetedAmount : null,
      }
    }

    return {
      ...row.transaction,
      category: row.category,
      account: row.account,
      connection: row.connection,
      categoryContext,
      merchant,
      merchantContext,
      rawDataText: row.transaction.rawData ?? null,
    }
  })

export const updateTransactionCategory = createServerFn()
  .inputValidator(z.object({ id: z.string(), categoryId: z.number().nullable() }))
  .handler(async ({ data: { id, categoryId } }) => {
    await db
      .update(transactions)
      .set({ categoryId, categorisedBy: "manual" })
      .where(eq(transactions.id, id))
    log.info("transaction.categorised.manual", { transactionId: id, categoryId })
  })

export const bulkCategorise = createServerFn()
  .inputValidator(z.object({ ids: z.array(z.string()), categoryId: z.number() }))
  .handler(async ({ data: { ids, categoryId } }) => {
    await db
      .update(transactions)
      .set({ categoryId, categorisedBy: "manual" })
      .where(inArray(transactions.id, ids))
    log.info("transaction.categorised.bulk", { count: ids.length, categoryId })
  })

export const getUncategorisedTransactions = createServerFn().handler(async () => {
  const rows = await db
    .select()
    .from(transactions)
    .where(sql`${transactions.categoryId} IS NULL`)
    .orderBy(desc(transactions.bookingDate), desc(transactions.id))
    .limit(500)
  return rows
})

export const getUncategorisedCount = createServerFn().handler(async () => {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(transactions)
    .where(sql`${transactions.categoryId} IS NULL`)
  return count
})

export const getTransactionsForTriage = createServerFn()
  .inputValidator(z.object({ categoryId: z.number().nullable() }))
  .handler(async ({ data: { categoryId } }) => {
    const rows = await db
      .select()
      .from(transactions)
      .where(
        categoryId === null
          ? sql`${transactions.categoryId} IS NULL`
          : eq(transactions.categoryId, categoryId),
      )
      .orderBy(desc(transactions.bookingDate), desc(transactions.id))
      .limit(500)
    return rows
  })

export const recategoriseAll = createServerFn().handler(async () => {
  const txs = await db.select().from(transactions)

  log.info("transaction.recategorise.started", { total: txs.length })

  let updated = 0
  for (const tx of txs) {
    const { categoryId, categorisedBy } = await categorise({
      description: tx.description,
      creditorName: tx.creditorName,
      debtorName: tx.debtorName,
      merchantCategoryCode: tx.merchantCategoryCode,
      amount: tx.amount,
    })
    // Rules are king: they override even manual categorisation.
    // MCC and LLM do not override manual choices.
    const isManual = tx.categorisedBy === "manual"
    const ruleWins = categorisedBy === "rule"
    if (isManual && !ruleWins) continue
    if (categoryId !== tx.categoryId) {
      await db
        .update(transactions)
        .set({ categoryId, categorisedBy })
        .where(eq(transactions.id, tx.id))
      updated++
    }
  }

  log.info("transaction.recategorise.completed", { updated, total: txs.length })
  return { updated, total: txs.length }
})
