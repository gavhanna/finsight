import { createFileRoute, Link } from "@tanstack/react-router"
import {
  BarChart3,
  CalendarDays,
  ChartSpline,
  CircleDollarSign,
  Gauge,
  Lightbulb,
  Repeat,
  ScanSearch,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
})

const analyses = [
  { to: "/comparison", title: "Monthly comparison", description: "Compare income, spending, and net movement across months.", icon: BarChart3, featured: true },
  { to: "/category-trends", title: "Category trends", description: "See which areas are changing and what is driving the movement.", icon: ChartSpline, featured: true },
  { to: "/recurring", title: "Recurring costs", description: "Understand committed monthly spend and upcoming charges.", icon: Repeat, featured: true },
  { to: "/merchants", title: "Merchants", description: "Find the payees receiving the most money and inspect their history.", icon: Store, featured: false },
  { to: "/analytics/savings-rate", title: "Savings rate", description: "Track how much income you keep from month to month.", icon: TrendingUp, featured: false },
  { to: "/analytics/forecast", title: "Forecast", description: "Project net worth from recent balance and cash-flow trends.", icon: ScanSearch, featured: false },
  { to: "/analytics/what-if", title: "What if?", description: "Model the effect of spending changes on future savings.", icon: Lightbulb, featured: false },
  { to: "/analytics/cash-flow-calendar", title: "Cash calendar", description: "See income, spending, and expected debits on a calendar.", icon: CalendarDays, featured: false },
  { to: "/analytics/patterns", title: "Spending patterns", description: "Inspect spending by weekday and point in the month.", icon: Gauge, featured: false },
  { to: "/analytics/discretionary", title: "Discretionary spend", description: "Separate flexible spending from recurring commitments.", icon: ShoppingBag, featured: false },
  { to: "/analytics/inflation", title: "Personal inflation", description: "Measure how your category costs have changed year over year.", icon: CircleDollarSign, featured: false },
] as const

function ExplorePage() {
  return (
    <div className="console-page flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="section-label">Explore</p>
        <h1 className="text-2xl font-semibold tracking-tight">Answers, not dashboards</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose the question you want to answer. Each analysis keeps the filters and detail already available in FinSight.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-label">Start here</h2>
          <Badge variant="secondary">Most useful this month</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {analyses.filter((analysis) => analysis.featured).map((analysis) => (
            <AnalysisCard key={analysis.to} analysis={analysis} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">All analyses</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {analyses.filter((analysis) => !analysis.featured).map((analysis) => (
            <AnalysisCard key={analysis.to} analysis={analysis} />
          ))}
        </div>
      </section>
    </div>
  )
}

function AnalysisCard({ analysis }: { analysis: (typeof analyses)[number] }) {
  const Icon = analysis.icon
  return (
    <Link to={analysis.to} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors group-hover:bg-accent/60">
        <CardHeader>
          <CardTitle>{analysis.title}</CardTitle>
          <CardDescription>{analysis.description}</CardDescription>
          <CardAction className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <span className="text-xs font-medium text-primary">Open analysis &rsaquo;</span>
        </CardContent>
      </Card>
    </Link>
  )
}
