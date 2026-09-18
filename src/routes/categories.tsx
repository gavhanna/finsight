import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import {
  getCategoriesWithRules, createCategory, getCategoryGroups,
} from "../server/fn/categories"
import { Plus } from "lucide-react"
import { withOfflineCache } from "@/lib/loader-cache"
import { PageHelp } from "@/components/ui/page-help"
import { Button } from "@/components/ui/button"
import { GroupsSection } from "@/components/categories/groups-section"
import { NewCategoryForm } from "@/components/categories/new-category-form"
import { CategoryTable } from "@/components/categories/category-table"

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: () =>
    withOfflineCache("categories", async () => {
      const [categories, groups] = await Promise.all([getCategoriesWithRules(), getCategoryGroups()])
      return { categories, groups }
    }),
})

function CategoriesPage() {
  const { categories, groups } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  function refresh() { router.invalidate() }

  return (
    <div className="console-page flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="section-label">Setup</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
            <PageHelp title="Categories">
              <p>Categories are the labels you assign to transactions — e.g. Groceries, Transport, Dining Out.</p>
              <p><strong className="text-foreground">Groups</strong> — optionally organise categories into groups (e.g. "Living Costs") for rolled-up reporting in charts.</p>
              <p><strong className="text-foreground">Colour</strong> — each category has a colour used in charts and throughout the app.</p>
              <p>Head to <strong className="text-foreground">Rules</strong> to set up automatic matching so transactions are categorised on import.</p>
            </PageHelp>
          </div>
          <p className="text-sm text-muted-foreground">
            The labels behind every report. Add matching logic under <strong className="text-foreground">Rules</strong>.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus data-icon="inline-start" />
          New category
        </Button>
      </div>

      <GroupsSection groups={groups} categories={categories} onRefresh={refresh} />

      {showNew && (
        <NewCategoryForm
          onSave={async (data) => {
            await createCategory({ data })
            setShowNew(false)
            refresh()
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      <CategoryTable rawCategories={categories} groups={groups} onRefresh={refresh} />
    </div>
  )
}
