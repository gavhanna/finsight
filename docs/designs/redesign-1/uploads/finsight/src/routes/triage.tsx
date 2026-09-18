import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { getTransactionsForTriage } from "../server/fn/transactions"
import { getCategories, getAllRules } from "../server/fn/categories"
import type { Transaction } from "../db/schema"
import { CategoryPicker } from "@/components/triage/category-picker"
import { TriageFlow } from "@/components/triage/triage-flow"

export const Route = createFileRoute("/triage")({
  component: TriagePage,
  loader: async () => {
    const [categories, rules] = await Promise.all([getCategories(), getAllRules()])
    return { categories, rules }
  },
})

function TriagePage() {
  const { categories, rules } = Route.useLoaderData()

  type Phase =
    | { type: "picking" }
    | { type: "loading"; categoryId: number | null }
    | { type: "triaging"; categoryId: number | null; queue: Transaction[]; index: number; doneCount: number }

  const [phase, setPhase] = useState<Phase>({ type: "picking" })

  async function selectCategory(categoryId: number | null) {
    setPhase({ type: "loading", categoryId })
    const txns = await getTransactionsForTriage({ data: { categoryId } })
    setPhase({ type: "triaging", categoryId, queue: txns, index: 0, doneCount: 0 })
  }

  if (phase.type === "picking") {
    return <CategoryPicker categories={categories} onSelect={selectCategory} />
  }

  if (phase.type === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TriageFlow
      categoryId={phase.categoryId}
      initialQueue={phase.queue}
      initialDoneCount={phase.doneCount}
      categories={categories}
      rules={rules}
      onBack={() => setPhase({ type: "picking" })}
    />
  )
}
