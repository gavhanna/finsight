import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useState } from "react"
import { CategoryPicker } from "@/components/triage/category-picker"
import { TriageFlow } from "@/components/triage/triage-flow"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Transaction } from "@/db/schema"
import { cn } from "@/lib/utils"
import { getAllRules, getCategories } from "@/server/fn/categories"
import { getTransactionsForTriage } from "@/server/fn/transactions"

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
    | {
        type: "triaging"
        categoryId: number | null
        queue: Transaction[]
        doneCount: number
      }

  const [phase, setPhase] = useState<Phase>({ type: "picking" })

  async function selectCategory(categoryId: number | null) {
    setPhase({ type: "loading", categoryId })
    const queue = await getTransactionsForTriage({ data: { categoryId } })
    setPhase({ type: "triaging", categoryId, queue, doneCount: 0 })
  }

  return (
    <div className="console-page flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="section-label">Transactions · review mode</p>
          <h1 className="text-2xl font-semibold tracking-tight">Focused transaction review</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose a category, then confirm or correct each transaction without leaving the queue.
          </p>
        </div>
        <Link
          to="/transactions"
          search={{ page: 1 }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to table
        </Link>
      </div>

      <Card className="min-h-[34rem] flex-1 gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Confirming a category marks the transaction reviewed. Creating a rule also handles similar future transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-0">
          {phase.type === "picking" && (
            <CategoryPicker categories={categories} onSelect={selectCategory} />
          )}
          {phase.type === "loading" && (
            <div className="flex flex-1 items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {phase.type === "triaging" && (
            <TriageFlow
              categoryId={phase.categoryId}
              initialQueue={phase.queue}
              initialDoneCount={phase.doneCount}
              categories={categories}
              rules={rules}
              onBack={() => setPhase({ type: "picking" })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
