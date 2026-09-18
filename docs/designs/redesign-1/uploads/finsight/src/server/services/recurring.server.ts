import { db } from "../../db/index.server"
import { categories, transactions } from "../../db/schema"
import { inArray, lt } from "drizzle-orm"
import {
  getMedian,
  classifyInterval,
  toMonthlyEquiv,
  type Frequency,
} from "../../lib/recurring"
import { canonicalizeMerchantName } from "../../lib/merchant-utils"
import { loadAliasMap } from "./merchant-aliases.server"

export type RecurringItemBase = {
  payee: string
  frequency: Frequency
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
}

export type RecurringItem = RecurringItemBase & {
  amountRange: { min: number; max: number }
  categoryName: string
  categoryColor: string
}

type RecurringTransaction = {
  bookingDate: string
  amount: number
  creditorName: string | null
  debtorName: string | null
  description: string | null
  categoryId: number | null
}

export async function fetchRecurringItems(activeOnly = true): Promise<RecurringItemBase[]> {
  const items = await detectRecurringItems()
  return activeOnly ? items.filter((item) => item.isActive) : items
}

export async function fetchRecurringItemsWithCategories(
  activeOnly = true,
): Promise<RecurringItem[]> {
  const items = await detectRecurringItems()
  const filtered = activeOnly ? items.filter((item) => item.isActive) : items

  const uniqueCatIds = [
    ...new Set(filtered.map((item) => item.categoryId).filter((id): id is number => id !== null)),
  ]
  const categoryRows =
    uniqueCatIds.length > 0
      ? await db.select().from(categories).where(inArray(categories.id, uniqueCatIds))
      : []
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]))

  return filtered
    .map((item) => ({
      ...item,
      categoryName: item.categoryId
        ? (categoryMap.get(item.categoryId)?.name ?? "Uncategorised")
        : "Uncategorised",
      categoryColor: item.categoryId
        ? (categoryMap.get(item.categoryId)?.color ?? "#94a3b8")
        : "#94a3b8",
    }))
    .sort((a, b) => b.monthlyEquiv - a.monthlyEquiv)
}

async function detectRecurringItems(): Promise<Array<RecurringItemBase & { amountRange: { min: number; max: number } }>> {
  const aliases = await loadAliasMap()
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

  const payeeMap = new Map<string, RecurringTransaction[]>()
  for (const tx of txns) {
    const rawPayee = tx.creditorName ?? tx.debtorName ?? tx.description ?? ""
    if (!rawPayee) continue
    const payee = canonicalizeMerchantName(rawPayee, aliases)
    if (!payeeMap.has(payee)) payeeMap.set(payee, [])
    payeeMap.get(payee)!.push(tx)
  }

  const results: Array<RecurringItemBase & { amountRange: { min: number; max: number } }> = []

  for (const [payee, txList] of payeeMap) {
    const recurring = analyseRecurringTransactions(txList)
    if (!recurring) continue
    results.push({
      payee,
      ...recurring,
      transactionCount: txList.length,
      categoryId: recurring.lastCategoryId,
    })
  }

  return results
}

export function analyseRecurringTransactions(txList: RecurringTransaction[]) {
  if (txList.length < 3) return null

  const sorted = [...txList].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].bookingDate).getTime()
    const curr = new Date(sorted[i].bookingDate).getTime()
    intervals.push(Math.round((curr - prev) / 86_400_000))
  }

  const medianInterval = getMedian(intervals)
  const frequency = classifyInterval(medianInterval)
  if (!frequency) return null

  const amounts = txList.map((transaction) => Math.abs(transaction.amount))
  const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
  const monthlyEquiv = toMonthlyEquiv(avgAmount, frequency)
  const lastTx = sorted[sorted.length - 1]
  const lastSeen = lastTx.bookingDate
  const nextExpected = new Date(new Date(lastSeen).getTime() + medianInterval * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const daysSinceLastSeen = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)

  return {
    frequency,
    medianInterval,
    avgAmount,
    amountRange: { min: Math.min(...amounts), max: Math.max(...amounts) },
    monthlyEquiv,
    annualCost: monthlyEquiv * 12,
    lastSeen,
    nextExpected,
    daysSinceLastSeen,
    isActive: daysSinceLastSeen < medianInterval * 2,
    lastCategoryId: lastTx.categoryId,
  }
}
