import type { Category } from "../../db/schema"

interface OllamaRequest {
  model: string
  prompt: string
  stream: false
}

interface OllamaResponse {
  response: string
}

export async function categoriseWithOllama(
  transaction: {
    description?: string | null
    creditorName?: string | null
    debtorName?: string | null
    amount: number
  },
  categories: Category[],
  ollamaUrl: string,
  model = "llama3",
): Promise<string | null> {
  const categoryNames = categories.map((c) => c.name).join(", ")
  const payee =
    transaction.creditorName || transaction.debtorName || transaction.description || "Unknown"
  const desc = transaction.description || ""

  const prompt = `You are a bank transaction categoriser. Given the following transaction details, respond with ONLY the category name from the list, nothing else.

Categories: ${categoryNames}

Transaction:
- Payee: ${payee}
- Description: ${desc}
- Amount: ${transaction.amount > 0 ? "credit" : "debit"} ${Math.abs(transaction.amount)}

Category:`

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      } satisfies OllamaRequest),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) return null

    const data = (await response.json()) as OllamaResponse
    const rawCategory = data.response?.trim()

    const match = categories.find(
      (c) => c.name.toLowerCase() === rawCategory?.toLowerCase(),
    )
    return match?.name ?? null
  } catch {
    return null
  }
}
