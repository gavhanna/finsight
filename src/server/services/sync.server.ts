import { db } from "../../db/index.server"
import { accounts, bankConnections, transactions as txTable, settings, balanceHistory } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import { getAccountTransactions, getAccountBalances } from "./gocardless.server"
import { categorise } from "./categoriser.server"
import { createHash } from "crypto"
import { log } from "../../lib/logger.server"
import {
  notifySyncCompleted,
  notifyLargeTransactions,
  checkRecurringReminders,
  checkWeeklyDigest,
} from "./notifications.server"

const INITIAL_SYNC_LOOKBACK_DAYS = 90
const INCREMENTAL_SYNC_OVERLAP_DAYS = 10

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

  const [connection] = await db
    .select({ institutionName: bankConnections.institutionName })
    .from(bankConnections)
    .where(eq(bankConnections.id, account.connectionId))

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

  const initialSyncStart = new Date()
  initialSyncStart.setDate(initialSyncStart.getDate() - INITIAL_SYNC_LOOKBACK_DAYS)
  const dateFrom = latestTx?.bookingDate
    ? withDateOverlap(latestTx.bookingDate, INCREMENTAL_SYNC_OVERLAP_DAYS)
    : initialSyncStart.toISOString().slice(0, 10)

  log.info("account.sync.started", { accountId, dateFrom, syncCallsToday: callsToday + 1 })

  let booked: Awaited<ReturnType<typeof getAccountTransactions>>["booked"]
  let balances: Awaited<ReturnType<typeof getAccountBalances>>
  try {
    ;({ booked } = await getAccountTransactions(secretId, secretKey, accountId, dateFrom))
    balances = await getAccountBalances(secretId, secretKey, accountId)
  } catch (err: any) {
    const status = err?.response?.status ?? err?.response?.data?.status_code ?? err?.status_code
    const detail: string = err?.response?.data?.detail ?? err?.detail ?? err?.message ?? ""
    const isExpired = status === 409 || detail.toLowerCase().includes("access not valid") || detail.toLowerCase().includes("expired")
    if (isExpired) {
      await db.update(bankConnections).set({ status: "EXPIRED" }).where(eq(bankConnections.id, account.connectionId))
      log.warn("account.sync.connection_expired", { accountId, connectionId: account.connectionId })
      throw new Error("Bank connection has expired — please reconnect.")
    }
    throw err
  }

  // Fetch and store current balance
  const interimBalance = balances.find((b) => b.balanceType === "interimBooked")
  const currentBalance = interimBalance || balances[0]
  if (currentBalance) {
    const amount = parseFloat(currentBalance.balanceAmount.amount)
    await db
      .update(accounts)
      .set({
        balance: amount,
        balanceCurrency: currentBalance.balanceAmount.currency,
        balanceUpdatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))
    // Record balance history
    await db.insert(balanceHistory).values({
      accountId,
      balance: amount,
      currency: currentBalance.balanceAmount.currency,
    })
  }

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

    const providerId = tx.transactionId ?? tx.entryReference ?? dedupeHash.slice(0, 20)
    const txId = `${accountId}:${providerId}`

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
      newTxs.push({ payee: payeeName || desc, amount, bookingDate: tx.bookingDate })
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
    const accountName = account.name ?? connection?.institutionName ?? accountId
    notifySyncCompleted(accountName, imported).catch(() => {})
    notifyLargeTransactions(newTxs).catch(() => {})
  }

  return { imported, total: booked.length }
}

function withDateOverlap(date: string, overlapDays: number): string {
  const overlapped = new Date(`${date}T00:00:00.000Z`)
  overlapped.setUTCDate(overlapped.getUTCDate() - overlapDays)
  return overlapped.toISOString().slice(0, 10)
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
