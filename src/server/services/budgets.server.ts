import { db } from "../../db/index.server"
import { sql } from "drizzle-orm"
import type { BudgetVsActual } from "../fn/budgets"

export async function getBudgetVsActualInternal(month: string): Promise<BudgetVsActual> {
  const [catResult, grpResult, unbudgetedResult] = await Promise.all([
    // 1. Category budgets: spending for the specific category
    db.execute(sql`
      SELECT
        b.id                                                                    AS "budgetId",
        b.monthly_amount                                                        AS "monthlyAmount",
        COALESCE(bo.amount, b.monthly_amount)                                   AS "budgeted",
        c.id                                                                    AS "categoryId",
        c.name                                                                  AS "categoryName",
        c.color                                                                 AS "categoryColor",
        cg.id                                                                   AS "groupId",
        cg.name                                                                 AS "groupName",
        cg.color                                                                AS "groupColor",
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0)::float AS "spent"
      FROM budgets b
      LEFT JOIN budget_overrides bo
        ON bo.budget_id = b.id AND bo.month = ${month}
      JOIN categories c
        ON c.id = b.category_id
      LEFT JOIN category_groups cg
        ON cg.id = c.group_id
      LEFT JOIN transactions t
        ON t.category_id = b.category_id
        AND to_char(t.booking_date::date, 'YYYY-MM') = ${month}
      WHERE b.category_id IS NOT NULL
      GROUP BY b.id, b.monthly_amount, bo.amount, c.id, c.name, c.color, cg.id, cg.name, cg.color
      ORDER BY cg.name NULLS LAST, c.name
    `),

    // 2. Group budgets: spending for all categories in the group that don't
    //    have their own individual budget (avoids double-counting)
    db.execute(sql`
      SELECT
        b.id                                                                    AS "budgetId",
        b.monthly_amount                                                        AS "monthlyAmount",
        COALESCE(bo.amount, b.monthly_amount)                                   AS "budgeted",
        cg.id                                                                   AS "groupId",
        cg.name                                                                 AS "groupName",
        cg.color                                                                AS "groupColor",
        COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0)::float AS "spent"
      FROM budgets b
      LEFT JOIN budget_overrides bo
        ON bo.budget_id = b.id AND bo.month = ${month}
      JOIN category_groups cg
        ON cg.id = b.category_group_id
      LEFT JOIN categories c
        ON c.group_id = cg.id
        AND c.id NOT IN (SELECT category_id FROM budgets WHERE category_id IS NOT NULL)
      LEFT JOIN transactions t
        ON t.category_id = c.id
        AND to_char(t.booking_date::date, 'YYYY-MM') = ${month}
      WHERE b.category_group_id IS NOT NULL
      GROUP BY b.id, b.monthly_amount, bo.amount, cg.id, cg.name, cg.color
      ORDER BY cg.name
    `),

    // 3. Spending on categories that have no budget (neither individual nor via group)
    db.execute(sql`
      SELECT
        c.id                                  AS "categoryId",
        c.name                                AS "categoryName",
        c.color                               AS "categoryColor",
        cg.id                                 AS "groupId",
        cg.name                               AS "groupName",
        SUM(ABS(t.amount))::float             AS "spent",
        COUNT(*)::int                         AS "txCount"
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_groups cg ON cg.id = c.group_id
      WHERE t.amount < 0
        AND to_char(t.booking_date::date, 'YYYY-MM') = ${month}
        AND c.id NOT IN (
          SELECT category_id FROM budgets WHERE category_id IS NOT NULL
        )
        AND (c.group_id IS NULL OR c.group_id NOT IN (
          SELECT category_group_id FROM budgets WHERE category_group_id IS NOT NULL
        ))
      GROUP BY c.id, c.name, c.color, cg.id, cg.name
      ORDER BY "spent" DESC
    `),
  ])

  return {
    month,
    categoryBudgets: Array.from(catResult)      as BudgetVsActual["categoryBudgets"],
    groupBudgets:    Array.from(grpResult)       as BudgetVsActual["groupBudgets"],
    unbudgeted:      Array.from(unbudgetedResult) as BudgetVsActual["unbudgeted"],
  }
}
