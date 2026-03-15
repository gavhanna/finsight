import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db"
import { categories, categoryRules } from "../../db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { invalidateCategoryCache } from "../services/categoriser"

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
