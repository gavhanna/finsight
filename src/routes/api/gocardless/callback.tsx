import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { completeConnection, completeReconnection } from "../../../server/fn/accounts"

export const Route = createFileRoute("/api/gocardless/callback")({
  validateSearch: z.object({ ref: z.string().optional(), replaces: z.string().optional() }),
  loader: async ({ location }) => {
    const url = new URL(location.href, process.env["APP_URL"] ?? "http://localhost:3000")
    const ref = url.searchParams.get("ref")
    const replaces = url.searchParams.get("replaces")

    console.log("[gocardless/callback] params received", { ref, replaces, href: location.href })

    if (!ref) {
      throw redirect({ to: "/accounts", search: { error: "missing-ref" } })
    }

    try {
      if (replaces) {
        console.log("[gocardless/callback] routing to completeReconnection", { ref, replaces })
        await completeReconnection({ data: { newRequisitionId: ref, oldConnectionId: replaces } })
      } else {
        console.log("[gocardless/callback] routing to completeConnection", { ref })
        await completeConnection({ data: ref })
      }
      throw redirect({ to: "/accounts", search: { connected: "true" } })
    } catch (err: any) {
      if (err?.isRedirect || err instanceof Response) throw err
      const error = err?.message?.includes("credentials") ? "credentials" : "connection"
      throw redirect({ to: "/accounts", search: { error } })
    }
  },
  component: () => <div>Redirecting…</div>,
})
