import { db } from "../../db/index.server"
import { transactions } from "../../db/schema"
import { lt } from "drizzle-orm"
import { getMedian, classifyInterval, toMonthlyEquiv } from "../../lib/recurring"

export type RecurringItemBase = {
  payee: string
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

export async function fetchRecurringItems(activeOnly = true): Promise<RecurringItemBase[]> {
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

  const payeeMap = new Map<string, typeof txns>()
  for (const tx of txns) {
    const payee = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"
    if (payee === "Unknown") continue
    if (!payeeMap.has(payee)) payeeMap.set(payee, [])
    payeeMap.get(payee)!.push(tx)
  }

  const results: RecurringItemBase[] = []

  for (const [payee, txList] of payeeMap) {
    if (txList.length < 3) continue
    const sorted = [...txList].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].bookingDate).getTime()
      const curr = new Date(sorted[i].bookingDate).getTime()
      intervals.push(Math.round((curr - prev) / 86_400_000))
    }
    const medianInterval = getMedian(intervals)
    const frequency = classifyInterval(medianInterval)
    if (!frequency) continue
    const amounts = txList.map((t) => Math.abs(t.amount))
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const monthlyEquiv = toMonthlyEquiv(avgAmount, frequency)
    const lastTx = sorted[sorted.length - 1]
    const lastSeen = lastTx.bookingDate
    const nextExpected = new Date(new Date(lastSeen).getTime() + medianInterval * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const daysSinceLastSeen = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)
    results.push({
      payee,
      monthlyEquiv,
      annualCost: monthlyEquiv * 12,
      avgAmount,
      medianInterval,
      lastSeen,
      nextExpected,
      daysSinceLastSeen,
      isActive: daysSinceLastSeen < medianInterval * 2,
      transactionCount: txList.length,
      categoryId: lastTx.categoryId,
    })
  }

  return activeOnly ? results.filter((r) => r.isActive) : results
}
