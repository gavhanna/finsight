import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getInstitutionsList, initiateConnection } from "@/server/fn/accounts"
import type { GoCardlessInstitution } from "@/server/services/gocardless.server"

export function InstitutionPickerBody({ onClose: _onClose }: { onClose: () => void }) {
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
      window.location.assign(link)
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
