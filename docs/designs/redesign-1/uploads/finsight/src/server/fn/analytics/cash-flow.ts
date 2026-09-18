import { createServerFn } from "@tanstack/react-start"
import { db } from "../../../db/index.server"
import { transactions, categories } from "../../../db/schema"
import { eq, and, gte, lte, sql, desc } from "drizzle-orm"
import { z } from "zod"
import { fetchRecurringItems } from "../../services/recurring.server"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

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
      fetchRecurringItems(true),
    ])

    const dailyMap = new Map(dailyRows.map((r) => [r.date, r]))

    const expectedByDate = new Map<string, Array<{ payee: string; amount: number }>>()
    for (const item of activeRecurring) {
      const next = new Date(item.nextExpected)
      if (next.getFullYear() === year && next.getMonth() + 1 === month) {
        const dateStr = `${year}-${pad(month)}-${pad(next.getDate())}`
        if (!expectedByDate.has(dateStr)) expectedByDate.set(dateStr, [])
        expectedByDate.get(dateStr)!.push({ payee: item.payee, amount: item.avgAmount })
      }
    }

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

export const getDayTransactions = createServerFn()
  .inputValidator(z.object({ date: z.string() }))
  .handler(async ({ data: { date } }) => {
    const rows = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        creditorName: transactions.creditorName,
        debtorName: transactions.debtorName,
        description: transactions.description,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.bookingDate, date))
      .orderBy(desc(transactions.amount))
    return rows
  })

export type DayTransaction = Awaited<ReturnType<typeof getDayTransactions>>[number]
