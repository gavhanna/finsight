import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { budgets, budgetOverrides, categories, categoryGroups } from "../../db/schema"
import { eq, and, sql } from "drizzle-orm"
import { z } from "zod"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BudgetRow = {
  id: number
  monthlyAmount: number
  note: string | null
  categoryId: number | null
  categoryGroupId: number | null
  categoryName: string | null
  categoryColor: string | null
  groupId: number | null
  groupName: string | null
  groupColor: string | null
}

export type CategoryBudgetRow = {
  budgetId: number
  monthlyAmount: number
  budgeted: number
  categoryId: number
  categoryName: string
  categoryColor: string
  groupId: number | null
  groupName: string | null
  groupColor: string | null
  spent: number
}

export type GroupBudgetRow = {
  budgetId: number
  monthlyAmount: number
  budgeted: number
  groupId: number
  groupName: string
  groupColor: string
  spent: number
}

export type UnbudgetedRow = {
  categoryId: number
  categoryName: string
  categoryColor: string
  groupId: number | null
  groupName: string | null
  spent: number
  txCount: number
}

export type BudgetVsActual = {
  month: string
  categoryBudgets: CategoryBudgetRow[]
  groupBudgets: GroupBudgetRow[]
  unbudgeted: UnbudgetedRow[]
}

// ─── Server functions ─────────────────────────────────────────────────────────

export const getBudgetVsActual = createServerFn()
  .inputValidator(z.object({ month: z.string() }))
  .handler(async ({ data }) => {
    const { getBudgetVsActualInternal } = await import("../services/budgets.server")
    return getBudgetVsActualInternal(data.month)
  })

export const getBudgets = createServerFn().handler(async () => {
  const rows = await db.execute(sql`
    SELECT
      b.id,
      b.monthly_amount  AS "monthlyAmount",
      b.note,
      b.category_id     AS "categoryId",
      b.category_group_id AS "categoryGroupId",
      c.name            AS "categoryName",
      c.color           AS "categoryColor",
      cg.id             AS "groupId",
      cg.name           AS "groupName",
      cg.color          AS "groupColor"
    FROM budgets b
    LEFT JOIN categories c      ON c.id  = b.category_id
    LEFT JOIN category_groups cg ON cg.id = b.category_group_id
    ORDER BY cg.name NULLS LAST, c.name NULLS LAST
  `)
  return Array.from(rows) as BudgetRow[]
})

export const getExpenseCategoriesAndGroups = createServerFn().handler(async () => {
  const [cats, grps] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, color: categories.color, groupId: categories.groupId })
      .from(categories)
      .where(eq(categories.type, "expense"))
      .orderBy(categories.name),
    db
      .select({ id: categoryGroups.id, name: categoryGroups.name, color: categoryGroups.color })
      .from(categoryGroups)
      .orderBy(categoryGroups.name),
  ])
  return { categories: cats, groups: grps }
})

const UpsertBudgetSchema = z.object({
  id:              z.number().optional(),
  categoryId:      z.number().nullable(),
  categoryGroupId: z.number().nullable(),
  monthlyAmount:   z.number().positive(),
  note:            z.string().optional(),
})

export const upsertBudget = createServerFn()
  .inputValidator(UpsertBudgetSchema)
  .handler(async ({ data }) => {
    if (
      (data.categoryId === null && data.categoryGroupId === null) ||
      (data.categoryId !== null && data.categoryGroupId !== null)
    ) {
      throw new Error("A budget must target exactly one category or one group, not both or neither.")
    }

    if (data.id) {
      await db
        .update(budgets)
        .set({ monthlyAmount: data.monthlyAmount, note: data.note ?? null, updatedAt: new Date() })
        .where(eq(budgets.id, data.id))
    } else {
      await db.insert(budgets).values({
        categoryId:      data.categoryId,
        categoryGroupId: data.categoryGroupId,
        monthlyAmount:   data.monthlyAmount,
        note:            data.note ?? null,
      })
    }
    return { ok: true }
  })

export const deleteBudget = createServerFn()
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await db.delete(budgets).where(eq(budgets.id, data.id))
    return { ok: true }
  })

export const setMonthOverride = createServerFn()
  .inputValidator(z.object({ budgetId: z.number(), month: z.string(), amount: z.number().positive() }))
  .handler(async ({ data }) => {
    await db
      .insert(budgetOverrides)
      .values({ budgetId: data.budgetId, month: data.month, amount: data.amount })
      .onConflictDoUpdate({
        target: [budgetOverrides.budgetId, budgetOverrides.month],
        set:    { amount: data.amount },
      })
    return { ok: true }
  })

export const removeMonthOverride = createServerFn()
  .inputValidator(z.object({ budgetId: z.number(), month: z.string() }))
  .handler(async ({ data }) => {
    await db
      .delete(budgetOverrides)
      .where(and(eq(budgetOverrides.budgetId, data.budgetId), eq(budgetOverrides.month, data.month)))
    return { ok: true }
  })
