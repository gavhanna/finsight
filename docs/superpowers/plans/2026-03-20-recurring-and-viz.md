# Recurring Transactions & Visualisation Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Subscriptions page that auto-detects recurring transactions, and improve three existing charts (stacked bar on Comparison, reference lines on Category Trends, savings rate on Dashboard).

**Architecture:** Pure detection logic extracted into a testable `src/lib/recurring.ts` utility module; a new `getRecurringTransactions` server function in `insights.ts` uses it; the `/subscriptions` route renders the results. Chart improvements are self-contained edits to three existing route files. No DB schema changes.

**Tech Stack:** TanStack Start (SSR), TanStack Router (file-based), Drizzle ORM + PostgreSQL, Recharts, Vitest, Tailwind CSS + shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-03-20-recurring-and-viz-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/recurring.ts` | Create | Pure detection utilities: median, frequency classification, monthly equiv |
| `src/lib/recurring.test.ts` | Create | Vitest unit tests for the above utilities |
| `src/server/fn/insights.ts` | Modify | Add `getRecurringTransactions` server function |
| `src/routes/subscriptions.tsx` | Create | Subscriptions page UI |
| `src/routes/__root.tsx` | Modify | Add Subscriptions to sidebar nav |
| `src/routes/comparison.tsx` | Modify | Replace simple bar with stacked bar by category |
| `src/routes/category-trends.tsx` | Modify | Add average reference lines to charts |
| `src/routes/index.tsx` | Modify | Add savings rate line to Cash Flow chart |

---

## Task 1: Detection utility functions

**Files:**
- Create: `src/lib/recurring.ts`

- [ ] **Step 1: Create `src/lib/recurring.ts` with the pure utility functions**

```typescript
// src/lib/recurring.ts

export type Frequency =
  | "Daily"
  | "Weekly"
  | "Fortnightly"
  | "Monthly"
  | "Every 2 months"
  | "Quarterly"
  | "Every 6 months"
  | "Annual"

export function getMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function classifyInterval(median: number): Frequency | null {
  if (median >= 1 && median <= 2) return "Daily"
  if (median >= 5 && median <= 9) return "Weekly"
  if (median >= 12 && median <= 17) return "Fortnightly"
  if (median >= 24 && median <= 36) return "Monthly"
  if (median >= 55 && median <= 75) return "Every 2 months"
  if (median >= 80 && median <= 100) return "Quarterly"
  if (median >= 160 && median <= 200) return "Every 6 months"
  if (median >= 340 && median <= 390) return "Annual"
  return null
}

