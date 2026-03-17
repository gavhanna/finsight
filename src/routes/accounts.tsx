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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export const Route = createFileRoute("/accounts")({
  validateSearch: z.object({
    connected: z.coerce.boolean().optional(),
    error: z.string().optional(),
  }),
  component: AccountsPage,
  loader: () => getConnections(),
})

const STATUS_CLASSES: Record<string, string> = {
  LINKED: "bg-green-100 text-green-700 hover:bg-green-100",
  EXPIRED: "bg-red-100 text-red-700 hover:bg-red-100",
}

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
      showToast(
        result.total === 0
          ? "Sync complete — no transactions returned from bank."
          : `Synced ${result.imported} new of ${result.total} transactions returned.`
      )
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
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-2xl font-semibold">Bank Accounts</h1>
        <Button onClick={() => setShowPicker(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Bank</span>
          <span className="sm:hidden">Connect</span>
        </Button>
      </div>

      {connected && (
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Bank connected successfully!</AlertDescription>
        </Alert>
      )}
      {errorParam && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Connection error: {errorParam}</AlertDescription>
        </Alert>
      )}

      {toast && (
        <Alert variant={toast.type === "err" ? "destructive" : "default"} className="mb-4 relative pr-10">
          {toast.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{toast.msg}</AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6"
            onClick={() => setToast(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
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
            <Card key={conn.id}>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
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
                      <Badge
                        variant="outline"
                        className={STATUS_CLASSES[conn.status] ?? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}
                      >
                        {conn.status}
                      </Badge>
                      {conn.lastSyncAt && (
                        <span className="text-xs text-muted-foreground">
                          Last sync: {formatDate(conn.lastSyncAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(conn.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remove connection"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>

              {conn.accounts.length > 0 && (
                <CardContent className="pt-0">
                  <div className="ml-11 space-y-2">
                    {conn.accounts.map((acc) => {
                      const callsToday = acc.syncCallsDate === today ? acc.syncCallsToday : 0
                      const atLimit = callsToday >= 4
                      return (
                        <div key={acc.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{acc.name ?? acc.iban ?? acc.id}</p>
                            <p className="text-xs text-muted-foreground">
                              {acc.iban && <span className="mr-2">{acc.iban}</span>}
                              {acc.currency && <span>{acc.currency}</span>}
                              {acc.lastSyncAt && (
                                <span className="ml-2">· Last synced {formatDate(acc.lastSyncAt)}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {atLimit && (
                              <span className="text-xs text-amber-600 font-medium">Rate limit reached</span>
                            )}
                            {!atLimit && (
                              <span className="text-xs text-muted-foreground">{callsToday}/4 syncs</span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(acc.id)}
                              disabled={syncing === acc.id || atLimit}
                              className="h-7 text-xs"
                            >
                              <RefreshCw className={`h-3 w-3 ${syncing === acc.id ? "animate-spin" : ""}`} />
                              {syncing === acc.id ? "Syncing…" : "Sync"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="flex flex-col max-h-[90vh] sm:max-h-[80vh] p-0 gap-0 sm:max-w-lg">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle>Connect a Bank</DialogTitle>
          </DialogHeader>
          <InstitutionPickerBody onClose={() => setShowPicker(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InstitutionPickerBody({ onClose: _onClose }: { onClose: () => void }) {
  const [country, setCountry] = useState("IE")
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
    <>
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        <div className="flex gap-2">
          <Select value={country} onValueChange={(v) => v && setCountry(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GB">UK</SelectItem>
              <SelectItem value="IE">Ireland</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="FR">France</SelectItem>
              <SelectItem value="ES">Spain</SelectItem>
              <SelectItem value="NL">Netherlands</SelectItem>
              <SelectItem value="SE">Sweden</SelectItem>
              <SelectItem value="NO">Norway</SelectItem>
              <SelectItem value="DK">Denmark</SelectItem>
              <SelectItem value="FI">Finland</SelectItem>
            </SelectContent>
          </Select>
          <Button className="flex-1" onClick={loadInstitutions} disabled={loading}>
            {loading ? "Loading…" : institutions.length ? "Reload" : "Load Banks"}
          </Button>
        </div>
        {institutions.length > 0 && (
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search banks…"
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
        <div className="border-t px-4 py-3 text-sm text-muted-foreground flex-shrink-0">
          Redirecting to bank…
        </div>
      )}
    </>
  )
}
