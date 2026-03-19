import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { transactions, categories, settings } from "../../db/schema"
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

export const getTransactions = createServerFn()
  .inputValidator(FiltersSchema)
  .handler(async ({ data: filters }) => {
    const conditions = []

    if (filters.dateFrom) {
      conditions.push(gte(transactions.bookingDate, filters.dateFrom))
    }
    if (filters.dateTo) {
      conditions.push(lte(transactions.bookingDate, filters.dateTo))
    }
    if (filters.accountIds?.length) {
      conditions.push(inArray(transactions.accountId, filters.accountIds))
    }
    if (filters.categoryId !== undefined) {
      conditions.push(eq(transactions.categoryId, filters.categoryId))
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      conditions.push(
        sql`(${transactions.creditorName} ILIKE ${term} OR ${transactions.debtorName} ILIKE ${term} OR ${transactions.description} ILIKE ${term})`,
      )
    }

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

export const recategoriseAll = createServerFn().handler(async () => {
  const settingRows = await db.select().from(settings)
  const settingMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]))
  const ollamaUrl = settingMap["ollama_url"] ?? undefined
  const ollamaModel = settingMap["ollama_model"] ?? undefined

  // Get all non-manual transactions
  const txs = await db
    .select()
    .from(transactions)
    .where(sql`${transactions.categorisedBy} != 'manual' OR ${transactions.categorisedBy} IS NULL`)

  log.info("transaction.recategorise.started", { total: txs.length, ollamaEnabled: !!ollamaUrl })

  let updated = 0
  for (const tx of txs) {
    const { categoryId, categorisedBy } = await categorise(
      {
        description: tx.description,
        creditorName: tx.creditorName,
        debtorName: tx.debtorName,
        merchantCategoryCode: tx.merchantCategoryCode,
        amount: tx.amount,
      },
      ollamaUrl,
      ollamaModel,
    )
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
