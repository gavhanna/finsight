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

function formatPeriod(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom || !dateTo) return "the selected period"

  const from = new Date(dateFrom)
  const to = new Date(dateTo)

  const fromMonth = from.toLocaleString("en-GB", { month: "long", year: "numeric" })
  const toMonth = to.toLocaleString("en-GB", { month: "long", year: "numeric" })

  // Same month
  if (fromMonth === toMonth) return fromMonth

  // Same year, different months
  if (from.getFullYear() === to.getFullYear()) {
    const f = from.toLocaleString("en-GB", { month: "long" })
    const t = to.toLocaleString("en-GB", { month: "long", year: "numeric" })
    return `${f}–${t}`
  }

  return `${fromMonth}–${toMonth}`
}

export async function generateFinancialNarrative(
  input: NarrativeInput,
  ollamaUrl: string,
  model = "llama3",
): Promise<string | null> {
  const period = formatPeriod(input.dateFrom, input.dateTo)
  const today = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })

  const topCats = input.topCategories
    .slice(0, 5)
    .map((c) => {
      const pct = input.totalExpenses > 0 ? (c.total / input.totalExpenses) * 100 : 0
      return `- ${c.name}: ${input.currency}${c.total.toFixed(2)} (${pct.toFixed(0)}% of spend)`
    })
    .join("\n")

  const deltaLines: string[] = []
  if (input.periodDelta?.income != null)
    deltaLines.push(`Income vs prior period: ${input.periodDelta.income >= 0 ? "+" : ""}${input.periodDelta.income.toFixed(1)}%`)
  if (input.periodDelta?.expenses != null)
    deltaLines.push(`Expenses vs prior period: ${input.periodDelta.expenses >= 0 ? "+" : ""}${input.periodDelta.expenses.toFixed(1)}%`)

  const prompt = `You are a personal finance assistant. Write a 2–3 sentence narrative summary of the financial data below. Follow this structure:
1. Open with the headline result — income, expenses, and whether the period ended in surplus or deficit.
2. Highlight the most significant spending category and its share of total spend. If any category seems disproportionately high, note it.
3. End with one concrete observation or implication — e.g. savings progress, a notable trend vs the prior period, or something actionable.

Rules:
- Be specific: use the actual numbers and percentages provided.
- Do not pad with generic advice ("consider budgeting…").
- Do not start the response with "In" or repeat the period label back verbatim.
- Plain prose only — no markdown, bullet points, or headers.

Today's date: ${today}
Period being analysed: ${period}
Total income: ${input.currency}${input.totalIncome.toFixed(2)}
Total expenses: ${input.currency}${input.totalExpenses.toFixed(2)}
Net: ${input.currency}${input.net.toFixed(2)} (${input.net >= 0 ? "surplus" : "deficit"})
${input.savingsRate != null ? `Savings rate: ${input.savingsRate.toFixed(0)}%` : ""}
${deltaLines.length > 0 ? deltaLines.join("\n") : ""}

Top spending categories (by amount):
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
