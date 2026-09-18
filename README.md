> [!NOTE]
> **AI-Assisted Development.** This project was built with significant use of AI tools (primarily Anthropic Claude). Architectural decisions, feature design, and product direction were made by me — AI was used extensively as an implementation partner throughout. I'm being upfront about this because I think honesty matters, and because the lines between "my code" and "AI-generated code" are genuinely blurry in a project like this. The system design, the decisions about what to build and how to structure it, and the overall product vision are mine. Much of the implementation was written or heavily assisted by AI.

---

<div align="center">

# FinSight

**A self-hosted personal finance app that connects to your real bank accounts.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TanStack Start](https://img.shields.io/badge/TanStack%20Start-1.x-FF4154?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle%20ORM-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)

</div>

Built as a side project to scratch my own itch — I wanted a self-hosted alternative to Revolut's spending analytics and YNAB, with full control over my data and syncs to real bank accounts via the [GoCardless Open Banking API](https://gocardless.com/bank-account-data/).

---

## Screenshots

<table>
<tr>
<td width="50%"><img src=".github/screenshots/transactions.png" alt="Transaction ledger with search, filters, and category tags" /><br/><sub>Transaction ledger — search, filter, and inline category editing</sub></td>
<td width="50%"><img src=".github/screenshots/merchants.png" alt="Merchant spend aggregation view" /><br/><sub>Merchants — spend aggregated by payee, with concentration analysis</sub></td>
</tr>
</table>

*(Screenshots generated from the seeded demo dataset — [see below](#seed-demo-data) — no real financial data.)*

---

## Features

Features below are grouped the way they're grouped in the app's own sidebar.

### Daily

**Dashboard** — Total balance, four clickable summary stats (spend / income / money in / net, each linking to filtered Transactions), a Net Worth Projection chart (historical balances plus a dashed forward projection with a confidence band, selectable 6M/1Y/2Y/5Y horizon), a Budget Snapshot of top over-budget categories, Cash Flow, Year-over-Year comparison, Spending by Category (pie/bar toggle), Spending Trends, a month-by-month cash flow table, and Top Merchants — all filterable by date range and account.

**Transactions** — Paginated, searchable, sortable ledger. Bulk-categorise multiple entries at once, edit categories inline, and view a chart breakdown of any search result set.

**Budgets** — Standing monthly budgets per category or category group, with an Overview tab showing budget-vs-actual progress bars (amber at 75%, red over 100%) and unbudgeted spend, plus a Manage tab for CRUD and one-off monthly overrides that don't touch the standing amount.

**Triage** — A focused workflow view for reviewing and categorising uncategorised transactions.

### Insights

**Comparison** — Side-by-side monthly income vs. expenses bar chart, with per-category breakdowns.

**Recurring Transactions** — Automatically detects recurring payments using median interval analysis. Classifies them as daily / weekly / fortnightly / monthly / quarterly / annual and shows monthly and annual cost equivalents.

**Category Trends** — Area and bar charts of spending per category over time, with group-level roll-ups.

**Merchants** — Aggregated spending view grouped by merchant, showing transaction counts, total spend, average transaction value, category breakdown, and a spend-concentration (HHI) score per merchant.

### Analytics

**Savings Rate** — Monthly (income − expenses) ÷ income as a line chart, with a 12-month rolling average and a 20% benchmark reference line.

**Personal Inflation Rate** — Compares your annualised category spend year-over-year to compute a personal inflation rate, plotted per-category against a CPI reference line.

**Spending Forecast** — Projects next month's total spend as Fixed (active recurring payments) + Variable (3-month rolling average of non-recurring spend), with a confidence rating derived from variance in the variable component.

**What-If Scenarios** — Interactive "what if I cut X% from category/merchant Y" calculator. Stack multiple scenarios and see combined projected monthly/annual savings against an optional savings goal.

**Cash Flow Calendar** — Month-grid calendar with daily income/expense bars sized relative to the month's largest day; click a day for a transaction list, with badges on future days for expected recurring payments.

**Spending Patterns** — Breaks spending down by day-of-week and day-of-month to surface your busiest spending days.

**Discretionary Spending** — Week/month-scoped view of non-recurring spend by category, with quick date presets and a toggle to include or exclude inactive recurring series.

### Smart Categorisation

A multi-stage engine runs automatically on every sync:

1. **Rules** — User-defined pattern rules matched against payee, description, or MCC code, with `contains`, `exact`, and `startsWith` matching across multiple conditions. Rules have a live preview showing which historical transactions a new rule would match before you apply it.
2. **MCC codes** — Merchant Category Codes from the bank are mapped to categories automatically.
3. **LLM fallback** — Schema supports a local Ollama model as a last-resort categoriser (scaffolded, not yet production).
4. **Manual** — Users can always override.

**Categories & Groups** — Full CRUD for categories (expense / income / transfer), with colour coding and the ability to group related categories together (e.g. "Food & Drink" containing Groceries, Restaurants, Coffee).

### Bank Sync & Automation

**Bank Sync** — Connect live bank accounts through GoCardless (UK/EU open banking), configured from the in-app Settings page — no environment variables to set. Transactions are synced on demand with hash-based deduplication so re-syncing never creates duplicates.

**Automated Sync** — Cron-based scheduled sync using [croner](https://github.com/hexagon/croner), running as a Nitro server plugin so accounts stay up to date without manual triggers.

**Push Notifications** — Opt-in Web Push alerts (VAPID keys generated and stored server-side automatically) with per-type toggles: sync completed, unusual transactions (2× a merchant's usual spend), upcoming recurring payments, a weekly discretionary-spend digest, and budget alerts (80% warning, over-budget, monthly summary).

**Installable PWA** — Manifest, icons, and offline fallback page included, so FinSight can be installed to your home screen / app dock like a native app.

**Logs** — Sync and system event log for monitoring account sync history and diagnosing issues.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, isomorphic server functions) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 with a custom "Midnight Finance" theme |
| UI | Custom component library (shadcn-pattern Cards, Dialogs, Tables, Sidebar) |
| Charts | Recharts |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) |
| Validation | Zod |
| Bank API | [GoCardless Open Banking](https://gocardless.com/bank-account-data/) (Nordigen SDK) |
| Cron | [croner](https://github.com/hexagon/croner) (automated account sync scheduling) |
| Push | Web Push (VAPID), installable PWA |
| Testing | Vitest |
| Language | TypeScript 5.7 (strict) |

---

## Architecture Notes

**Full-stack isomorphic React.** TanStack Start's server functions let me co-locate data fetching logic with the components that use it, without a separate API layer. The server/client boundary is explicit and type-safe.

**Drizzle ORM schema.** The database schema is defined in TypeScript, migrations are versioned with Drizzle Kit, and all query results are fully typed end-to-end — no `any` escapes from the DB layer.

**Categorisation as a service.** The categorisation engine is a standalone module that the sync pipeline calls. It keeps an in-memory cache of rules and categories so repeated categorisations during a bulk sync don't hammer the database.

**Deduplication.** Each transaction gets a deterministic hash of its key fields on ingestion. A unique constraint on that hash means the sync is idempotent — run it ten times, get the same result.

**Automated sync via cron.** Account syncing is scheduled using croner as a Nitro plugin, so the app can keep transactions up-to-date in the background without manual triggers.

**Runtime configuration, not env vars.** GoCardless credentials, the optional Ollama endpoint, and Web Push VAPID keys are configured from the in-app Settings page and stored in the database, not `.env` — only the database connection needs configuring before first boot.

**Semantic design tokens.** The Tailwind theme has financial-domain tokens like `text-positive`, `text-negative`, and `accent-*` chart colours so components express intent rather than raw hex values.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- A GoCardless developer account (free tier available) — only needed if you want to connect a real bank; skip it entirely to explore with demo data

### Setup

```bash
git clone https://github.com/gavhanna/finsight.git
cd finsight
pnpm install
```

Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgres://user:password@localhost:5432/finsight
APP_URL=http://localhost:3000
# DISABLE_AUTO_SYNC=true  # set locally to stop scheduled syncs from consuming daily API quota
```

That's the entire `.env` — GoCardless credentials and any Ollama configuration are entered later from the app's **Settings** page, not as environment variables.

Run migrations and start the dev server:

```bash
pnpm db:migrate
pnpm dev
```

### Seed Demo Data

To spin up the app with a year of realistic dummy data (no bank account required):

```bash
pnpm seed:demo
```

Add the `--reset` flag to wipe existing demo data and reseed from scratch:

```bash
pnpm seed:demo:reset
```

This creates two demo accounts (current + savings), ~1,500 transactions across 12 months, a full category tree with groups, and a set of categorisation rules. No GoCardless credentials needed.

### Docker

A prebuilt image is published to GHCR on every tagged release:

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://user:password@host:5432/finsight \
  -e APP_URL=http://localhost:3000 \
  -v finsight-data:/data \
  ghcr.io/gavhanna/finsight:latest
```

The container runs Drizzle migrations automatically on startup before serving the app (see [`docker-entrypoint.sh`](docker-entrypoint.sh)). The `/data` volume holds sync logs. You still need a reachable PostgreSQL instance — it isn't bundled in the image.

---

## Project Status

Actively developed as a personal tool. The core features are stable and in daily use. Ongoing work:

- [ ] Category groups UI polish
- [ ] Export to CSV / PDF
- [ ] LLM categorisation via Ollama (scaffolded)
- [ ] Mobile PWA improvements

---

## Why I Built This

I wanted to get insights into my spending habits and wasn't immediately interested in budgeting. Building my own insights app allowed me to add features as I discovered I needed them, such as the merchant breakdown and recurring transaction detection. I didn't want to pay for YNAB because I barely used it. I tried Revolut and AnPost Money Manager but they were too basic and didn't offer the level of detail I wanted.
