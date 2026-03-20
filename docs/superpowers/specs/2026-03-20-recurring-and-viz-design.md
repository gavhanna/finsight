---
title: Recurring Transactions & Visualisation Improvements
date: 2026-03-20
status: approved
---

# Recurring Transactions & Visualisation Improvements

## Overview

Two complementary improvements to FinSight:

1. **Subscriptions page** — detect recurring transactions automatically from existing data and surface them as a dedicated view, revealing what leaves the account on autopilot each month/year.
2. **Visualisation improvements** — three targeted enhancements to existing pages to make trends visible at a glance rather than requiring manual inspection.

No new database tables are required for either feature.

---

## Part 1: Subscriptions / Recurring Transactions Page

### Goal

Show all transactions that appear on a regular schedule, grouped by payee, with their frequency, average cost, monthly equivalent, and annual cost. Includes an "inactive" section for things that used to recur but appear to have stopped.

### Detection Algorithm

Implemented as a new server function `getRecurringTransactions` in `src/server/fn/insights.ts`.

**Steps:**

1. Fetch all transactions with a negative amount (expenses only), ordered by `bookingDate` ascending.

2. Group by normalised payee: `COALESCE(creditorName, debtorName, description, 'Unknown')` — consistent with the existing `getTopMerchants` convention. Fully-null payees are grouped together under the key `'Unknown'` and are excluded from results (a single "Unknown" group is not meaningful as a recurring item).

3. For each payee group with **3 or more** transactions (minimum 3 gives at least 2 intervals, making the median meaningful and avoiding false positives from coincidental same-payee transactions):
   - Calculate intervals (days) between consecutive transactions.
   - Take the **median interval** (robust against one-off gaps).
   - Match the median to a frequency bucket:

     | Median interval (days) | Frequency |
     |---|---|
     | 1–2 | Daily |
     | 5–9 | Weekly |
     | 12–17 | Fortnightly |
     | 24–36 | Monthly |
     | 55–75 | Every 2 months |
     | 80–100 | Quarterly |
     | 160–200 | Every 6 months |
     | 340–390 | Annual |

   - Payees whose median interval doesn't match any bucket are excluded (irregular / non-recurring).

4. For each matched payee, compute:
   - `avgAmount`: mean of absolute values of all transaction amounts for this payee.
   - `amountRange`: `{ min, max }` of absolute amounts — if `max > min × 1.25`, flag as "variable" in the UI.
   - `monthlyEquiv`: normalise to monthly cost (weekly × 4.33, fortnightly × 2.17, quarterly ÷ 3, every-2-months ÷ 2, every-6-months ÷ 6, annual ÷ 12, daily × 30).
   - `annualCost`: `monthlyEquiv × 12`.
   - `lastSeen`: most recent `bookingDate` for this payee.
   - `nextExpected`: `lastSeen` date + `medianInterval` days (as a `YYYY-MM-DD` string).
   - `daysSinceLastSeen`: computed in the handler as `Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000)`.
   - `isActive`: `daysSinceLastSeen < medianInterval × 2`.
   - `transactionCount`: total number of occurrences.
   - `categoryId`, `categoryName`, `categoryColor`: taken from the **most recent transaction** for that payee. In SQL, use PostgreSQL's `DISTINCT ON (payee)` ordered by `bookingDate DESC` in a subquery, then join to the main grouped results. Alternatively, fetch all transactions for matched payees and resolve the most-recent category in application code after grouping — this is simpler with Drizzle's current usage patterns in the codebase.

5. Return all results sorted by `monthlyEquiv` descending (highest cost first). Active and inactive items are returned together; the route component splits them client-side using `isActive`.

### New Route: `/subscriptions`

New file: `src/routes/subscriptions.tsx`. Added to the sidebar in `src/routes/__root.tsx` under the **Overview** group, between Comparison and Category Trends. Use the `Repeat` icon from lucide-react. Do **not** set `exact: true` on this nav item (only the Dashboard `/` uses `exact: true`); the sidebar's `startsWith` matching handles active state correctly.

**Loader:** calls `getRecurringTransactions()` — no filters, uses all-time data.

**Page layout:**

```
[Stat cards row]
  Total Monthly Cost | Total Annual Cost | Active Subscriptions (count)
  (only count isActive === true items in the stats)

[Active recurring table]  (isActive === true)
  Payee | Category | Frequency | Avg Amount | Monthly Equiv | Annual Cost | Last Seen | Next Expected

[Collapsed section: "Possibly cancelled (N)"]  (isActive === false)
  Same columns, greyed out, collapsed by default
```

