import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { getConnections, syncAccount, deleteConnection } from "../server/fn/accounts"
import { formatDate } from "@/lib/utils"
import { Building2, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle, X } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InstitutionPickerBody } from "@/components/accounts/institution-picker"

export const Route = createFileRoute("/accounts")({
  validateSearch: z.object({
    connected: z.coerce.boolean().optional(),
    error: z.string().optional(),
  }),
  component: AccountsPage,
  loader: () => getConnections(),
})

const STATUS_CLASSES: Record<string, string> = {
  LINKED: "bg-positive-muted text-positive hover:bg-positive-muted",
  EXPIRED: "bg-negative-muted text-negative hover:bg-negative-muted",
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Bank Accounts</h1>
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
          <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-6 w-6" onClick={() => setToast(null)}>
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
                        <span className="text-xs text-muted-foreground">Last sync: {formatDate(conn.lastSyncAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
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
                              {acc.lastSyncAt && <span className="ml-2">· Last synced {formatDate(acc.lastSyncAt)}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {atLimit && <span className="text-xs text-amber-600 font-medium">Rate limit reached</span>}
                            {!atLimit && <span className="text-xs text-muted-foreground">{callsToday}/4 syncs</span>}
                            <Button
                              variant="outline" size="sm"
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
