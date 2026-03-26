/**
 * Demo seed script — populates the DB with ~12 months of realistic dummy data.
 * No bank account or GoCardless credentials required.
 *
 * Usage:  npm run seed:demo
 *         npm run seed:demo -- --reset   (wipe existing demo data first)
 */
import { createHash } from "crypto"
import { db } from "./index.server"
import {
  bankConnections,
  accounts,
  categoryGroups,
  categories,
  rules,
  rulePatterns,
  transactions,
} from "./schema"
import { eq, inArray } from "drizzle-orm"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESET = process.argv.includes("--reset")

const DEMO_CONNECTION_ID = "demo-connection-001"
const DEMO_CURRENT_ACCOUNT_ID = "demo-current-account"
const DEMO_SAVINGS_ACCOUNT_ID = "demo-savings-account"

// Generate roughly one year of dates ending today
const END_DATE = new Date()
const START_DATE = new Date(END_DATE)
START_DATE.setFullYear(START_DATE.getFullYear() - 1)
START_DATE.setDate(1) // Start from first of the month a year ago

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function jitter(base: number, pct = 0.15): number {
  return parseFloat((base * (1 + rnd(-pct, pct))).toFixed(2))
}

function hash(accountId: string, date: string, amount: number, payee: string, desc: string): string {
  return createHash("sha256")
    .update(`${accountId}|${date}|${amount}|${payee}|${desc}`)
    .digest("hex")
}