export function toMonthlyEquiv(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "Daily":          return amount * 30
    case "Weekly":         return amount * 4.33
    case "Fortnightly":    return amount * 2.17
    case "Monthly":        return amount
    case "Every 2 months": return amount / 2
    case "Quarterly":      return amount / 3
    case "Every 6 months": return amount / 6
    case "Annual":         return amount / 12
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/recurring.ts
git commit -m "feat: add pure recurring transaction detection utilities"
```

---

## Task 2: Unit tests for detection utilities

**Files:**
- Create: `src/lib/recurring.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/lib/recurring.test.ts
import { describe, it, expect } from "vitest"
import { getMedian, classifyInterval, toMonthlyEquiv } from "./recurring"

describe("getMedian", () => {
  it("returns 0 for empty array", () => {
    expect(getMedian([])).toBe(0)
  })
  it("returns the single value for a one-element array", () => {
    expect(getMedian([30])).toBe(30)
  })
  it("returns middle value for odd-length array", () => {
    expect(getMedian([10, 30, 50])).toBe(30)
  })
  it("returns average of two middle values for even-length array", () => {
    expect(getMedian([10, 20, 30, 40])).toBe(25)
  })
  it("sorts before computing (does not assume sorted input)", () => {
    expect(getMedian([50, 10, 30])).toBe(30)
  })
})

describe("classifyInterval", () => {
  it("classifies 1 as Daily", () => expect(classifyInterval(1)).toBe("Daily"))
  it("classifies 7 as Weekly", () => expect(classifyInterval(7)).toBe("Weekly"))
  it("classifies 14 as Fortnightly", () => expect(classifyInterval(14)).toBe("Fortnightly"))
  it("classifies 30 as Monthly", () => expect(classifyInterval(30)).toBe("Monthly"))
  it("classifies 60 as Every 2 months", () => expect(classifyInterval(60)).toBe("Every 2 months"))
  it("classifies 91 as Quarterly", () => expect(classifyInterval(91)).toBe("Quarterly"))
  it("classifies 180 as Every 6 months", () => expect(classifyInterval(180)).toBe("Every 6 months"))
  it("classifies 365 as Annual", () => expect(classifyInterval(365)).toBe("Annual"))
  it("returns null for irregular interval (e.g. 45 days)", () => expect(classifyInterval(45)).toBeNull())
  it("returns null for interval of 0", () => expect(classifyInterval(0)).toBeNull())
})

describe("toMonthlyEquiv", () => {
  it("Monthly stays the same", () => expect(toMonthlyEquiv(100, "Monthly")).toBe(100))
  it("Annual divides by 12", () => expect(toMonthlyEquiv(120, "Annual")).toBe(10))
  it("Quarterly divides by 3", () => expect(toMonthlyEquiv(90, "Quarterly")).toBe(30))
  it("Weekly multiplies by 4.33", () => expect(toMonthlyEquiv(10, "Weekly")).toBeCloseTo(43.3))
})
```

- [ ] **Step 2: Run tests and confirm they all pass**

```bash
pnpm test
```

Expected: all tests pass (green).

- [ ] **Step 3: Commit**

```bash
git add src/lib/recurring.test.ts
git commit -m "test: add unit tests for recurring detection utilities"
```

---

## Task 3: `getRecurringTransactions` server function

**Files:**
- Modify: `src/server/fn/insights.ts`

The function fetches all expense transactions, groups by payee in application code (simpler than complex SQL grouping), applies the detection algorithm, then resolves category names with a second query.

- [ ] **Step 1: Add imports and the function to `src/server/fn/insights.ts`**

At the top of `insights.ts`, add to the existing imports:
```typescript
import { getMedian, classifyInterval, toMonthlyEquiv, type Frequency } from "../../lib/recurring"
```

Add `categories` to the existing destructured schema import if not already there (it already is — confirm by checking the import on line 3).

Then append this function at the bottom of the file:

```typescript
export type RecurringItem = {
  payee: string
  frequency: Frequency
  medianInterval: number
  avgAmount: number
  amountRange: { min: number; max: number }
  monthlyEquiv: number
  annualCost: number
  lastSeen: string
  nextExpected: string
  daysSinceLastSeen: number
  isActive: boolean
  transactionCount: number
  categoryId: number | null
  categoryName: string
  categoryColor: string
}

export const getRecurringTransactions = createServerFn().handler(async (): Promise<RecurringItem[]> => {
  // Fetch all expense transactions ordered by date ascending
  const txns = await db
    .select({
      bookingDate: transactions.bookingDate,
      amount: transactions.amount,
      creditorName: transactions.creditorName,
      debtorName: transactions.debtorName,
      description: transactions.description,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(lt(transactions.amount, 0))
    .orderBy(transactions.bookingDate)

  // Group by normalised payee in application code
  const payeeMap = new Map<string, typeof txns>()
  for (const tx of txns) {
    const payee = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"
    if (payee === "Unknown") continue // skip ungroupable transactions
    if (!payeeMap.has(payee)) payeeMap.set(payee, [])
    payeeMap.get(payee)!.push(tx)
  }

  const results: Omit<RecurringItem, "categoryName" | "categoryColor">[] = []

  for (const [payee, txList] of payeeMap) {
    if (txList.length < 3) continue

    // Ensure sorted by date (already ordered from DB, but be safe)
    const sorted = [...txList].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))

    // Compute day intervals between consecutive transactions
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].bookingDate).getTime()
      const curr = new Date(sorted[i].bookingDate).getTime()
      intervals.push(Math.round((curr - prev) / 86_400_000))
    }

    const medianInterval = getMedian(intervals)
    const frequency = classifyInterval(medianInterval)
    if (!frequency) continue

    const amounts = txList.map((t) => Math.abs(t.amount))
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const minAmount = Math.min(...amounts)
    const maxAmount = Math.max(...amounts)
    const monthlyEquiv = toMonthlyEquiv(avgAmount, frequency)

    const lastTx = sorted[sorted.length - 1]
    const lastSeen = lastTx.bookingDate
    const nextExpected = new Date(new Date(lastSeen).getTime() + medianInterval * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const daysSinceLastSeen = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)

    results.push({
      payee,
      frequency,
      medianInterval,
      avgAmount,
      amountRange: { min: minAmount, max: maxAmount },
      monthlyEquiv,
      annualCost: monthlyEquiv * 12,
      lastSeen,
      nextExpected,
      daysSinceLastSeen,
      isActive: daysSinceLastSeen < medianInterval * 2,
      transactionCount: txList.length,
      categoryId: lastTx.categoryId,
    })
  }

  // Resolve category names and colours with a single second query
  const uniqueCatIds = [...new Set(results.map((r) => r.categoryId).filter((id): id is number => id !== null))]
  const catRows = uniqueCatIds.length > 0
    ? await db.select().from(categories).where(inArray(categories.id, uniqueCatIds))
    : []
  const catMap = new Map(catRows.map((c) => [c.id, c]))

  return results
    .map((r) => ({
      ...r,
      categoryName: r.categoryId ? (catMap.get(r.categoryId)?.name ?? "Uncategorised") : "Uncategorised",
      categoryColor: r.categoryId ? (catMap.get(r.categoryId)?.color ?? "#94a3b8") : "#94a3b8",
    }))
    .sort((a, b) => b.monthlyEquiv - a.monthlyEquiv)
})
```

Note: `inArray` is already imported at the top of `insights.ts`. Confirm `categories` is imported from `../../db/schema` (it is, on line 3).

- [ ] **Step 2: Run typecheck to confirm no type errors**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/fn/insights.ts
git commit -m "feat: add getRecurringTransactions server function"
```

