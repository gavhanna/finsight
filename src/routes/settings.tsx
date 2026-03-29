import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  getSettings,
  saveSettings,
  getOllamaModels,
} from "../server/fn/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "PLN", label: "PLN — Polish Zloty" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
];

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  loader: () => getSettings(),
});

function SettingsPage() {
  const settings = Route.useLoaderData();

  const [formData, setFormData] = useState({
    gocardless_secret_id: settings["gocardless_secret_id"] ?? "",
    gocardless_secret_key: settings["gocardless_secret_key"] ?? "",
    ollama_url: settings["ollama_url"] ?? "",
    ollama_model: settings["ollama_model"] ?? "llama3",
    preferred_currency: settings["preferred_currency"] ?? "EUR",
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  async function handleFetchModels() {
    if (!formData.ollama_url) return;
    setFetchingModels(true);
    setModelFetchError(null);
    const result = await getOllamaModels({ data: formData.ollama_url });
    setFetchingModels(false);
    if (result.error) {
      setModelFetchError(result.error);
    } else {
      setOllamaModels(result.models);
      // If current model isn't in the list, keep it as a manual entry
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      await saveSettings({ data: formData });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Failed to save settings");
    }
  };

  return (
    <div className="p-4 sm:p-6  mx-auto w-full space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Settings</h1>

      <form onSubmit={handleSave} className="space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">
              GoCardless Bank Account Data
            </h2>
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
            <div className="space-y-1.5">
              <Label htmlFor="secret-id">Secret ID</Label>
              <Input
                className="max-w-xl"
                id="secret-id"
                type="text"
                value={formData.gocardless_secret_id}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    gocardless_secret_id: e.target.value,
                  }))
                }
                placeholder="your-secret-id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">Secret Key</Label>
              <Input
                className="max-w-xl"
                id="secret-key"
                type="password"
                value={formData.gocardless_secret_key}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    gocardless_secret_key: e.target.value,
                  }))
                }
                placeholder="your-secret-key"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Ollama (Optional)</h2>
            <p className="text-sm text-muted-foreground">
              Local LLM for improved transaction categorisation. Leave blank to
              disable.
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ollama-url">Ollama URL</Label>
              <Input
                className="max-w-xl"
                id="ollama-url"
                type="url"
                value={formData.ollama_url}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, ollama_url: e.target.value }))
                }
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ollama-model">Model</Label>
              <div className="flex max-w-xl gap-2">
                {ollamaModels.length > 0 ? (
                  <Select
                    value={formData.ollama_model}
                    onValueChange={(v) =>
                      v
                        ? setFormData((f) => ({ ...f, ollama_model: v }))
                        : undefined
                    }
                  >
                    <SelectTrigger id="ollama-model" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="ollama-model"
                    type="text"
                    className="flex-1"
                    value={formData.ollama_model}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        ollama_model: e.target.value,
                      }))
                    }
                    placeholder="llama3"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!formData.ollama_url || fetchingModels}
                  onClick={handleFetchModels}
                  title="Fetch available models from Ollama"
                >
                  <RefreshCw
                    className={cn("size-4", fetchingModels && "animate-spin")}
                  />
                </Button>
              </div>
              {modelFetchError && (
                <p className="text-xs text-destructive">{modelFetchError}</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Display</h2>
            <p className="text-sm text-muted-foreground">
              Formatting preferences for amounts and values.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferred-currency">Currency</Label>
            <Select
              value={formData.preferred_currency}
              onValueChange={(v) =>
                v
                  ? setFormData((f) => ({ ...f, preferred_currency: v }))
                  : undefined
              }
            >
              <SelectTrigger id="preferred-currency" className="max-w-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit">Save Settings</Button>
          {saved && <p className="text-sm text-positive">Settings saved!</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </div>
  );
}