/** Return every nth-day date in range where dayOfMonth matches (or nearest business day) */
function monthlyDates(dom: number): Date[] {
  const result: Date[] = []
  const cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    const d = new Date(cur.getFullYear(), cur.getMonth(), Math.min(dom, daysInMonth(cur)))
    if (d >= START_DATE && d <= END_DATE) result.push(new Date(d))
    cur.setMonth(cur.getMonth() + 1)
  }
  return result
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** All dates between start and end */
function allDates(): Date[] {
  const result: Date[] = []
  const cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    result.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ---------------------------------------------------------------------------
// Static data definitions
// ---------------------------------------------------------------------------

const GROUPS = [
  { name: "Living", color: "#f97316" },
  { name: "Food & Drink", color: "#ec4899" },
  { name: "Lifestyle", color: "#a855f7" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Money In", color: "#10b981" },
]

const CATEGORIES = [
  // Food & Drink
  { name: "Groceries", color: "#22c55e", icon: "ShoppingCart", type: "expense" as const, group: "Food & Drink" },
  { name: "Dining Out", color: "#ec4899", icon: "UtensilsCrossed", type: "expense" as const, group: "Food & Drink" },
  { name: "Coffee", color: "#d97706", icon: "Coffee", type: "expense" as const, group: "Food & Drink" },
  { name: "Alcohol", color: "#b45309", icon: "Wine", type: "expense" as const, group: "Food & Drink" },
  // Living
  { name: "Rent", color: "#ef4444", icon: "Home", type: "expense" as const, group: "Living" },
  { name: "Bills & Utilities", color: "#f97316", icon: "Zap", type: "expense" as const, group: "Living" },
  { name: "Subscriptions", color: "#8b5cf6", icon: "RefreshCw", type: "expense" as const, group: "Living" },
  { name: "Health", color: "#14b8a6", icon: "Heart", type: "expense" as const, group: "Living" },
  // Lifestyle
  { name: "Shopping", color: "#f59e0b", icon: "ShoppingBag", type: "expense" as const, group: "Lifestyle" },
  { name: "Entertainment", color: "#a855f7", icon: "Tv", type: "expense" as const, group: "Lifestyle" },
  { name: "Holidays", color: "#0ea5e9", icon: "Plane", type: "expense" as const, group: "Lifestyle" },
  { name: "Personal Care", color: "#f472b6", icon: "Sparkles", type: "expense" as const, group: "Lifestyle" },
  // Transport
  { name: "Transport", color: "#3b82f6", icon: "Car", type: "expense" as const, group: "Transport" },
  // Money In
  { name: "Income", color: "#10b981", icon: "TrendingUp", type: "income" as const, group: "Money In" },
  { name: "Transfers", color: "#6b7280", icon: "ArrowLeftRight", type: "transfer" as const, group: undefined },
  { name: "Other", color: "#94a3b8", icon: "MoreHorizontal", type: "expense" as const, group: undefined },
]

const RULES_DATA = [
  {
    name: "Salary",
    categoryName: "Income",
    priority: 100,
    patterns: [{ pattern: "SALARY", field: "description" as const, matchType: "contains" as const }],
  },
  {
    name: "Tesco",
    categoryName: "Groceries",
    priority: 90,
    patterns: [{ pattern: "TESCO", field: "creditorName" as const, matchType: "contains" as const }],
  },
  {
    name: "Dunnes Stores",
    categoryName: "Groceries",
    priority: 90,
    patterns: [{ pattern: "DUNNES", field: "creditorName" as const, matchType: "contains" as const }],
  },
  {
    name: "Netflix",
    categoryName: "Subscriptions",
    priority: 85,
    patterns: [{ pattern: "NETFLIX", field: "creditorName" as const, matchType: "contains" as const }],
  },
  {
    name: "Spotify",
    categoryName: "Subscriptions",
    priority: 85,
    patterns: [{ pattern: "SPOTIFY", field: "creditorName" as const, matchType: "contains" as const }],
  },
  {
    name: "Gym",
    categoryName: "Health",
    priority: 80,
    patterns: [{ pattern: "FLYEFIT", field: "creditorName" as const, matchType: "contains" as const }],
  },
  {
    name: "Rent payment",
    categoryName: "Rent",
    priority: 95,
    patterns: [{ pattern: "RENT", field: "description" as const, matchType: "contains" as const }],
  },
]

// ---------------------------------------------------------------------------
// Transaction templates — payee pools per category
// ---------------------------------------------------------------------------

const GROCERY_SHOPS = [
  "TESCO SUPERSTORE", "TESCO EXPRESS", "LIDL", "ALDI", "DUNNES STORES",
  "SUPERVALU", "MARKS & SPENCER FOOD", "ICELAND", "CENTRA", "SPAR",
]
const DINING_PLACES = [
  "WAGAMAMA", "ITSU", "LEON", "PRET A MANGER",
  "MCDONALDS", "NANDOS", "THE TEMPLE BAR", "ZIZZI",
  "FIVE GUYS", "SHAKE SHACK", "PIZZA EXPRESS", "BUNSEN",
  "PAULIE'S PIZZA", "THE WOOLLEN MILLS", "777 RESTAURANT",
]
const COFFEE_SHOPS = [
  "STARBUCKS", "COSTA COFFEE", "CAFFE NERO", "PRET A MANGER",
  "3FE COFFEE", "COFFEE ON THE CORNER",
]
const PUBS = [
  "THE LONG HALL", "MULLIGAN'S", "THE PALACE BAR",
  "KEHOE'S", "THE STAG'S HEAD", "O'DONOGHUE'S",
]
const TRANSPORT_PAYEES = [
  "LEAP CARD TOP UP", "LEAP CARD TOP UP", "LEAP CARD TOP UP",
  "UBER", "IRISH RAIL", "BUS EIREANN", "CIRCLE K FUEL", "APPLEGREEN FUEL",
]
const SHOPPING_PLACES = [
  "AMAZON", "ASOS", "H&M", "ZARA", "MARKS & SPENCER", "BOOTS",
  "PENNEYS", "NEXT", "TK MAXX", "BROWN THOMAS", "ARNOTTS",
]
const ENTERTAINMENT_PLACES = [
  "CINEWORLD", "VUE CINEMA", "TICKETMASTER", "EVENTBRITE",
  "BOWLING ALLEY", "ESCAPE ROOM", "LASER TAG",
]
const PERSONAL_CARE_PLACES = [
  "BOOTS PHARMACY", "LLOYDS PHARMACY", "THE HAIR SALON", "TONI&GUY", "THE BODY SHOP",
]
const HEALTH_PAYEES = [
  "FLYEFIT GYM", "DENTAL CARE CLINIC", "SPECSAVERS", "BOOTS PHARMACY", "LAYA HEALTHCARE",
]
const SUBSCRIPTION_CHARGES = [
  { name: "NETFLIX", amount: -15.99 },
  { name: "SPOTIFY", amount: -9.99 },
  { name: "AMAZON PRIME", amount: -8.99 },
  { name: "FLYEFIT GYM", amount: -24.99 },
  { name: "DISNEY PLUS", amount: -4.99 },
  { name: "APPLE ICLOUD", amount: -2.99 },
]
const BILL_CHARGES = [
  { name: "BORD GAIS ENERGY", amount: -jitter(70, 0.4) },
  { name: "IRISH WATER", amount: -jitter(40, 0.1) },
  { name: "VIRGIN MEDIA", amount: -44.99 },
  { name: "THREE MOBILE", amount: -30.0 },
  { name: "LOCAL PROPERTY TAX", amount: -jitter(95, 0.05) },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seedDemo() {
  console.log("Starting demo seed...")

  // ── 0. Optional reset ────────────────────────────────────────────────────
  if (RESET) {
    console.log("  Resetting demo data...")
    // Delete in dependency order
    await db.delete(transactions).where(
      inArray(transactions.accountId, [DEMO_CURRENT_ACCOUNT_ID, DEMO_SAVINGS_ACCOUNT_ID])
    )
    await db.delete(accounts).where(eq(accounts.connectionId, DEMO_CONNECTION_ID))
    await db.delete(bankConnections).where(eq(bankConnections.id, DEMO_CONNECTION_ID))
    console.log("  Reset complete.")
  }

  // ── 1. Bank connection ───────────────────────────────────────────────────
  console.log("  Inserting demo bank connection...")
  await db
    .insert(bankConnections)
    .values({
      id: DEMO_CONNECTION_ID,
      institutionId: "DEMO_BANK_GB",
      institutionName: "Demo Bank",
      institutionLogo: null,
      status: "LINKED",
      agreementId: null,
      createdAt: START_DATE,
      expiresAt: addDays(END_DATE, 90),
      lastSyncAt: END_DATE,
    })
    .onConflictDoNothing()

  // ── 2. Accounts ──────────────────────────────────────────────────────────
  console.log("  Inserting demo accounts...")
  await db
    .insert(accounts)
    .values([
      {
        id: DEMO_CURRENT_ACCOUNT_ID,
        connectionId: DEMO_CONNECTION_ID,
        iban: "IE29AIBK93115212345678",
        name: "Current Account",
        currency: "EUR",
        ownerName: "Demo User",
        lastSyncAt: END_DATE,
        syncCallsToday: 0,
        syncCallsDate: dateStr(END_DATE),
      },
      {
        id: DEMO_SAVINGS_ACCOUNT_ID,
        connectionId: DEMO_CONNECTION_ID,
        iban: "IE29AIBK93115212345679",
        name: "Savings Account",
        currency: "EUR",
        ownerName: "Demo User",
        lastSyncAt: END_DATE,
        syncCallsToday: 0,
        syncCallsDate: dateStr(END_DATE),
      },
    ])
    .onConflictDoNothing()

  // ── 3. Category groups ───────────────────────────────────────────────────
  console.log("  Inserting category groups...")
  for (const g of GROUPS) {
    await db.insert(categoryGroups).values(g).onConflictDoNothing()
  }
  const groupRows = await db.select().from(categoryGroups)
  const groupMap = Object.fromEntries(groupRows.map((g) => [g.name, g.id]))

  // ── 4. Categories ────────────────────────────────────────────────────────
  console.log("  Inserting categories...")
  for (const cat of CATEGORIES) {
    const { group, ...rest } = cat
    await db
      .insert(categories)
      .values({ ...rest, isDefault: true, groupId: group ? groupMap[group] : null })
      .onConflictDoNothing()
  }
  const categoryRows = await db.select().from(categories)
  const catMap = Object.fromEntries(categoryRows.map((c) => [c.name, c.id]))

  // ── 5. Rules ─────────────────────────────────────────────────────────────
  console.log("  Inserting categorisation rules...")
  for (const r of RULES_DATA) {
    const [inserted] = await db
      .insert(rules)
      .values({ name: r.name, categoryId: catMap[r.categoryName], priority: r.priority })
      .onConflictDoNothing()
      .returning()
    if (inserted) {
      for (const p of r.patterns) {
        await db.insert(rulePatterns).values({ ruleId: inserted.id, ...p }).onConflictDoNothing()
      }
    }
  }

  // ── 6. Transactions ──────────────────────────────────────────────────────
  console.log("  Generating transactions...")
  const txBatch: (typeof transactions.$inferInsert)[] = []

  let txCount = 0

  function addTx(
    accountId: string,
    date: Date,
    amount: number,
    creditorName: string | null,
    debtorName: string | null,
    description: string,
    categoryName: string | null,
    categorisedBy: "rule" | "mcc" | "manual" | null = "rule",
  ) {
    const d = dateStr(date)
    const payee = creditorName ?? debtorName ?? ""
    const dedupeHash = hash(accountId, d, amount, payee, description)
    txBatch.push({
      id: dedupeHash.slice(0, 20),
      accountId,
      externalId: null,
      bookingDate: d,
      valueDate: d,
      amount,
      currency: "EUR",
      creditorName,
      debtorName,
      description,
      merchantCategoryCode: null,
      categoryId: categoryName ? catMap[categoryName] ?? null : null,
      categorisedBy: categoryName ? categorisedBy : null,
      dedupeHash,
      rawData: null,
    })
    txCount++
  }

  const dates = allDates()
  const salaryDates = monthlyDates(25)
  const rentDates = monthlyDates(1)

  // ─── CURRENT ACCOUNT ────────────────────────────────────────────────────

  // Salary (monthly, 25th)
  for (const d of salaryDates) {
    const gross = jitter(3100, 0.05)
    addTx(DEMO_CURRENT_ACCOUNT_ID, d, gross, null, "ACME CORP LTD", `SALARY ${d.toLocaleString("en-IE", { month: "short" }).toUpperCase()} ACME CORP`, "Income", "rule")
  }

  // Rent (monthly, 1st)
  for (const d of rentDates) {
    addTx(DEMO_CURRENT_ACCOUNT_ID, d, -1450, "LANDLORD PROPERTY MGMT", null, "RENT PAYMENT", "Rent", "rule")
  }

  // Monthly subscriptions
  for (const sub of SUBSCRIPTION_CHARGES) {
    for (const d of monthlyDates(Math.floor(rnd(3, 22)))) {
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, sub.amount, sub.name, null, `${sub.name} SUBSCRIPTION`, "Subscriptions", "rule")
    }
  }

  // Monthly bills
  for (const bill of BILL_CHARGES) {
    const dom = Math.floor(rnd(5, 20))
    for (const d of monthlyDates(dom)) {
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, bill.amount, bill.name, null, `${bill.name} DIRECT DEBIT`, "Bills & Utilities", "rule")
    }
  }

  // Groceries — 2-3 times a week
  for (const d of dates) {
    const dow = d.getDay()
    // Shop on Tue, Thu, Sat with some probability
    if ((dow === 2 && Math.random() < 0.7) || (dow === 4 && Math.random() < 0.6) || (dow === 6 && Math.random() < 0.85)) {
      const shop = pick(GROCERY_SHOPS)
      const amount = -parseFloat(jitter(dow === 6 ? 55 : 28, 0.5).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, shop, null, `${shop} PAYMENT`, "Groceries", "rule")
    }
  }

  // Dining Out — 2-4 times a week
  for (const d of dates) {
    const dow = d.getDay()
    // More likely on Fri/Sat/Sun
    const prob = [0.15, 0.2, 0.25, 0.2, 0.35, 0.55, 0.4][dow]
    if (Math.random() < prob) {
      const place = pick(DINING_PLACES)
      const amount = -parseFloat(jitter(22, 0.6).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, place, null, `${place} CARD PAYMENT`, "Dining Out", "manual")
    }
  }

  // Coffee — 3-5 times a week (weekdays mostly)
  for (const d of dates) {
    const dow = d.getDay()
    const isWeekday = dow >= 1 && dow <= 5
    if (Math.random() < (isWeekday ? 0.7 : 0.3)) {
      const shop = pick(COFFEE_SHOPS)
      const amount = -parseFloat(jitter(4.5, 0.3).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, shop, null, `${shop}`, "Coffee", "manual")
    }
  }

  // Pub/alcohol — weekend evenings
  for (const d of dates) {
    const dow = d.getDay()
    if ((dow === 5 || dow === 6) && Math.random() < 0.35) {
      const pub = pick(PUBS)
      const amount = -parseFloat(jitter(28, 0.5).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, pub, null, `${pub} CARD PAYMENT`, "Alcohol", "manual")
    }
  }

  // Transport — most weekdays
  for (const d of dates) {
    const dow = d.getDay()
    const isWeekday = dow >= 1 && dow <= 5
    if (isWeekday && Math.random() < 0.75) {
      // Daily Leap Card
      const amount = -parseFloat(jitter(3.6, 0.25).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, "LEAP CARD TOP UP", null, "LEAP CARD TOP UP", "Transport", "rule")
    }
    // Occasional Uber or train
    if (Math.random() < 0.08) {
      const payee = pick(["UBER", "IRISH RAIL", "BUS EIREANN"])
      const amount = -parseFloat(jitter(payee === "UBER" ? 12 : 28, 0.5).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, payee, null, `${payee} PAYMENT`, "Transport", "manual")
    }
  }

  // Shopping — irregular, a few times a month
  for (const d of dates) {
    if (Math.random() < 0.07) {
      const shop = pick(SHOPPING_PLACES)
      const amount = -parseFloat(jitter(45, 0.8).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, shop, null, `${shop} PURCHASE`, "Shopping", "manual")
    }
  }

  // Entertainment — weekends
  for (const d of dates) {
    const dow = d.getDay()
    if ((dow === 5 || dow === 6 || dow === 0) && Math.random() < 0.12) {
      const place = pick(ENTERTAINMENT_PLACES)
      const amount = -parseFloat(jitter(18, 0.6).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, place, null, `${place}`, "Entertainment", "manual")
    }
  }

  // Personal care — once or twice a month
  for (const d of dates) {
    if (Math.random() < 0.04) {
      const place = pick(PERSONAL_CARE_PLACES)
      const amount = -parseFloat(jitter(25, 0.5).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, place, null, `${place}`, "Personal Care", "manual")
    }
  }

  // Health (non-gym) — occasional
  for (const d of dates) {
    if (Math.random() < 0.015) {
      const payee = pick(["DENTAL CARE CLINIC", "SPECSAVERS", "LAYA HEALTHCARE"])
      const amount = -parseFloat(jitter(55, 0.7).toFixed(2))
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, amount, payee, null, `${payee}`, "Health", "manual")
    }
  }

  // Occasional big holiday spend (2-3 per year)
  const holidayMonths = [2, 6, 9] // March, July, October
  for (const month of holidayMonths) {
    const d = new Date(START_DATE.getFullYear(), START_DATE.getMonth() + month, Math.floor(rnd(5, 20)))
    if (d <= END_DATE) {
      addTx(DEMO_CURRENT_ACCOUNT_ID, d, -parseFloat(jitter(480, 0.4).toFixed(2)), "BOOKING.COM", null, "BOOKING.COM RESERVATION", "Holidays", "manual")
      addTx(DEMO_CURRENT_ACCOUNT_ID, addDays(d, 1), -parseFloat(jitter(220, 0.4).toFixed(2)), "RYANAIR", null, "RYANAIR FLIGHT BOOKING", "Holidays", "manual")
    }
  }

  // Monthly savings transfer to savings account
  for (const d of monthlyDates(26)) {
    const amount = jitter(300, 0.2)
    addTx(DEMO_CURRENT_ACCOUNT_ID, d, -amount, null, null, "TRANSFER TO SAVINGS", "Transfers", "manual")
    addTx(DEMO_SAVINGS_ACCOUNT_ID, d, amount, null, null, "TRANSFER FROM CURRENT", "Transfers", "manual")
  }

  // ─── SAVINGS ACCOUNT ────────────────────────────────────────────────────
  // Interest (quarterly)
  const interestMonths = [2, 5, 8, 11]
  for (const m of interestMonths) {
    const d = new Date(START_DATE.getFullYear(), START_DATE.getMonth() + m, 28)
    if (d <= END_DATE) {
      addTx(DEMO_SAVINGS_ACCOUNT_ID, d, parseFloat(jitter(12, 0.5).toFixed(2)), null, null, "INTEREST PAYMENT", "Income", "rule")
    }
  }

  // ── 7. Flush transactions ────────────────────────────────────────────────
  console.log(`  Inserting ${txBatch.length} transactions...`)

  // Insert in batches of 200 to avoid hitting parameter limits
  const BATCH_SIZE = 200
  let inserted = 0
  for (let i = 0; i < txBatch.length; i += BATCH_SIZE) {
    const chunk = txBatch.slice(i, i + BATCH_SIZE)
    await db.insert(transactions).values(chunk).onConflictDoNothing()
    inserted += chunk.length
    process.stdout.write(`\r  Inserted ${inserted}/${txBatch.length}...`)
  }
  console.log()

  console.log(`\nDemo seed complete!`)
  console.log(`  Category groups: ${GROUPS.length}`)
  console.log(`  Categories:      ${CATEGORIES.length}`)
  console.log(`  Rules:           ${RULES_DATA.length}`)
  console.log(`  Transactions:    ${txBatch.length}`)
  console.log(`\nLog in and explore — no bank account required.`)

  process.exit(0)
}

seedDemo().catch((err) => {
  console.error(err)
  process.exit(1)
})