---

## Task 4: Subscriptions page route

**Files:**
- Create: `src/routes/subscriptions.tsx`

- [ ] **Step 1: Create the route file**

```typescript
// src/routes/subscriptions.tsx
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { getRecurringTransactions, type RecurringItem } from "../server/fn/insights"
import { formatCurrency, formatDate } from "../lib/utils"
import { Repeat, CalendarClock, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSortable } from "@/hooks/use-sortable"
import { SortableHead } from "@/components/ui/sortable-head"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/subscriptions")({
  component: SubscriptionsPage,
  loader: async () => getRecurringTransactions(),
})

type FreqFilter = "all" | "monthly" | "weekly" | "other"

function SubscriptionsPage() {
  const data = Route.useLoaderData()
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all")
  const [showInactive, setShowInactive] = useState(false)

  const active = data.filter((d) => d.isActive)
  const inactive = data.filter((d) => !d.isActive)

  const totalMonthly = active.reduce((s, d) => s + d.monthlyEquiv, 0)
  const totalAnnual = active.reduce((s, d) => s + d.annualCost, 0)

  const filtered = active.filter((item) => {
    if (freqFilter === "all") return true
    if (freqFilter === "monthly") return item.frequency === "Monthly"
    if (freqFilter === "weekly") return item.frequency === "Weekly" || item.frequency === "Fortnightly"
    return !["Monthly", "Weekly", "Fortnightly"].includes(item.frequency)
  })

  const hasData = data.length > 0

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="accent-negative">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Monthly Cost</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <TrendingDown className="h-4 w-4 text-negative" />
              </div>
            </div>
            <p className="metric-number">{formatCurrency(totalMonthly)}</p>
            <p className="text-xs text-muted-foreground">active recurring</p>
          </CardContent>
        </Card>
        <Card className="accent-neutral">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Annual Cost</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="metric-number">{formatCurrency(totalAnnual)}</p>
            <p className="text-xs text-muted-foreground">per year</p>
          </CardContent>
        </Card>
        <Card className="accent-neutral col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <span className="section-label">Active</span>
              <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="metric-number">{active.length}</p>
            <p className="text-xs text-muted-foreground">recurring payees</p>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted size-14 flex items-center justify-center">
            <Repeat className="size-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No recurring transactions detected</p>
            <p className="text-sm text-muted-foreground">Sync more transaction history to detect patterns.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Frequency filter */}
          <div className="overflow-x-auto">
            <Tabs value={freqFilter} onValueChange={(v) => v && setFreqFilter(v as FreqFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Active recurring table */}
          <RecurringTable items={filtered} />

          {/* Possibly cancelled (collapsed) */}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <span>{showInactive ? "▾" : "▸"}</span>
                Possibly cancelled ({inactive.length})
              </button>
              {showInactive && <RecurringTable items={inactive} dimmed />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecurringTable({ items, dimmed }: { items: RecurringItem[]; dimmed?: boolean }) {
  const { sorted, sortKey, sortDir, toggle } = useSortable(items, "monthlyEquiv", "desc")
  const today = new Date()

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead id="payee" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="pl-5 min-w-[160px]">Payee</SortableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <SortableHead id="frequency" sortKey={sortKey} sortDir={sortDir} onSort={toggle}>Frequency</SortableHead>
                <SortableHead id="avgAmount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden md:table-cell">Avg Amount</SortableHead>
                <SortableHead id="monthlyEquiv" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right">Monthly</SortableHead>
                <SortableHead id="annualCost" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden lg:table-cell">Annual</SortableHead>
                <SortableHead id="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="text-right hidden sm:table-cell">Last Seen</SortableHead>
                <TableHead className="text-right pr-5 hidden md:table-cell">Next Expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const isVariable = item.amountRange.max > item.amountRange.min * 1.25
                const nextDate = new Date(item.nextExpected)
                const daysUntilNext = Math.floor((nextDate.getTime() - today.getTime()) / 86_400_000)
                const nextDue = daysUntilNext <= 0
                const nextSoon = daysUntilNext > 0 && daysUntilNext <= 3

                return (
                  <TableRow key={item.payee} className={cn("hover:bg-muted/30", dimmed && "opacity-50")}>
                    <TableCell className="pl-5 font-medium truncate max-w-[200px]">{item.payee}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{item.categoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{item.frequency}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {formatCurrency(item.avgAmount)}
                      {isVariable && <span className="text-xs text-muted-foreground ml-1">(variable)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(item.monthlyEquiv)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                      {formatCurrency(item.annualCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-xs hidden sm:table-cell">
                      {formatDate(item.lastSeen)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right tabular-nums text-xs pr-5 hidden md:table-cell",
                      nextDue && "text-amber-500 font-medium",
                      nextSoon && "text-amber-400",
                    )}>
                      {formatDate(item.nextExpected)}
                      {nextDue && <span className="ml-1 text-amber-500">overdue</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/subscriptions.tsx
git commit -m "feat: add subscriptions page route"
```

