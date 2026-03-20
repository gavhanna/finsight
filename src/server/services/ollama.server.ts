import type { Category } from "../../db/schema"

export interface NarrativeInput {
  dateFrom?: string
  dateTo?: string
  totalIncome: number
  totalExpenses: number
  net: number
  savingsRate: number | null
  topCategories: { name: string; total: number }[]
  periodDelta: { income: number | null; expenses: number | null } | null
  currency: string
}

export async function generateFinancialNarrative(
  input: NarrativeInput,
  ollamaUrl: string,
  model = "llama3",
): Promise<string | null> {
  const period = input.dateFrom && input.dateTo
    ? `${input.dateFrom} to ${input.dateTo}`
    : "the selected period"

  const topCats = input.topCategories
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.name}: ${input.currency}${c.total.toFixed(2)}`)
    .join("\n")

  const deltaLines: string[] = []
  if (input.periodDelta?.income != null)
    deltaLines.push(`Income vs prior period: ${input.periodDelta.income >= 0 ? "+" : ""}${input.periodDelta.income.toFixed(1)}%`)
  if (input.periodDelta?.expenses != null)
    deltaLines.push(`Expenses vs prior period: ${input.periodDelta.expenses >= 0 ? "+" : ""}${input.periodDelta.expenses.toFixed(1)}%`)

  const prompt = `You are a personal finance assistant. Write a concise 2-3 sentence narrative summary of the following financial data. Be specific with numbers. Highlight anything notable such as high spending categories, savings progress, or significant changes vs the prior period. Use a neutral, helpful tone. Do not use markdown, bullet points, or headers — plain prose only.

Period: ${period}
Total income: ${input.currency}${input.totalIncome.toFixed(2)}
Total expenses: ${input.currency}${input.totalExpenses.toFixed(2)}
Net: ${input.currency}${input.net.toFixed(2)} (${input.net >= 0 ? "surplus" : "deficit"})
${input.savingsRate != null ? `Savings rate: ${input.savingsRate.toFixed(0)}%` : ""}
${deltaLines.join("\n")}

Top spending categories:
${topCats}

Summary:`

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false } satisfies OllamaRequest),
      signal: AbortSignal.timeout(120000),
    })
    if (!response.ok) return null
    const data = (await response.json()) as OllamaResponse
    return data.response?.trim() ?? null
  } catch {
    return null
  }
}

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
