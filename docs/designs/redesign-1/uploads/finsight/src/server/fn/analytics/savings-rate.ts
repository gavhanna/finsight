import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions } from "../../../db/schema"
import { sql } from "drizzle-orm"

const monthExpr = sql<string>`to_char(${transactions.bookingDate}::date, 'YYYY-MM')`

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

  return withRate.map((row, i, arr) => {
    const window = arr.slice(Math.max(0, i - 2), i + 1)
    const rollingAvg = window.reduce((s, r) => s + r.savingsRate, 0) / window.length
    return { ...row, rollingAvg }
  })
})

export type SavingsRateRow = Awaited<ReturnType<typeof getSavingsRateHistory>>[number]