---

## Task 5: Add Subscriptions to the sidebar

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add `Repeat` to the lucide-react import**

On the lucide-react import line (line 6 approximately), add `Repeat` to the destructured imports:
```typescript
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Tag,
  Filter,
  Settings,
  GitCompare,
  Inbox,
  AreaChart,
  ScrollText,
  Sun,
  Moon,
  Monitor,
  TrendingUp,
  Repeat,          // ← add this
} from "lucide-react"
```

- [ ] **Step 2: Add the nav item to the Overview group**

In the `navGroups` array (around line 78), the Overview group currently has:
```typescript
{
  label: "Overview",
  items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/comparison", label: "Comparison", icon: GitCompare },
    { to: "/category-trends", label: "Category Trends", icon: AreaChart },
  ],
},
```

Add the Subscriptions item between Comparison and Category Trends:
```typescript
{
  label: "Overview",
  items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/comparison", label: "Comparison", icon: GitCompare },
    { to: "/subscriptions", label: "Subscriptions", icon: Repeat },   // ← add this
    { to: "/category-trends", label: "Category Trends", icon: AreaChart },
  ],
},
```

Note: Do NOT set `exact: true` — only the Dashboard item uses that. The sidebar uses `startsWith` matching for all other items.

- [ ] **Step 3: Restart the dev server to let TanStack Router regenerate `routeTree.gen.ts`**

```bash
pnpm dev
```

