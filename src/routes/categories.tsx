import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import {
  getCategoriesWithRules, createCategory, getCategoryGroups,
} from "../server/fn/categories"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GroupsSection } from "@/components/categories/groups-section"
import { NewCategoryForm } from "@/components/categories/new-category-form"
import { CategoryTable } from "@/components/categories/category-table"

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
  loader: async () => {
    const [categories, groups] = await Promise.all([getCategoriesWithRules(), getCategoryGroups()])
    return { categories, groups }
  },
})

function CategoriesPage() {
  const { categories, groups } = Route.useLoaderData()
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  function refresh() { router.invalidate() }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage spending categories. Add keyword rules under <strong>Rules</strong>.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4" />
          New
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
