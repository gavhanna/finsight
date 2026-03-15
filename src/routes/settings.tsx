import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getSettings, saveSettings } from "../server/fn/settings"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: () => getSettings(),
})

function SettingsPage() {
  const settings = Route.useLoaderData()

  const [formData, setFormData] = useState({
    gocardless_secret_id: settings["gocardless_secret_id"] ?? "",
    gocardless_secret_key: settings["gocardless_secret_key"] ?? "",
    ollama_url: settings["ollama_url"] ?? "",
    ollama_model: settings["ollama_model"] ?? "llama3",
  })

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaved(false)
    try {
      await saveSettings({ data: formData })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message ?? "Failed to save settings")
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <form onSubmit={handleSave} className="space-y-8">
        {/* GoCardless */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">GoCardless Bank Account Data</h2>
            <p className="text-sm text-muted-foreground">
              API credentials for importing bank transactions.{" "}
              <a
                href="https://bankaccountdata.gocardless.com/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Get credentials
              </a>
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Secret ID</label>
              <input
                type="text"
                value={formData.gocardless_secret_id}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    gocardless_secret_id: e.target.value,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="your-secret-id"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Secret Key</label>
              <input
                type="password"
                value={formData.gocardless_secret_key}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    gocardless_secret_key: e.target.value,
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="your-secret-key"
              />
            </div>
          </div>
        </section>

        {/* Ollama */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Ollama (Optional)</h2>
            <p className="text-sm text-muted-foreground">
              Local LLM for improved transaction categorisation. Leave blank to
              disable.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">
                Ollama URL
              </label>
              <input
                type="url"
                value={formData.ollama_url}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, ollama_url: e.target.value }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="http://localhost:11434"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Model</label>
              <input
                type="text"
                value={formData.ollama_model}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, ollama_model: e.target.value }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="llama3"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Settings
          </button>
          {saved && (
            <p className="text-sm text-green-600">Settings saved!</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </form>
    </div>
  )
}
