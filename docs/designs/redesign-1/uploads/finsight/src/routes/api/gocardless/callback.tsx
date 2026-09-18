import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { completeConnection, completeReconnection } from "../../../server/fn/accounts"

export const Route = createFileRoute("/api/gocardless/callback")({
  validateSearch: z.object({ ref: z.string().optional(), replaces: z.string().optional() }),
  loader: async ({ location }) => {
    const url = new URL(location.href, process.env["APP_URL"] ?? "http://localhost:3000")
    const ref = url.searchParams.get("ref")
    const replaces = url.searchParams.get("replaces")

    if (!ref) {
      throw redirect({ to: "/accounts", search: { error: "missing-ref" } })
    }

    try {
      if (replaces) {
        await completeReconnection({ data: { newRequisitionId: ref, oldConnectionId: replaces } })
      } else {
        await completeConnection({ data: ref })
      }
      throw redirect({ to: "/accounts", search: { connected: "true" } })
    } catch (err) {
      if (err && (typeof err === "object") && ("isRedirect" in err || err instanceof Response)) throw err
      const msg = err instanceof Error ? err.message : ""
      const error = msg.includes("credentials") ? "credentials" : "connection"
      throw redirect({ to: "/accounts", search: { error } })
    }
  },
  component: () => <div>Redirecting…</div>,
})
