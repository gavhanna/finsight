> [!NOTE]
> **AI-Assisted Development.** This project was built with significant use of AI tools (primarily Anthropic Claude). Architectural decisions, feature design, and product direction were made by me — AI was used extensively as an implementation partner throughout. I'm being upfront about this because I think honesty matters, and because the lines between "my code" and "AI-generated code" are genuinely blurry in a project like this. The system design, the decisions about what to build and how to structure it, and the overall product vision are mine. Much of the implementation was written or heavily assisted by AI.

---

# FinSight

A personal finance management application that connects to your real bank accounts via the GoCardless Open Banking API. Built as a side project to scratch my own itch — I wanted a self-hosted alternative to Monzo's spending analytics and YNAB, with full control over my data.

## Features

**Dashboard** — Spending breakdown by category (pie chart), income vs. expenses trend, monthly summaries, and an optional AI-generated narrative via a local Ollama model.

**Bank Sync** — Connect live bank accounts through GoCardless (UK/EU open banking). Transactions are synced on demand with hash-based deduplication so re-syncing never creates duplicates.

**Transactions** — Paginated, searchable, sortable transaction ledger. Bulk categorise multiple entries at once, edit categories inline, and view a chart breakdown of any search result set.

**Smart Categorisation** — A multi-stage engine runs automatically on every sync:
1. **Rules** — User-defined pattern rules matched against payee, description, or MCC code. Supports `contains`, `exact`, and `startsWith` matching with multiple conditions per rule.
2. **MCC codes** — Merchant Category Codes from the bank are mapped to categories automatically.
3. **LLM fallback** — Schema supports a local Ollama model as a last-resort categoriser (scaffolded, not yet production).
4. **Manual** — Users can always override.

Rules have a live preview — you can see which historical transactions a new rule would match before applying it.

**Transaction list** — View all transactions and see a line chart of spending when filtering by string search.

**Categories & Groups** — Full CRUD for categories (expense / income / transfer), with colour coding and the ability to group related categories together (e.g. "Food & Drink" containing Groceries, Restaurants, Coffee).

**Recurring Transactions** — Automatically detects recurring payments using median interval analysis. Classifies them as daily / weekly / fortnightly / monthly / quarterly / annual and shows monthly and annual cost equivalents.

**Category Trends** — Area and bar charts of spending per category over time, with group-level roll-ups.

**Comparison** — Side-by-side monthly income vs. expenses bar chart, with per-category breakdowns.

**Merchants** — Aggregated spending view grouped by merchant, showing transaction counts, total spend, average transaction value, and category breakdown per merchant.

**Triage** — A focused workflow view for reviewing and categorising uncategorised transactions.

**Logs** — Sync and system event log for monitoring account sync history and diagnosing issues.

**Automated Sync** — Cron-based scheduled sync using [croner](https://github.com/hexagon/croner). Accounts can be synced automatically on a configurable schedule without manual intervention.

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
| Testing | Vitest |
| Language | TypeScript 5.7 (strict) |

---

## Architecture Notes

**Full-stack isomorphic React.** TanStack Start's server functions let me co-locate data fetching logic with the components that use it, without a separate API layer. The server/client boundary is explicit and type-safe.

**Drizzle ORM schema.** The database schema is defined in TypeScript, migrations are versioned with Drizzle Kit, and all query results are fully typed end-to-end — no `any` escapes from the DB layer.

**Categorisation as a service.** The categorisation engine is a standalone module that the sync pipeline calls. It keeps an in-memory cache of rules and categories so repeated categorisations during a bulk sync don't hammer the database.

**Deduplication.** Each transaction gets a deterministic hash of its key fields on ingestion. A unique constraint on that hash means the sync is idempotent — run it ten times, get the same result.

**Automated sync via cron.** Account syncing is scheduled using croner as a Nitro plugin, so the app can keep transactions up-to-date in the background without manual triggers.

**Semantic design tokens.** The Tailwind theme has financial-domain tokens like `text-positive`, `text-negative`, and `accent-*` chart colours so components express intent rather than raw hex values.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- A GoCardless developer account (free tier available)

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
DATABASE_URL=postgresql://user:password@localhost:5432/finsight
NORDIGEN_SECRET_ID=your_secret_id
NORDIGEN_SECRET_KEY=your_secret_key
```

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

---

## Project Status

Actively developed as a personal tool. The core features are stable and in daily use. Ongoing work:

- [ ] Category groups UI polish
- [ ] Budget targets per category / group
- [ ] Export to CSV / PDF
- [ ] LLM categorisation via Ollama (scaffolded)
- [ ] Mobile PWA improvements

---

## Why I Built This

I wanted get insights into my spending habits and wasn't imediately interested in budgeting. Building my own insights app allowed me to add features as I discovered I needed them, such as the merchant breakdown and recurring transaction detection. I didnt want to pay for YNAB because i barely used it. I tried Revolut and AnPost Money Manager but they were too basic and didnt offer the level of detail i wanted. 
