import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { categories, categoryRules, transactions } from "../../db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { z } from "zod"
import { invalidateCategoryCache } from "../services/categoriser.server"

const RuleFieldSchema = z.enum(["description", "creditorName", "debtorName", "merchantCategoryCode"])
const MatchTypeSchema = z.enum(["contains", "exact", "startsWith"])

export const getCategories = createServerFn().handler(async () => {
  return db.select().from(categories).orderBy(categories.name)
})

export const getCategoriesWithRules = createServerFn().handler(async () => {
  const cats = await db.select().from(categories).orderBy(categories.name)
  const rules = await db.select().from(categoryRules).orderBy(categoryRules.priority)
  return cats.map((cat) => ({
    ...cat,
    rules: rules.filter((r) => r.categoryId === cat.id),
  }))
})

export const createCategory = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().min(1),
      color: z.string().default("#94a3b8"),
      icon: z.string().optional(),
      type: z.enum(["expense", "income", "transfer"]).default("expense"),
    }),
  )
  .handler(async ({ data }) => {
    const [cat] = await db.insert(categories).values(data).returning()
    invalidateCategoryCache()
    return cat
  })

export const updateCategory = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      type: z.enum(["expense", "income", "transfer"]).optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(categories).set(rest).where(eq(categories.id, id))
    invalidateCategoryCache()
  })

export const deleteCategory = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(categories).where(eq(categories.id, id))
    invalidateCategoryCache()
  })

export const createRule = createServerFn()
  .inputValidator(
    z.object({
      categoryId: z.number(),
      pattern: z.string().min(1),
      field: z.enum(["description", "creditorName", "debtorName", "merchantCategoryCode"]).default("description"),
      matchType: z.enum(["contains", "exact", "startsWith"]).default("contains"),
      priority: z.number().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const [rule] = await db.insert(categoryRules).values(data).returning()
    invalidateCategoryCache()
    return rule
  })

export const updateRule = createServerFn()
  .inputValidator(
    z.object({
      id: z.number(),
      pattern: z.string().min(1).optional(),
      field: z.enum(["description", "creditorName", "debtorName", "merchantCategoryCode"]).optional(),
      matchType: z.enum(["contains", "exact", "startsWith"]).optional(),
      priority: z.number().optional(),
    }),
  )
  .handler(async ({ data: { id, ...rest } }) => {
    await db.update(categoryRules).set(rest).where(eq(categoryRules.id, id))
    invalidateCategoryCache()
  })

export const deleteRule = createServerFn()
  .inputValidator(z.number())
  .handler(async ({ data: id }) => {
    await db.delete(categoryRules).where(eq(categoryRules.id, id))
    invalidateCategoryCache()
  })

export const getAllRules = createServerFn().handler(async () => {
  const rules = await db.select().from(categoryRules).orderBy(categoryRules.priority)
  const cats = await db.select().from(categories)
  return rules.map((r) => ({
    ...r,
    category: cats.find((c) => c.id === r.categoryId) ?? null,
  }))
})

const PreviewRuleSchema = z.object({
  pattern: z.string().min(1),
  field: RuleFieldSchema,
  matchType: MatchTypeSchema,
})

export const previewRule = createServerFn()
  .inputValidator(PreviewRuleSchema)
  .handler(async ({ data: { pattern, field, matchType } }) => {
    const col = {
      description: transactions.description,
      creditorName: transactions.creditorName,
      debtorName: transactions.debtorName,
      merchantCategoryCode: transactions.merchantCategoryCode,
    }[field]

    let condition
    if (matchType === "contains") {
      condition = sql`${col} ILIKE ${"%" + pattern + "%"}`
    } else if (matchType === "startsWith") {
      condition = sql`${col} ILIKE ${pattern + "%"}`
    } else {
      condition = sql`lower(${col}) = lower(${pattern})`
    }

    const rows = await db
      .select({
        id: transactions.id,
        bookingDate: transactions.bookingDate,
        amount: transactions.amount,
        currency: transactions.currency,
        creditorName: transactions.creditorName,
        debtorName: transactions.debtorName,
        description: transactions.description,
        categoryId: transactions.categoryId,
        categorisedBy: transactions.categorisedBy,
      })
      .from(transactions)
      .where(condition)
      .orderBy(transactions.bookingDate)
      .limit(200)

    const cats = await db.select().from(categories)
    return {
      count: rows.length,
      capped: rows.length === 200,
      transactions: rows.map((r) => ({
        ...r,
        category: cats.find((c) => c.id === r.categoryId) ?? null,
      })),
    }
  })

export const applyRuleToHistory = createServerFn()
  .inputValidator(z.object({ ruleId: z.number(), categoryId: z.number() }))
  .handler(async ({ data: { ruleId, categoryId } }) => {
    const [rule] = await db.select().from(categoryRules).where(eq(categoryRules.id, ruleId))
    if (!rule) throw new Error("Rule not found")

    const col = {
      description: transactions.description,
      creditorName: transactions.creditorName,
      debtorName: transactions.debtorName,
      merchantCategoryCode: transactions.merchantCategoryCode,
    }[rule.field]

    let condition
    if (rule.matchType === "contains") {
      condition = sql`${col} ILIKE ${"%" + rule.pattern + "%"}`
    } else if (rule.matchType === "startsWith") {
      condition = sql`${col} ILIKE ${rule.pattern + "%"}`
    } else {
      condition = sql`lower(${col}) = lower(${rule.pattern})`
    }

    const matching = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(condition, sql`${transactions.categorisedBy} IS DISTINCT FROM 'manual'`))

    if (matching.length === 0) return { updated: 0 }

    await db
      .update(transactions)
      .set({ categoryId, categorisedBy: "rule" })
      .where(inArray(transactions.id, matching.map((r) => r.id)))

    return { updated: matching.length }
  })
