import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { completeConnection } from "../../../server/fn/accounts"

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
      console.error("Callback error:", err)
      const error = err?.message?.includes("credentials") ? "credentials" : "connection"
      throw redirect({ to: "/accounts", search: { error } })
    }
  },
  component: () => <div>Redirecting…</div>,
})
