import { db } from "../../db/index.server"
import { accounts, bankConnections, transactions as txTable, settings } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import { getAccountTransactions } from "./gocardless.server"
import { categorise } from "./categoriser.server"
import { createHash } from "crypto"
import { log } from "../../lib/logger.server"
import {
  notifySyncCompleted,
  notifyLargeTransactions,
  checkRecurringReminders,
  checkWeeklyDigest,
} from "./notifications.server"

async function getCredentials() {
  const rows = await db.select().from(settings)
  const map: Record<string, string | null> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    secretId: map["gocardless_secret_id"] ?? "",
    secretKey: map["gocardless_secret_key"] ?? "",
  }
}

export async function syncAccountById(accountId: string): Promise<{ imported: number; total: number }> {
  const { secretId, secretKey } = await getCredentials()
  if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")

  const today = new Date().toISOString().slice(0, 10)
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))

  if (!account) throw new Error("Account not found")

  const callsToday = account.syncCallsDate === today ? account.syncCallsToday : 0
  if (callsToday >= 4) {
    log.warn("account.sync.rate_limited", { accountId, callsToday })
    throw new Error("Rate limit reached: max 4 syncs per day per account")
  }

  const [latestTx] = await db
    .select({ bookingDate: txTable.bookingDate })
    .from(txTable)
    .where(eq(txTable.accountId, accountId))
    .orderBy(desc(txTable.bookingDate))
    .limit(1)

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const dateFrom = latestTx?.bookingDate ?? ninetyDaysAgo.toISOString().slice(0, 10)

  log.info("account.sync.started", { accountId, dateFrom, syncCallsToday: callsToday + 1 })

  const { booked, pending: _pending } = await getAccountTransactions(
    secretId,
    secretKey,
    accountId,
    dateFrom,
  )

  log.info("account.sync.fetched", {
    accountId,
    dateFrom,
    bookedCount: booked.length,
    bookedDates: booked.length > 0
      ? { first: booked[booked.length - 1]?.bookingDate, last: booked[0]?.bookingDate }
      : null,
  })

  let imported = 0
  let skipped = 0
  const newTxs: Array<{ payee: string; amount: number; bookingDate: string }> = []
  for (const tx of booked) {
    const payeeName = tx.creditorName ?? tx.debtorName ?? ""
    const desc = tx.remittanceInformationUnstructured ?? tx.remittanceInformationStructured ?? ""
    const amount = parseFloat(tx.transactionAmount.amount)

    const hashInput = `${accountId}|${tx.bookingDate}|${amount}|${payeeName}|${desc}`
    const dedupeHash = createHash("sha256").update(hashInput).digest("hex")

    const txId = tx.transactionId ?? tx.entryReference ?? dedupeHash.slice(0, 20)

    const rawTx = {
      description: desc || null,
      creditorName: tx.creditorName ?? null,
      debtorName: tx.debtorName ?? null,
      merchantCategoryCode: tx.merchantCategoryCode ?? null,
      amount,
    }

    const { categoryId, categorisedBy } = await categorise(rawTx)

    try {
      await db.insert(txTable).values({
        id: txId,
        accountId,
        externalId: tx.transactionId ?? null,
        bookingDate: tx.bookingDate,
        valueDate: tx.valueDate ?? null,
        amount,
        currency: tx.transactionAmount.currency,
        creditorName: tx.creditorName ?? null,
        debtorName: tx.debtorName ?? null,
        description: desc || null,
        merchantCategoryCode: tx.merchantCategoryCode ?? null,
        categoryId,
        categorisedBy,
        dedupeHash,
        rawData: JSON.stringify(tx),
      })
      imported++
      newTxs.push({ payee: payeeName, amount, bookingDate: tx.bookingDate })
    } catch (err: any) {
      const pgCode = err?.cause?.code ?? err?.code
      const isDedup = pgCode === "23505"
      if (!isDedup) {
        log.error("account.sync.insert_error", {
          accountId,
          txId,
          bookingDate: tx.bookingDate,
          amount,
          errCode: pgCode,
          errMsg: err?.message,
        })
      }
      skipped++
    }
  }

  await db
    .update(accounts)
    .set({
      syncCallsToday: callsToday + 1,
      syncCallsDate: today,
      lastSyncAt: new Date(),
    })
    .where(eq(accounts.id, accountId))

  await db
    .update(bankConnections)
    .set({ lastSyncAt: new Date() })
    .where(eq(bankConnections.id, account.connectionId))

  log.info("account.sync.completed", { accountId, fetched: booked.length, imported, skipped })

  if (imported > 0) {
    const accountName = account.name ?? accountId
    notifySyncCompleted(accountName, imported).catch(() => {})
    notifyLargeTransactions(newTxs).catch(() => {})
  }

  return { imported, total: booked.length }
}

export async function syncAllAccounts(): Promise<void> {
  log.info("cron.sync.started")
  const allAccounts = await db.select().from(accounts)
  if (allAccounts.length === 0) {
    log.info("cron.sync.no_accounts")
    return
  }
  for (const account of allAccounts) {
    try {
      const result = await syncAccountById(account.id)
      log.info("cron.sync.account_completed", { accountId: account.id, ...result })
    } catch (err: any) {
      log.warn("cron.sync.account_skipped", { accountId: account.id, reason: err?.message })
    }
  }
  log.info("cron.sync.finished", { accountCount: allAccounts.length })
  checkRecurringReminders().catch(() => {})
  checkWeeklyDigest().catch(() => {})
}
