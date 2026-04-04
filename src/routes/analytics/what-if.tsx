import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getSpendingByCategory, getTopMerchants } from "../../server/fn/insights"
import { getSetting } from "../../server/fn/settings"
import { getPresetDates } from "@/lib/presets"
import { formatCurrency, cn } from "@/lib/utils"
import { Plus, X, TrendingDown, Target, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHelp } from "@/components/ui/page-help"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from "recharts"

type CategoryItem = {
  categoryId: number | null
  categoryName: string
  categoryColor: string
  total: number
}
type MerchantItem = { name: string; total: number }

type Scenario = {
  id: string
  mode: "category" | "merchant"
  selectedId: string
  reductionPct: number
}

type ScenarioResult = Scenario & {
  label: string
  color: string
  monthlySaving: number
  annualSaving: number
}

const MONTHS = 6
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function makeId() {
  return Math.random().toString(36).slice(2)
}

export const Route = createFileRoute("/analytics/what-if")({
  component: WhatIfPage,
  loader: async () => {
    const { dateFrom, dateTo } = getPresetDates("6months")
    const filters = { dateFrom, dateTo, accountIds: [] }
    const [byCat, merchants, currency] = await Promise.all([
      getSpendingByCategory({ data: filters }),
      getTopMerchants({ data: { ...filters, limit: 30 } }),
      getSetting({ data: "preferred_currency" }),
    ])
    return { byCat, merchants, currency: currency ?? "EUR" }
  },
})

