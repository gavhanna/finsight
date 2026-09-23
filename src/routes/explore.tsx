import { createFileRoute, useRouter } from "@tanstack/react-router"
import { BarChart3, BookmarkPlus, CalendarDays, ChartSpline, CircleDollarSign, Gauge, Lightbulb, Repeat, ScanSearch, ShoppingBag, Store, Tags } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { SaveViewDialog } from "@/components/transactions/save-view-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getSavedViews } from "@/server/fn/saved-views"

const analyses = [
  { id: "categories", path: "/category-trends", title: "Categories", description: "See where spending moved and which categories drove the change.", icon: ChartSpline, changed: "Your category mix is concentrated in the top few areas. Compare the latest month with the previous one to see whether that shift is structural or a one-off." },
  { id: "merchants", path: "/merchants", title: "Merchants", description: "Find the payees receiving the most money and inspect their history.", icon: Store, changed: "Merchant totals reveal repeated small purchases that category summaries can hide." },
  { id: "recurring", path: "/recurring", title: "Recurring", description: "Understand committed monthly spend and upcoming charges.", icon: Repeat, changed: "Committed costs set the floor for next month. Confirm uncertain detections so the forecast reflects what is genuinely fixed." },
  { id: "comparison", path: "/comparison", title: "Month comparison", description: "Compare income, spending, and net movement across months.", icon: BarChart3, changed: "The latest complete month is compared with its predecessor so changes are visible without reading every transaction." },
  { id: "savings", path: "/analytics/savings-rate", title: "Savings rate", description: "Track how much income you keep from month to month.", icon: CircleDollarSign, changed: "Savings rate connects income and spending into one durable signal; use the longer trend instead of a single month." },
  { id: "inflation", path: "/analytics/inflation", title: "Inflation impact", description: "Measure how category costs changed year over year.", icon: Tags, changed: "This isolates price and mix pressure in your own spending rather than relying on a general inflation basket." },
  { id: "forecast", path: "/analytics/forecast", title: "Forecast", description: "Project spending and net worth from current trends.", icon: ScanSearch, changed: "The projection extends your recent balance trend and separates fixed commitments from variable spending." },
  { id: "what-if", path: "/analytics/what-if", title: "What-if", description: "Model the effect of spending changes on future savings.", icon: Lightbulb, changed: "Small recurring changes compound. Adjust the scenario to compare its monthly and annual effect." },
  { id: "calendar", path: "/analytics/cash-flow-calendar", title: "Calendar heatmap", description: "See income, spending, and expected debits on a calendar.", icon: CalendarDays, changed: "Timing explains cash pressure that monthly totals miss, especially when several commitments cluster together." },
  { id: "patterns", path: "/analytics/patterns", title: "Spending patterns", description: "Inspect spending by weekday and point in the month.", icon: Gauge, changed: "The pattern view highlights when spending happens, making routines and end-of-month pressure easier to spot." },
  { id: "discretionary", path: "/analytics/discretionary", title: "Discretionary vs fixed", description: "Separate flexible spending from recurring commitments.", icon: ShoppingBag, changed: "The flexible share is the part you can change quickly; fixed costs need a longer-term decision." },
] as const

const SearchSchema = z.object({ view: z.string().default("categories") })

export const Route = createFileRoute("/explore")({
  validateSearch: SearchSchema,
  component: ExplorePage,
  loader: () => getSavedViews({ data: { scope: "explore" } }).catch(() => []),
})

function ExplorePage() {
  const savedViews = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [saveOpen, setSaveOpen] = useState(false)
  const active = analyses.find((analysis) => analysis.id === search.view) ?? analyses[0]

  return <div className="console-page flex flex-col gap-4">
    <div className="flex flex-col gap-1"><p className="section-label">Explore</p><h1 className="text-2xl font-semibold tracking-tight">One workspace for every question</h1><p className="text-sm text-muted-foreground">Move between analyses without losing the surrounding context. Saved views stay at the top.</p></div>
    <div className="grid min-h-[780px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <div><div className="mb-2 flex items-center justify-between"><p className="section-label">Your saved views</p><Button variant="ghost" size="icon-sm" aria-label="Save current view" onClick={() => setSaveOpen(true)}><BookmarkPlus /></Button></div>
          <div className="flex flex-col gap-1">{savedViews.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Save an analysis to keep it here.</p> : savedViews.map((view) => <Button key={view.id} variant="ghost" className="justify-start" onClick={() => navigate({ search: { view: String(view.definition.view ?? "categories") } })}>{view.name}</Button>)}</div>
        </div>
        <div><p className="section-label mb-2">Analyses</p><nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">{analyses.map((analysis) => { const Icon = analysis.icon; return <Button key={analysis.id} variant="ghost" className={cn("shrink-0 justify-start", active.id === analysis.id && "bg-primary/10 text-primary")} onClick={() => navigate({ search: { view: analysis.id } })}><Icon />{analysis.title}</Button> })}</nav></div>
      </aside>
      <section className="min-w-0">
        <Card className="mb-3"><CardHeader><CardTitle>{active.title}</CardTitle><CardDescription>{active.description}</CardDescription></CardHeader></Card>
        <iframe key={active.id} title={`${active.title} analysis`} src={`${active.path}?embed=1`} className="h-[1050px] w-full rounded-xl border bg-background" />
        <Card className="mt-3 border-primary/20 bg-primary/5"><CardHeader><CardTitle className="section-label">What changed</CardTitle></CardHeader><CardContent><p className="max-w-3xl text-sm leading-6 text-muted-foreground">{active.changed}</p></CardContent></Card>
      </section>
    </div>
    <SaveViewDialog scope="explore" open={saveOpen} onOpenChange={setSaveOpen} definition={{ view: active.id }} onSaved={() => router.invalidate()} />
  </div>
}
