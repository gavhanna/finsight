import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import {
  getConnections,
  getInstitutionsList,
  initiateConnection,
  syncAccount,
  deleteConnection,
} from "../server/fn/accounts"
import type { GoCardlessInstitution } from "../server/services/gocardless.server"
import { formatDate } from "../lib/utils"
import { Building2, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle, X } from "lucide-react"
import { z } from "zod"

export const Route = createFileRoute("/accounts")({
  validateSearch: z.object({
    connected: z.coerce.boolean().optional(),
    error: z.string().optional(),
  }),
  component: AccountsPage,
  loader: () => getConnections(),
})

function AccountsPage() {
  const connections = Route.useLoaderData()
  const { connected, error: errorParam } = Route.useSearch()
  const router = useRouter()
  const [showPicker, setShowPicker] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null)

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSync(accountId: string) {
    setSyncing(accountId)
    try {
      const result = await syncAccount({ data: accountId })
      showToast(`Synced ${result.imported} new transactions.`)
      router.invalidate()
    } catch (err: any) {
      showToast(err.message ?? "Sync failed", "err")
    } finally {
      setSyncing(null)
    }
  }

  async function handleDelete(connectionId: string) {
    if (!confirm("Delete this bank connection and all its transactions?")) return
    await deleteConnection({ data: connectionId })
    router.invalidate()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Bank Accounts</h1>
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Connect Bank
        </button>
      </div>

      {/* Notifications */}
      {(connected || errorParam) && (
        <div className={`mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-sm ${connected ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {connected ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {connected ? "Bank connected successfully!" : `Connection error: ${errorParam}`}
        </div>
      )}

      {toast && (
        <div className={`mb-4 flex items-center justify-between gap-2 rounded-md px-4 py-3 text-sm ${toast.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)}><X className="h-3 w-3" /></button>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No bank connections yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Click "Connect Bank" to link your first account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <div key={conn.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {conn.institutionLogo ? (
                    <img src={conn.institutionLogo} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{conn.institutionName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${conn.status === "LINKED" ? "bg-green-100 text-green-700" : conn.status === "EXPIRED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {conn.status}
                      </span>
                      {conn.lastSyncAt && (
                        <span className="text-xs text-muted-foreground">
                          Last sync: {formatDate(conn.lastSyncAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(conn.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="Remove connection"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {conn.accounts.length > 0 && (
                <div className="ml-11 space-y-2">
                  {conn.accounts.map((acc) => {
                    const callsToday = acc.syncCallsDate === today ? acc.syncCallsToday : 0
                    const atLimit = callsToday >= 4
                    return (
                      <div key={acc.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{acc.name ?? acc.iban ?? acc.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {acc.iban && <span className="mr-2">{acc.iban}</span>}
                            {acc.currency && <span>{acc.currency}</span>}
                            {acc.lastSyncAt && (
                              <span className="ml-2">· Last synced {formatDate(acc.lastSyncAt)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {atLimit && (
                            <span className="text-xs text-amber-600 font-medium">Rate limit reached</span>
                          )}
                          {!atLimit && (
                            <span className="text-xs text-muted-foreground">{callsToday}/4 syncs</span>
                          )}
                          <button
                            onClick={() => handleSync(acc.id)}
                            disabled={syncing === acc.id || atLimit}
                            className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`h-3 w-3 ${syncing === acc.id ? "animate-spin" : ""}`} />
                            {syncing === acc.id ? "Syncing…" : "Sync"}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPicker && <InstitutionPicker onClose={() => setShowPicker(false)} />}
    </div>
  )
}

function InstitutionPicker({ onClose }: { onClose: () => void }) {
  const [country, setCountry] = useState("GB")
  const [search, setSearch] = useState("")
  const [institutions, setInstitutions] = useState<GoCardlessInstitution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [connecting, setConnecting] = useState(false)

  async function loadInstitutions() {
    setLoading(true)
    setError("")
    try {
      const list = await getInstitutionsList({ data: country })
      setInstitutions(list)
    } catch (err: any) {
      setError(err.message ?? "Failed to load institutions")
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(inst: GoCardlessInstitution) {
    setConnecting(true)
    try {
      const { link } = await initiateConnection({
        data: {
          institutionId: inst.id,
          institutionName: inst.name,
          institutionLogo: inst.logo,
        },
      })
      window.location.href = link
    } catch (err: any) {
      setError(err.message ?? "Failed to initiate connection")
      setConnecting(false)
    }
  }

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Connect a Bank</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="GB">UK</option>
              <option value="IE">Ireland</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="ES">Spain</option>
              <option value="NL">Netherlands</option>
              <option value="SE">Sweden</option>
              <option value="NO">Norway</option>
              <option value="DK">Denmark</option>
              <option value="FI">Finland</option>
            </select>
            <button
              onClick={loadInstitutions}
              disabled={loading}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading…" : institutions.length ? "Reload" : "Load Banks"}
            </button>
          </div>
          {institutions.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search banks…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {filtered.map((inst) => (
            <button
              key={inst.id}
              onClick={() => handleSelect(inst)}
              disabled={connecting}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              {inst.logo ? (
                <img src={inst.logo} alt="" className="h-8 w-8 rounded object-contain flex-shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
              )}
              <span className="font-medium">{inst.name}</span>
            </button>
          ))}
          {institutions.length > 0 && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No banks found.</p>
          )}
        </div>

        {connecting && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            Redirecting to bank…
          </div>
        )}
      </div>
    </div>
  )
}