**Table behaviour:**
- Sortable columns via existing `useSortable` hook (default sort: `monthlyEquiv` descending).
- Filter tabs: All / Monthly / Weekly / Other (covers fortnightly, quarterly, annual, etc.).
- "Next Expected" cell: amber tint if the date is in the past (overdue) or within 3 days (due soon).
- "Avg Amount" cell: small "(variable)" label if `amountRange.max > amountRange.min × 1.25`.
- Category shown as a small colour dot + name, matching the existing category pill style in the app.
- No edit/delete actions — this is a read-only derived view.

### What this does NOT include

- No user-managed subscription list — detection is fully automatic.
- No push notifications or alerts.
- No filtering by date range — all-time history is used for detection accuracy.

---

## Part 2: Visualisation Improvements

### 2a. Stacked Bar on Comparison Page

**File:** `src/routes/comparison.tsx`

**Change:** Replace the current "Monthly Spending Overview" `BarChart` (which uses `monthlyTotals` as its data source and renders a single total bar per month) with a stacked bar chart.

**Data:** Build a new pivot array replacing `monthlyTotals` as the chart's data source:
```ts
const stackedData = months.map(month => {
  const row: Record<string, any> = { month, label: formatMonth(month) }
  for (const cat of categories) {
    row[cat.name] = cat.byMonth.get(month) ?? 0
  }
  return row
})
```

**Chart:** One `<Bar>` per category, each with `stackId="a"`, `fill={cat.color}`, `radius` only on the topmost bar (to avoid double-rounded middles — set `radius={[3,3,0,0]}` only on the last Bar). Keep existing chart height (180px). Add a `<Legend>` below the chart. Tooltip should show the category name and value for the hovered segment, plus the month total (use a custom tooltip component matching the existing `ChartTooltip` style in comparison.tsx).

### 2b. Average Reference Lines on Category Trends

**File:** `src/routes/category-trends.tsx`

**Change:** Add a dashed `<ReferenceLine>` per visible category to both the area chart and bar chart variants.

- Reference value: `cat.avgPerMonth` from `summaryStats` (already computed).
- Find the matching `summaryStats` entry for each visible category using `String(cat.id)`.
- Line style: `strokeDasharray="4 4"`, `stroke={cat.color}`, `strokeOpacity={0.6}`, `strokeWidth={1}`.
- Label: in single-category isolate mode only (`isSingle === true`), show a small `<Label>` at the right edge with text "avg". In multi-category mode, no label (colour alone identifies lines).
- Only add reference lines when `months.length >= 3`.
- Import `ReferenceLine, Label` from recharts (check existing imports before adding).

### 2c. Savings Rate Line on Dashboard Cash Flow Chart

**File:** `src/routes/index.tsx`

**Change:** Add a savings rate `%` line on a secondary Y-axis to the `IncomeExpensesChart` component.

**Data:** Compute `savingsRate` inside `IncomeExpensesChart` before the `formatted` map:
```ts
const dataWithRate = data.map(d => ({
  ...d,
  savingsRate: d.income > 0 ? Math.round((d.net / d.income) * 100) : null,
}))
const formatted = dataWithRate.map(d => ({ ...d, month: formatMonth(d.month) }))
```

**Secondary axis:** Add `<YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />`.

**Critical:** When a secondary `<YAxis>` is added to a Recharts `<LineChart>`, **all** existing `<Line>` elements must receive `yAxisId="left"` (or whichever ID is on the primary axis — add `yAxisId="left"` to the primary `<YAxis>` and to all three existing `<Line>` components for income, expenses, and net). Without this, Recharts will misrender the chart.

**New line:**
```tsx
<Line
  yAxisId="rate"
  type="monotone"
  dataKey="savingsRate"
  name="Savings Rate"
  stroke="var(--color-chart-1)"
  strokeWidth={1.5}
  strokeDasharray="5 3"
  dot={false}
  activeDot={{ r: 3, strokeWidth: 0 }}
  connectNulls={false}
/>
```

Only render this line when the dataset has at least 2 months with `income > 0`:
```ts
const hasRateData = data.filter(d => d.income > 0).length >= 2
```
Wrap the `<Line>` in `{hasRateData && ...}`.

---

## Implementation Order

1. `getRecurringTransactions` server function in `insights.ts`
2. `/subscriptions` route (`src/routes/subscriptions.tsx`)
3. Sidebar nav entry in `__root.tsx`
4. Stacked bar on Comparison page
5. Average reference lines on Category Trends
6. Savings rate line on Dashboard

---

## Files Affected

| File | Change |
|---|---|
| `src/server/fn/insights.ts` | Add `getRecurringTransactions` |
| `src/routes/subscriptions.tsx` | New file |
| `src/routes/__root.tsx` | Add subscriptions to nav |
| `src/routeTree.gen.ts` | Auto-generated by TanStack Router (do not edit manually) |
| `src/routes/comparison.tsx` | Stacked bar chart |
| `src/routes/category-trends.tsx` | Reference lines |
| `src/routes/index.tsx` | Savings rate line + yAxisId on existing lines |