Open http://localhost:3000/subscriptions in the browser. Verify:
- The Subscriptions link appears in the sidebar under Overview
- The page loads without errors
- If you have transaction data: stat cards show Monthly Cost, Annual Cost, Active count
- The table renders and column sort works

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx src/routeTree.gen.ts
git commit -m "feat: add subscriptions to sidebar navigation"
```

---

## Task 6: Stacked bar chart on Comparison page

**Files:**
- Modify: `src/routes/comparison.tsx`

The change replaces the single-total `BarChart` with a stacked bar that shows per-category breakdown. The `categories` computed value (already in the file) has `byMonth: Map<string, number>`, which we pivot into Recharts format.

- [ ] **Step 1: Add the `stackedData` memo and replace the chart in `comparison.tsx`**

After the `monthlyTotals` useMemo (around line 148), add:

```typescript
const stackedData = useMemo(() => {
  return months.map((month) => {
    const row: Record<string, any> = { month, label: formatMonth(month) }
    for (const cat of categories) {
      row[cat.name] = cat.byMonth.get(month) ?? 0
    }
    return row
  })
}, [months, categories])
```

Then replace the existing `BarChart` block inside the "Monthly Spending Overview" card. Search for the unique string `<Bar dataKey="total"` — it appears only once in this file and identifies the block to replace. Replace the entire `<ResponsiveContainer>` that contains it with:

```tsx
<ResponsiveContainer width="100%" height={180}>
  <BarChart data={stackedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
    <YAxis
      tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
      tick={{ fontSize: 10 }}
      width={48}
      tickLine={false}
      axisLine={false}
    />
    <Tooltip content={<ChartTooltip />} />
    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
    {categories.map((cat, i) => (
      <Bar
        key={cat.name}
        dataKey={cat.name}
        stackId="a"
        fill={cat.color}
        radius={i === categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
       />
    ))}
  </BarChart>
</ResponsiveContainer>
```

Note: `radius` with `[3,3,0,0]` only on the last `<Bar>` (topmost segment) avoids double-rounded middles. The `ChartTooltip` component is already defined in this file.

Also add `Legend` to the recharts import at the top of the file if it isn't there already:
```typescript
import {
  BarChart,
  Bar,
  Cell,         // Cell is used elsewhere in the file — keep it
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,       // ← add if missing
} from "recharts"
```

- [ ] **Step 2: Verify in browser**

Go to http://localhost:3000/comparison. Verify:
- Monthly Spending Overview now shows stacked bars (one colour per category per month)
- Hovering a segment shows the category name and amount in the tooltip
- Legend appears below the chart
- Total spend per month is the same as before (just split into segments)

- [ ] **Step 3: Commit**

```bash
git add src/routes/comparison.tsx
git commit -m "feat: replace monthly overview with stacked bar chart by category"
```

---

## Task 7: Average reference lines on Category Trends

**Files:**
- Modify: `src/routes/category-trends.tsx`

- [ ] **Step 1: Add `ReferenceLine` and `Label` to the recharts import**

At the top of `category-trends.tsx`, the recharts import currently has:
```typescript
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
```

Add `ReferenceLine` and `Label`:
```typescript
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Label,   // ← add
} from "recharts"
```

- [ ] **Step 2: Build the reference line data**

After the `summaryStats` useMemo (around line 152), add a memo that maps visible category IDs to their average:

```typescript
const avgByKey = useMemo(() => {
  const map = new Map<string, number>()
  for (const s of summaryStats) {
    map.set(String(s.id), s.avgPerMonth)
  }
  return map
}, [summaryStats])
```

- [ ] **Step 3: Add reference lines to the area chart variant**

Inside the `chartType === "area"` branch (around line 284), after the last `<Area>` element and before `</AreaChart>`, add:

```tsx
{months.length >= 3 && visibleCategories.map((cat) => {
  const avg = avgByKey.get(String(cat.id))
  if (!avg) return null
  return (
    <ReferenceLine
      key={`avg-${cat.id}`}
      y={avg}
      stroke={cat.color}
      strokeOpacity={0.6}
      strokeWidth={1}
      strokeDasharray="4 4"
    >
      {isSingle && (
        <Label
          value="avg"
          position="insideRight"
          fontSize={10}
          fill={cat.color}
          fillOpacity={0.7}
        />
      )}
    </ReferenceLine>
  )
})}
```

- [ ] **Step 4: Add the same reference lines to the bar chart variant**

Inside the `chartType === "bar"` branch (around line 319), add the identical block after the last `<Bar>` element and before `</BarChart>`:

```tsx
{months.length >= 3 && visibleCategories.map((cat) => {
  const avg = avgByKey.get(String(cat.id))
  if (!avg) return null
  return (
    <ReferenceLine
      key={`avg-${cat.id}`}
      y={avg}
      stroke={cat.color}
      strokeOpacity={0.6}
      strokeWidth={1}
      strokeDasharray="4 4"
    >
      {isSingle && (
        <Label
          value="avg"
          position="insideRight"
          fontSize={10}
          fill={cat.color}
          fillOpacity={0.7}
        />
      )}
    </ReferenceLine>
  )
})}
```

- [ ] **Step 5: Verify in browser**

Go to http://localhost:3000/category-trends. Verify:
- Dashed lines appear at the average spend level for each category
- In multi-category mode: dashed lines are present but have no text label
- Double-click a category chip to isolate it — the "avg" label appears at the right of the dashed line
- With only 1–2 months of data: no reference lines appear

- [ ] **Step 6: Commit**

```bash
git add src/routes/category-trends.tsx
git commit -m "feat: add average reference lines to category trends charts"
```

---

## Task 8: Savings rate line on Dashboard

**Files:**
- Modify: `src/routes/index.tsx`

The change adds a secondary Y-axis (right side, 0–100%) and a dashed savings rate line to the existing `IncomeExpensesChart` component. **Important:** when adding a secondary axis to Recharts, all existing `<Line>` elements must receive an explicit `yAxisId` prop to avoid miscalculation.

- [ ] **Step 1: Update `IncomeExpensesChart` in `index.tsx`**

Find the `IncomeExpensesChart` function (around line 623). Replace its body with:

```typescript
function IncomeExpensesChart({
  data,
}: {
  data: { month: string; income: number; expenses: number; net: number }[]
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
  }

  // Compute savings rate per month
  const dataWithRate = data.map((d) => ({
    ...d,
    savingsRate: d.income > 0 ? Math.round((d.net / d.income) * 100) : null,
  }))

  const interval = data.length > 6 ? Math.floor(data.length / 6) : 0
  const formatted = dataWithRate.map((d) => ({ ...d, month: formatMonth(d.month) }))

  // Only show savings rate line when we have at least 2 months with income
  const hasRateData = data.filter((d) => d.income > 0).length >= 2

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={interval} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        {hasRateData && (
          <YAxis
            yAxisId="rate"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
        )}
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
        <ReferenceLine yAxisId="left" y={0} stroke="oklch(0.5 0 0 / 0.15)" strokeWidth={1.5} />
        <Line yAxisId="left" type="monotone" dataKey="income" name="Income" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line yAxisId="left" type="monotone" dataKey="net" name="Net" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        {hasRateData && (
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="savingsRate"
            name="Savings Rate"
            stroke="var(--color-chart-3)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

Note: `ReferenceLine` must also receive `yAxisId="left"` since the chart now has two Y axes. Add `ReferenceLine` to the recharts import if not already there (it is — check line 28 of index.tsx).

- [ ] **Step 2: Verify in browser**

Go to http://localhost:3000. Verify:
- The Cash Flow chart still renders correctly (income/expenses/net lines unchanged)
- A dashed savings rate line appears on the right axis (0–100%)
- The right Y-axis shows % ticks
- The legend includes "Savings Rate"
- For months with no income, the line has a gap (connectNulls=false)

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: add savings rate line to dashboard cash flow chart"
```

---

## Final check

- [ ] Run all tests one last time:

```bash
pnpm test
```

Expected: all pass.

- [ ] Visually verify all four changed pages in the browser:
  - `/subscriptions` — stat cards, table with sortable columns, inactive section collapses
  - `/comparison` — stacked bar shows category breakdown per month
  - `/category-trends` — dashed average lines on both area and bar variants
  - `/` (Dashboard) — savings rate dashed line on Cash Flow chart