function WhatIfPage() {
  const { byCat, merchants, currency } = Route.useLoaderData()
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: makeId(), mode: "category", selectedId: "", reductionPct: 25 },
  ])
  const [goalMonthly, setGoalMonthly] = useState("")

  const goalValue = parseFloat(goalMonthly) || 0

  function addScenario() {
    setScenarios((s) => [
      ...s,
      { id: makeId(), mode: "category", selectedId: "", reductionPct: 25 },
    ])
  }

  function removeScenario(id: string) {
    setScenarios((s) => s.filter((x) => x.id !== id))
  }

  function updateScenario(id: string, patch: Partial<Scenario>) {
    setScenarios((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const scenarioResults: ScenarioResult[] = scenarios.map((scenario, idx) => {
    const items =
      scenario.mode === "category"
        ? byCat
            .map((c) => ({
              id: String(c.categoryId ?? "none"),
              label: c.categoryName,
              total: c.total,
              color: c.categoryColor,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : merchants.map((m, i) => ({
            id: m.name,
            label: m.name,
            total: m.total,
            color: CHART_COLORS[i % CHART_COLORS.length],
          }))

    const effectiveId = scenario.selectedId || (items[0]?.id ?? "")
    const selected = items.find((i) => i.id === effectiveId) ?? items[0]

    const monthlySaving = ((selected?.total ?? 0) / MONTHS) * (scenario.reductionPct / 100)
    const annualSaving = monthlySaving * 12

    return {
      ...scenario,
      label: selected?.label ?? "—",
      color: selected?.color ?? CHART_COLORS[idx % CHART_COLORS.length],
      monthlySaving,
      annualSaving,
    }
  })

  const totalMonthlySaving = scenarioResults.reduce((s, r) => s + r.monthlySaving, 0)
  const totalAnnualSaving = scenarioResults.reduce((s, r) => s + r.annualSaving, 0)
  const goalProgress = goalValue > 0 ? totalMonthlySaving / goalValue : 0

  const projectionData = [3, 6, 9, 12, 18, 24, 36].map((m) => ({
    month: `${m}m`,
    saving: totalMonthlySaving * m,
  }))

  const breakdownData = scenarioResults.map((r) => ({
    name: r.label,
    monthly: r.monthlySaving,
    color: r.color,
  }))

  const hasSaving = totalMonthlySaving > 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">What If?</h1>
        <PageHelp title="What If Calculator">
          <p>Build spending reduction scenarios and see the combined impact on your monthly and annual budget.</p>
          <p><strong className="text-foreground">Scenarios</strong> — add as many cuts as you like. Each one targets a category or merchant at a reduction percentage.</p>
          <p><strong className="text-foreground">Goal</strong> — set an optional monthly saving target to track progress across your scenarios.</p>
          <p><strong className="text-foreground">Projection</strong> — shows how much you'd accumulate if you banked the savings consistently over time.</p>
          <p>All figures are based on the last 6 months of spending, annualised.</p>
        </PageHelp>
      </div>

      {/* Goal input */}
      <div className="space-y-2">
        <p className="section-label px-0.5">Monthly saving target <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="flex items-center gap-2 max-w-xs">
          <div className="relative flex-1">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              min={0}
              placeholder="e.g. 200"
              value={goalMonthly}
              onChange={(e) => setGoalMonthly(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {goalValue > 0 && (
            <span className="text-sm text-muted-foreground shrink-0">/month</span>
          )}
        </div>
      </div>

      {/* Scenario builder */}
      <div className="space-y-3">
        <p className="section-label px-0.5">Spending cuts</p>
        <div className="space-y-3">
          {scenarios.map((scenario, idx) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              index={idx}
              byCat={byCat}
              merchants={merchants}
              currency={currency}
              result={scenarioResults[idx]}
              onChange={(patch) => updateScenario(scenario.id, patch)}
              onRemove={scenarios.length > 1 ? () => removeScenario(scenario.id) : undefined}
            />
          ))}
        </div>
        <button
          onClick={addScenario}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          <Plus className="size-4" />
          Add another cut
        </button>
      </div>

      {/* Results */}
      {hasSaving && (
        <>
          {/* Summary stat cards */}
          <div className={cn(
            "grid grid-cols-2 gap-3 sm:gap-4",
            goalValue > 0 ? "lg:grid-cols-3" : "lg:grid-cols-2 max-w-xl"
          )}>
            <Card className="accent-positive">
              <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <span className="section-label">Monthly Saving</span>
                  <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                    <TrendingDown className="h-4 w-4 text-positive" />
                  </div>
                </div>
                <p className="metric-number text-positive">{formatCurrency(totalMonthlySaving, currency)}</p>
                <p className="text-xs text-muted-foreground">
                  across {scenarios.length} cut{scenarios.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="accent-neutral">
              <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <span className="section-label">Annual Saving</span>
                  <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="metric-number">{formatCurrency(totalAnnualSaving, currency)}</p>
                <p className="text-xs text-muted-foreground">per year</p>
              </CardContent>
            </Card>

            {goalValue > 0 && (
              <Card className={cn("accent-neutral col-span-2 lg:col-span-1", goalProgress >= 1 && "accent-positive")}>
                <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between">
                    <span className="section-label">Goal Progress</span>
                    <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <p className={cn("metric-number", goalProgress >= 1 && "text-positive")}>
                    {Math.round(Math.min(goalProgress, 1) * 100)}%
                  </p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        goalProgress >= 1 ? "bg-positive" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(goalProgress * 100, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Breakdown (only with multiple scenarios) */}
          {scenarios.length > 1 && (
            <div className="space-y-2">
              <p className="section-label px-0.5">Breakdown by cut</p>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <ResponsiveContainer width="100%" height={Math.max(scenarios.length * 52 + 16, 80)}>
                    <BarChart
                      data={breakdownData}
                      layout="vertical"
                      margin={{ top: 0, right: 96, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) =>
                          formatCurrency(v, currency, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })
                        }
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip
                        formatter={(value: unknown) => [formatCurrency(value as number, currency), "Monthly saving"]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="monthly" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {breakdownData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                        ))}
                        <LabelList
                          dataKey="monthly"
                          position="right"
                          formatter={(v: unknown) =>
                            formatCurrency(v as number, currency, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }) + "/mo"
                          }
                          style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Projection chart */}
          <div className="space-y-2">
            <p className="section-label px-0.5">Savings projection</p>
            <Card>
              <CardContent className="pt-5">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={projectionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="savingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-positive)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-positive)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(v) =>
                        formatCurrency(v, currency, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })
                      }
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [formatCurrency(value as number, currency), "Accumulated"]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="saving"
                      stroke="var(--color-positive)"
                      strokeWidth={2}
                      fill="url(#savingGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Cumulative savings if {formatCurrency(totalMonthlySaving, currency)}/mo is banked consistently
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function ScenarioCard({
  scenario,
  index,
  byCat,
  merchants,
  currency,
  result,
  onChange,
  onRemove,
}: {
  scenario: Scenario
  index: number
  byCat: CategoryItem[]
  merchants: MerchantItem[]
  currency: string
  result: ScenarioResult
  onChange: (patch: Partial<Scenario>) => void
  onRemove?: () => void
}) {
  const items =
    scenario.mode === "category"
      ? byCat
          .map((c) => ({
            id: String(c.categoryId ?? "none"),
            label: c.categoryName,
            total: c.total,
            color: c.categoryColor,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : merchants.map((m) => ({
          id: m.name,
          label: m.name,
          total: m.total,
          color: undefined as string | undefined,
        }))

  const effectiveId = scenario.selectedId || (items[0]?.id ?? "")

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Cut #{index + 1}</span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Controls */}
          <div className="space-y-3">
            <div className="flex rounded-md overflow-hidden border border-border text-xs">
              {(["category", "merchant"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ mode: m, selectedId: "" })}
                  className={`flex-1 py-1.5 capitalize transition-colors ${
                    scenario.mode === m
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <Select
              value={effectiveId ?? undefined}
              onValueChange={(id) => onChange({ selectedId: id ?? undefined })}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {items.find((i) => i.id === effectiveId)?.color && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: items.find((i) => i.id === effectiveId)?.color }}
                      />
                    )}
                    {items.find((i) => i.id === effectiveId)?.label ?? "Select…"}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[300px]">
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2 w-full">
                      {item.color && (
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      <span className="flex-1">{item.label}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {formatCurrency(item.total, currency)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reduce by</span>
                <span className="font-medium">{scenario.reductionPct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={scenario.reductionPct}
                onChange={(e) => onChange({ reductionPct: Number(e.target.value) })}
                className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="flex items-center">
            <div className="w-full rounded-xl bg-positive/10 border border-positive/20 p-4 text-center">
              <p className="text-[11px] text-muted-foreground mb-0.5">Monthly saving</p>
              <p className="text-2xl font-bold text-positive tabular-nums">
                {formatCurrency(result.monthlySaving, currency)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatCurrency(result.annualSaving, currency)}/yr
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
