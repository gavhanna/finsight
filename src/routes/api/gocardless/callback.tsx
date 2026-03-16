import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { completeConnection } from "../../../server/fn/accounts"
import { log } from "../../../lib/logger.server"

export const Route = createFileRoute("/api/gocardless/callback")({
  validateSearch: z.object({ ref: z.string().optional() }),
  loader: async ({ location }) => {
    const ref = new URL(
      location.href,
      process.env["APP_URL"] ?? "http://localhost:3000",
    ).searchParams.get("ref")

    if (!ref) {
      throw redirect({ to: "/accounts", search: { error: "missing-ref" } })
    }

    try {
      await completeConnection({ data: ref })
      throw redirect({ to: "/accounts", search: { connected: "true" } })
    } catch (err: any) {
      if (err?.isRedirect || err instanceof Response) throw err
      log.error("gocardless.callback.error", { requisitionId: ref, error: err?.message })
      const error = err?.message?.includes("credentials") ? "credentials" : "connection"
      throw redirect({ to: "/accounts", search: { error } })
    }
  },
  component: () => <div>Redirecting…</div>,
})
