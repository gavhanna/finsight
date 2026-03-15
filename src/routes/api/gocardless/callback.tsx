import { createFileRoute, redirect } from "@tanstack/react-router"
import { db } from "../../../db"
import { bankConnections, accounts, settings } from "../../../db/schema"
import { eq } from "drizzle-orm"
import {
  getRequisition,
  getAccountDetails,
} from "../../../server/services/gocardless"
import { z } from "zod"

export const Route = createFileRoute("/api/gocardless/callback")({
  validateSearch: z.object({ ref: z.string().optional() }),
  loader: async ({ location }) => {
    const ref = new URL(
      location.href,
      "http://localhost:3000",
    ).searchParams.get("ref")

    if (!ref) {
      throw redirect({ to: "/accounts", search: { error: "missing-ref" } })
    }

    const settingRows = await db.select().from(settings)
    const map: Record<string, string | null> = {}
    for (const r of settingRows) map[r.key] = r.value

    const secretId = map["gocardless_secret_id"] ?? ""
    const secretKey = map["gocardless_secret_key"] ?? ""

    if (!secretId || !secretKey) {
      throw redirect({ to: "/accounts", search: { error: "credentials" } })
    }

    try {
      const requisition = await getRequisition(secretId, secretKey, ref)

      await db
        .update(bankConnections)
        .set({ status: "LINKED" })
        .where(eq(bankConnections.id, ref))

      for (const accountId of requisition.accounts ?? []) {
        const details = await getAccountDetails(secretId, secretKey, accountId)
        await db
          .insert(accounts)
          .values({
            id: accountId,
            connectionId: ref,
            iban: (details as any).iban ?? null,
            name: (details as any).name ?? null,
            currency: (details as any).currency ?? null,
            ownerName: (details as any).ownerName ?? null,
          })
          .onConflictDoNothing()
      }

      throw redirect({ to: "/accounts", search: { connected: true } })
    } catch (err) {
      if (err instanceof Response || (err as any)?.statusCode) throw err
      console.error("Callback error:", err)
      throw redirect({ to: "/accounts", search: { error: "connection" } })
    }
  },
  component: () => <div>Redirecting…</div>,
})
