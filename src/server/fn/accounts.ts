import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { accounts, bankConnections, transactions as txTable, settings } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"
import {
  createRequisition,
  getRequisition,
  getAccountDetails,
  getAccountTransactions,
  getInstitutions,
} from "../services/gocardless.server"
import { categorise } from "../services/categoriser.server"
import { createHash } from "crypto"
import { log } from "../../lib/logger.server"

async function getCredentials() {
  const rows = await db.select().from(settings)
  const map: Record<string, string | null> = {}
  for (const r of rows) map[r.key] = r.value
  return {
    secretId: map["gocardless_secret_id"] ?? "",
    secretKey: map["gocardless_secret_key"] ?? "",
  }
}

export const getConnections = createServerFn().handler(async () => {
  const connections = await db
    .select()
    .from(bankConnections)
    .orderBy(desc(bankConnections.createdAt))

  const allAccounts = await db.select().from(accounts)

  return connections.map((conn) => ({
    ...conn,
    accounts: allAccounts.filter((a) => a.connectionId === conn.id),
  }))
})

export const getInstitutionsList = createServerFn()
  .inputValidator(z.string().default("GB"))
  .handler(async ({ data: country }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")
    return getInstitutions(secretId, secretKey, country)
  })

export const initiateConnection = createServerFn()
  .inputValidator(z.object({ institutionId: z.string(), institutionName: z.string(), institutionLogo: z.string().optional() }))
  .handler(async ({ data: { institutionId, institutionName, institutionLogo } }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")

    const redirectUrl = `${process.env["APP_URL"] ?? "http://localhost:3000"}/api/gocardless/callback`
    log.info("bank.connection.initiating", { institutionId, institutionName })
    const requisition = await createRequisition(secretId, secretKey, institutionId, redirectUrl)

    await db.insert(bankConnections).values({
      id: requisition.id,
      institutionId,
      institutionName,
      institutionLogo: institutionLogo ?? null,
      status: "CREATED",
      agreementId: requisition.agreement,
    })

    log.info("bank.connection.initiated", { requisitionId: requisition.id, institutionId, institutionName })
    return { link: requisition.link }
  })

export const completeConnection = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: requisitionId }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) {
      log.error("gocardless.callback.error", { requisitionId, error: "GoCardless credentials not configured" })
      throw new Error("GoCardless credentials not configured")
    }

    try {
      const requisition = await getRequisition(secretId, secretKey, requisitionId)

      // Update connection status
      await db
        .update(bankConnections)
        .set({ status: "LINKED" })
        .where(eq(bankConnections.id, requisitionId))

      // Upsert accounts
      for (const accountId of requisition.accounts ?? []) {
        const details = await getAccountDetails(secretId, secretKey, accountId)
        await db
          .insert(accounts)
          .values({
            id: accountId,
            connectionId: requisitionId,
            iban: details.iban ?? null,
            name: details.name ?? null,
            currency: details.currency ?? null,
            ownerName: details.ownerName ?? null,
          })
          .onConflictDoNothing()
      }

      log.info("bank.connection.completed", {
        requisitionId,
        accountCount: requisition.accounts?.length ?? 0,
      })
    } catch (err: any) {
      log.error("gocardless.callback.error", { requisitionId, error: err?.message })
      throw err
    }
  })

export const syncAccount = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: accountId }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")

    const today = new Date().toISOString().slice(0, 10)
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))

    if (!account) throw new Error("Account not found")

    // Rate limit check
    const callsToday = account.syncCallsDate === today ? account.syncCallsToday : 0
    if (callsToday >= 4) {
      log.warn("account.sync.rate_limited", { accountId, callsToday })
      throw new Error("Rate limit reached: max 4 syncs per day per account")
    }

    // Get date range
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

    // Fetch transactions
    const { booked, pending } = await getAccountTransactions(
      secretId,
      secretKey,
      accountId,
      dateFrom,
    )

    log.info("account.sync.fetched", {
      accountId,
      dateFrom,
      bookedCount: booked.length,
      pendingCount: pending.length,
      bookedDates: booked.length > 0
        ? { first: booked[booked.length - 1]?.bookingDate, last: booked[0]?.bookingDate }
        : null,
    })

    let imported = 0
    let skipped = 0
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
      } catch (err: any) {
        // Drizzle wraps postgres.js errors — PG error code is on err.cause.code
        const pgCode = err?.cause?.code ?? err?.code
        const isDedup = pgCode === "23505" // PostgreSQL unique_violation
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

    // Update rate limit counters
    await db
      .update(accounts)
      .set({
        syncCallsToday: callsToday + 1,
        syncCallsDate: today,
        lastSyncAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    // Update connection lastSyncAt
    await db
      .update(bankConnections)
      .set({ lastSyncAt: new Date() })
      .where(eq(bankConnections.id, account.connectionId))

    log.info("account.sync.completed", { accountId, fetched: booked.length, imported, skipped })
    return { imported, total: booked.length }
  })

export const deleteConnection = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: connectionId }) => {
    await db.delete(bankConnections).where(eq(bankConnections.id, connectionId))
    log.info("bank.connection.deleted", { connectionId })
  })
