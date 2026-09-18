FinSight - Family Finance Insights App

 Context

 A locally hosted app to get better insights into family finances. Imports bank transactions via GoCardless open banking API,
 auto-categorises them (keyword rules + optional Ollama LLM fallback), and presents spending insights through charts. Focus is on
  spending analysis, not budget tracking.

 Tech Stack

 - Framework: TanStack Start (full-stack React on Vite + Nitro)
 - UI: shadcn/ui + Tailwind CSS
 - Database: Drizzle ORM + SQLite (./data/finsight.db)
 - Charts: Recharts
 - Bank API: GoCardless Bank Account Data (nordigen-node SDK)
 - Auto-categorisation: Rule engine + optional Ollama LLM fallback

 ---
 Project Structure

 src/
   routes/
     __root.tsx                    # Sidebar layout shell
     index.tsx                     # Dashboard (insights + charts)
     transactions.tsx              # Transaction list + manual categorisation
     accounts.tsx                  # Bank connections management
     categories.tsx                # Category & rule management
     settings.tsx                  # API keys, Ollama config
     api/gocardless/callback.tsx   # OAuth redirect handler
   components/
     ui/                           # shadcn/ui components
     layout/                       # sidebar, header
     charts/                       # spending-by-category, trends, top-merchants, income-vs-expenses
     transactions/                 # table, category-select
     accounts/                     # institution-picker, account-card
     categories/                   # category-list, rule-editor
   db/
     index.ts                      # Drizzle client
     schema.ts                     # All table definitions
     migrations/
   server/
     fn/                           # Server functions by domain
       transactions.ts
       accounts.ts
       categories.ts
       insights.ts
       settings.ts
     services/
       gocardless.ts               # GoCardless API wrapper
       categoriser.ts              # Rule engine + Ollama fallback
       ollama.ts                   # Ollama client
   lib/
     utils.ts                      # cn(), formatCurrency, etc.
     constants.ts                  # Default categories, MCC mapping
 data/
   finsight.db                     # SQLite file (gitignored)
 .env                              # GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY

 ---
 Database Schema (Drizzle + SQLite)

 Tables

 settings - Key-value store for app config (API keys, Ollama URL)
 - key (text, PK), value (text), updatedAt (timestamp)

 bank_connections - GoCardless requisitions (bank links)
 - id (text, PK = requisition ID), institutionId, institutionName, institutionLogo, status (CREATED/LINKED/EXPIRED/REVOKED),
 agreementId, createdAt, expiresAt, lastSyncAt

 accounts - Individual bank accounts within a connection
 - id (text, PK = GoCardless account ID), connectionId (FK -> bank_connections), iban, name, currency, ownerName, lastSyncAt,
 syncCallsToday, syncCallsDate

 categories - Transaction categories
 - id (int, PK), name (unique), color (hex), icon, type (expense/income/transfer), isDefault (bool)

 category_rules - Keyword rules for auto-categorisation
 - id (int, PK), categoryId (FK -> categories), pattern (text), field (description/creditorName/debtorName/merchantCategoryCode),
  matchType (contains/exact/startsWith), priority (int)

 transactions - Bank transactions
 - id (text, PK), accountId (FK -> accounts), externalId, bookingDate, valueDate, amount (real, signed), currency, creditorName,
 debtorName, description, merchantCategoryCode, categoryId (FK -> categories), categorisedBy (manual/rule/llm/mcc), dedupeHash
 (unique), rawData (JSON)
 - Indexes on: bookingDate, accountId, categoryId, dedupeHash

 Deduplication

 SHA-256 hash of accountId + bookingDate + amount + payeeName + description. Insert with ON CONFLICT (dedupe_hash) DO NOTHING for
  idempotent re-syncs.

 ---
 Implementation Phases

 Phase 1: Foundation

 1. Scaffold project - npx create-start@latest, install deps (drizzle-orm, better-sqlite3, nordigen-node, recharts, shadcn/ui)
 2. Database schema - Create src/db/schema.ts with all tables, run drizzle-kit generate + drizzle-kit migrate
 3. Seed default categories - Groceries, Bills & Utilities, Entertainment, Transport, Dining Out, Shopping, Health, Income,
 Transfers, Subscriptions, Cash, Other (each with distinct color)
 4. App shell - __root.tsx with sidebar navigation (Dashboard, Transactions, Accounts, Categories, Settings)

 Phase 2: GoCardless Integration

 5. Settings page - Form to enter GoCardless Secret ID/Key + Ollama URL, stored in settings table
 6. GoCardless service (src/server/services/gocardless.ts)
   - Token management (access token generation/refresh via SDK)
   - getInstitutions(country), createRequisition(institutionId, redirectUrl), getAccountTransactions(accountId, dateFrom?,
 dateTo?)
   - Cache institution list in memory
 7. Bank connection flow
   - Accounts page: "Connect Bank" button -> institution picker dialog -> create requisition -> redirect to bank
   - Callback route (/api/gocardless/callback): reads ref param, fetches requisition, inserts accounts, redirects to /accounts
   - Redirect URL: http://localhost:3000/api/gocardless/callback (GoCardless allows localhost)
 8. Transaction sync
   - Server function: fetch transactions from GoCardless, compute dedupeHash, run through categoriser, insert with ON CONFLICT DO
  NOTHING
   - Rate limit tracking: max 4 syncs/account/day (tracked in accounts table)
   - dateFrom = latest existing bookingDate for the account (or 90 days ago if first sync)
 9. Accounts page UI - Connection cards with bank name/logo, account list, sync status, expiry warning, sync/reconnect buttons

 Phase 3: Categorisation

 10. Categorisation engine (src/server/services/categoriser.ts)
   - Priority order: keyword rules (by priority DESC) -> MCC code mapping -> Ollama LLM (if enabled) -> uncategorised
   - Rules cached in memory, invalidated on rule changes
   - Manual overrides (categorisedBy = 'manual') never overwritten by re-categorisation
 11. MCC mapping - Static lookup in src/lib/constants.ts (e.g. 5411 -> Groceries, 5812 -> Dining Out)
 12. Categories page - CRUD for categories + rules, "Re-categorise All" button
 13. Transactions page - Data table with search, date/category/account filters, inline category editing (dropdown), bulk select +
  categorise, pagination (50/page)
 14. Ollama fallback (src/server/services/ollama.ts) - Optional, only if ollama_url set in settings. Sends transaction details
 with category list, expects category name back. 10s timeout, skip gracefully if unavailable.

 Phase 4: Insights Dashboard

 15. Aggregation server functions (src/server/fn/insights.ts)
   - getSpendingByCategory(filters) - SUM(amount) grouped by category WHERE amount < 0
   - getSpendingTrends(filters) - SUM(amount) grouped by month + category
   - getTopMerchants(filters, limit=10) - SUM(amount) grouped by creditorName
   - getIncomeVsExpenses(filters) - Income vs expenses per month
   - All accept dateFrom, dateTo, accountIds[] filters
 16. Dashboard page (src/routes/index.tsx)
   - Filter bar: date range presets (This Month, Last 3/6 Months, YTD, All Time) + custom picker, account multi-select
   - Stat cards: total spend, total income, net, transaction count
   - Spending by category: pie chart + bar chart (toggle)
   - Spending trends: line chart (top categories over months)
   - Top 10 merchants: horizontal bar chart
   - Income vs expenses: grouped bar chart per month
   - Filters stored in URL search params

 ---
 Key Decisions

 ┌─────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
 │        Decision         │                                    Approach                                     │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Server layer            │ createServerFn for everything; no separate API except GoCardless callback route │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ GoCardless redirect     │ localhost:3000 redirect URL (works for personal use)                            │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Deduplication           │ SHA-256 hash on accountId+date+amount+payee+description, unique constraint      │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Rate limits             │ 4 syncs/account/day tracked in DB, UI disables sync button when exhausted       │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Categorisation priority │ Rules -> MCC -> Ollama -> uncategorised                                         │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Manual overrides        │ Never overwritten by auto re-categorisation                                     │
 ├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Credentials             │ Stored in settings table (local-only app on trusted machine)                    │
 └─────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

 ---
 Verification

 1. Schema: Run drizzle-kit generate + drizzle-kit migrate, verify tables created in SQLite
 2. GoCardless sandbox: Connect using SANDBOXFINANCE_SFIN0000 institution, verify redirect flow and transaction import
 3. Categorisation: Import sandbox transactions, verify rules match, test manual override persists through re-categorisation
 4. Charts: Verify dashboard renders with sandbox data, test date range filters and account filters
 5. Rate limits: Verify sync is blocked after 4 calls, counter resets next day
