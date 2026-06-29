import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { accounts, bankConnections, balanceHistory, settings, transactions } from "../../db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"
import {
  createRequisition,
  getRequisition,
  getAccountDetails,
  getInstitutions,
} from "../services/gocardless.server"
import { syncAccountById } from "../services/sync.server"
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
    return syncAccountById(accountId)
  })

export const deleteConnection = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: connectionId }) => {
    await db.delete(bankConnections).where(eq(bankConnections.id, connectionId))
    log.info("bank.connection.deleted", { connectionId })
  })

export const initiateReconnection = createServerFn()
  .inputValidator(z.object({
    connectionId: z.string(),
    institutionId: z.string(),
    institutionName: z.string(),
    institutionLogo: z.string().optional(),
  }))
  .handler(async ({ data: { connectionId, institutionId, institutionName, institutionLogo } }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")

    const baseUrl = process.env["APP_URL"] ?? "http://localhost:3000"
    const redirectUrl = `${baseUrl}/api/gocardless/callback?replaces=${connectionId}`
    log.info("bank.reconnection.initiating", { connectionId, institutionId })
    const requisition = await createRequisition(secretId, secretKey, institutionId, redirectUrl)

    await db.insert(bankConnections).values({
      id: requisition.id,
      institutionId,
      institutionName,
      institutionLogo: institutionLogo ?? null,
      status: "CREATED",
      agreementId: requisition.agreement,
    })

    log.info("bank.reconnection.initiated", { oldConnectionId: connectionId, newRequisitionId: requisition.id })
    return { link: requisition.link }
  })

export const completeReconnection = createServerFn()
  .inputValidator(z.object({ newRequisitionId: z.string(), oldConnectionId: z.string() }))
  .handler(async ({ data: { newRequisitionId, oldConnectionId } }) => {
    const { secretId, secretKey } = await getCredentials()
    if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured")

    const requisition = await getRequisition(secretId, secretKey, newRequisitionId)

    await db
      .update(bankConnections)
      .set({ status: "LINKED" })
      .where(eq(bankConnections.id, newRequisitionId))

    const oldAccounts = await db.select().from(accounts).where(eq(accounts.connectionId, oldConnectionId))

    for (const newAccountId of requisition.accounts ?? []) {
      const details = await getAccountDetails(secretId, secretKey, newAccountId)

      // Insert new account first so FK constraints are satisfied before migrating rows
      await db.insert(accounts).values({
        id: newAccountId,
        connectionId: newRequisitionId,
        iban: details.iban ?? null,
        name: details.name ?? null,
        currency: details.currency ?? null,
        ownerName: details.ownerName ?? null,
      }).onConflictDoNothing()

      const matched = oldAccounts.find(
        (a) => a.iban && details.iban && a.iban === details.iban,
      )

      if (matched) {
        await db.update(transactions).set({ accountId: newAccountId }).where(eq(transactions.accountId, matched.id))
        await db.update(balanceHistory).set({ accountId: newAccountId }).where(eq(balanceHistory.accountId, matched.id))
        await db.delete(accounts).where(eq(accounts.id, matched.id))
        log.info("bank.reconnection.account_migrated", { oldAccountId: matched.id, newAccountId, iban: matched.iban })
      } else {
        log.warn("bank.reconnection.no_iban_match", { newAccountId, iban: details.iban })
      }
    }

    // Old connection may now be empty; delete it (cascade removes any unmatched accounts/history)
    await db.delete(bankConnections).where(eq(bankConnections.id, oldConnectionId))
    log.info("bank.reconnection.completed", { oldConnectionId, newRequisitionId })
  })
