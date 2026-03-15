import { sql } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
})

export const bankConnections = pgTable("bank_connections", {
  id: text("id").primaryKey(), // requisition ID
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  institutionLogo: text("institution_logo"),
  status: text("status")
    .notNull()
    .default("CREATED")
    .$type<"CREATED" | "LINKED" | "EXPIRED" | "REVOKED">(),
  agreementId: text("agreement_id"),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
})

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(), // GoCardless account ID
  connectionId: text("connection_id")
    .notNull()
    .references(() => bankConnections.id, { onDelete: "cascade" }),
  iban: text("iban"),
  name: text("name"),
  currency: text("currency"),
  ownerName: text("owner_name"),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  syncCallsToday: integer("sync_calls_today").notNull().default(0),
  syncCallsDate: text("sync_calls_date"), // YYYY-MM-DD
})

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // hex
  icon: text("icon"),
  type: text("type")
    .notNull()
    .default("expense")
    .$type<"expense" | "income" | "transfer">(),
  isDefault: boolean("is_default").notNull().default(false),
})

export const categoryRules = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  field: text("field")
    .notNull()
    .default("description")
    .$type<"description" | "creditorName" | "debtorName" | "merchantCategoryCode">(),
  matchType: text("match_type")
    .notNull()
    .default("contains")
    .$type<"contains" | "exact" | "startsWith">(),
  priority: integer("priority").notNull().default(0),
})

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    bookingDate: text("booking_date").notNull(), // YYYY-MM-DD
    valueDate: text("value_date"),
    amount: doublePrecision("amount").notNull(), // signed
    currency: text("currency").notNull().default("GBP"),
    creditorName: text("creditor_name"),
    debtorName: text("debtor_name"),
    description: text("description"),
    merchantCategoryCode: text("merchant_category_code"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    categorisedBy: text("categorised_by").$type<"manual" | "rule" | "llm" | "mcc">(),
    dedupeHash: text("dedupe_hash").notNull(),
    rawData: text("raw_data"), // JSON
  },
  (t) => [
    unique("uniq_dedupe_hash").on(t.dedupeHash),
    index("idx_transactions_booking_date").on(t.bookingDate),
    index("idx_transactions_account_id").on(t.accountId),
    index("idx_transactions_category_id").on(t.categoryId),
  ],
)

export type Setting = typeof settings.$inferSelect
export type BankConnection = typeof bankConnections.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Category = typeof categories.$inferSelect
export type CategoryRule = typeof categoryRules.$inferSelect
export type Transaction = typeof transactions.$inferSelect
