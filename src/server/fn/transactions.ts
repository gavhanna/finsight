import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories } from "../../db/schema"
import { eq, and, gte, lte, desc, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { categorise } from "../services/categoriser.server"
import { log } from "../../lib/logger.server"

const FiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  categoryId: z.number().optional(),
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
  if (filters.categoryId !== undefined) conditions.push(eq(transactions.categoryId, filters.categoryId))
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
