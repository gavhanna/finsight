import webpush from "web-push"
import { db } from "../../db/index.server"
import { pushSubscriptions, settings, transactions } from "../../db/schema"
import { eq, and, gte, lt, lte } from "drizzle-orm"
import { log } from "../../lib/logger.server"
import { fetchRecurringItems } from "./recurring.server"
import {
  excludeCanonicalMerchants,
  getHistoricalMerchantExpenseAmounts,
} from "./merchants.server"

export type NotificationPreferences = {
  syncCompleted: boolean
  largeTransactions: boolean
  recurringReminders: boolean
  weeklyDigest: boolean
  budgetAlerts: boolean
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  syncCompleted: true,
  largeTransactions: true,
  recurringReminders: true,
  weeklyDigest: true,
  budgetAlerts: true,
}

// ─── VAPID key management ─────────────────────────────────────────────────────

async function getDbSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row?.value ?? null
}

async function setDbSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
}

export async function getOrCreateVapidKeys(): Promise<{
  publicKey: string
  privateKey: string
  subject: string
}> {
  const [pub, priv] = await Promise.all([
    getDbSetting("vapid_public_key"),
    getDbSetting("vapid_private_key"),
  ])

  if (pub && priv) {
    return { publicKey: pub, privateKey: priv, subject: "mailto:admin@finsight.local" }
  }

  const keys = webpush.generateVAPIDKeys()
  await Promise.all([
    setDbSetting("vapid_public_key", keys.publicKey),
    setDbSetting("vapid_private_key", keys.privateKey),
  ])
  log.info("notifications.vapid.generated")
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:admin@finsight.local" }
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

async function getSubscribersForPreference(
  pref: keyof NotificationPreferences,
): Promise<typeof pushSubscriptions.$inferSelect[]> {
  const subs = await db.select().from(pushSubscriptions)
  return subs.filter((s) => {
    try {
      const prefs = JSON.parse(s.preferences) as NotificationPreferences
      return prefs[pref] === true
    } catch {
      return false
    }
  })
}

async function sendToSubs(
  subs: typeof pushSubscriptions.$inferSelect[],
  payload: { title: string; body: string; url?: string },
) {
  if (subs.length === 0) return

  const vapid = await getOrCreateVapidKeys()
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err: any) {
      // Subscription expired or revoked — clean it up
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        log.info("notifications.subscription.expired", { endpoint: sub.endpoint.slice(0, 40) })
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
      } else {
        log.warn("notifications.send.failed", { statusCode: err?.statusCode, message: err?.message })
      }
    }
  }
}

// ─── Notification triggers ────────────────────────────────────────────────────

export async function notifySyncCompleted(accountName: string, count: number) {
  const subs = await getSubscribersForPreference("syncCompleted")
  await sendToSubs(subs, {
    title: "Sync complete",
    body: `${count} new transaction${count !== 1 ? "s" : ""} imported from ${accountName}`,
    url: "/transactions",
  })
}

export async function notifyLargeTransactions(
  newTxs: Array<{ payee: string; amount: number; bookingDate: string }>,
) {
  const subs = await getSubscribersForPreference("largeTransactions")
  if (subs.length === 0) return

  const currency = await getDbSetting("preferred_currency")
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency ?? "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const expenses = newTxs.filter((tx) => tx.amount < 0 && tx.payee)

  for (const tx of expenses) {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const since = ninetyDaysAgo.toISOString().slice(0, 10)

    const historicalAmounts = await getHistoricalMerchantExpenseAmounts(tx.payee, {
      dateFrom: since,
      beforeDate: tx.bookingDate,
    })

    const count = historicalAmounts.length
    const avg =
      count > 0
        ? historicalAmounts.reduce((sum, amount) => sum + amount, 0) / count
        : 0
    if (!avg || count < 2) continue

    const txAmt = Math.abs(tx.amount)
    if (txAmt <= avg * 2) continue

    await sendToSubs(subs, {
      title: "Unusual transaction",
      body: `${tx.payee}: ${fmt(txAmt)} — your usual is around ${fmt(avg)}`,
      url: "/transactions",
    })
  }
}

export async function checkRecurringReminders() {
  const subs = await getSubscribersForPreference("recurringReminders")
  if (subs.length === 0) return

  const today = new Date().toISOString().slice(0, 10)
  const lastCheck = await getDbSetting("last_recurring_check")
  if (lastCheck === today) return

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const active = await fetchRecurringItems(true)
  const due = active.filter((r) => r.nextExpected === tomorrowStr)

  for (const item of due) {
    const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

    await sendToSubs(subs, {
      title: "Upcoming payment",
      body: `${item.payee} — ${fmt(item.avgAmount)} expected tomorrow`,
      url: "/recurring",
    })
  }

  await setDbSetting("last_recurring_check", today)
  if (due.length > 0) {
    log.info("notifications.recurring.sent", { count: due.length })
  }
}

export async function checkWeeklyDigest() {
  const subs = await getSubscribersForPreference("weeklyDigest")
  if (subs.length === 0) return

  const today = new Date()
  if (today.getDay() !== 1) return // Monday only

  // ISO week number
  const startOfYear = new Date(today.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((today.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7)
  const weekKey = `${today.getFullYear()}-W${weekNum}`

  const lastDigest = await getDbSetting("last_weekly_digest")
  if (lastDigest === weekKey) return

  // Last week: Monday to Sunday
  const lastMonday = new Date(today)
  lastMonday.setDate(today.getDate() - 7)
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - 1)

  const dateFrom = lastMonday.toISOString().slice(0, 10)
  const dateTo = lastSunday.toISOString().slice(0, 10)

  const [recurringItems, weeklyTransactions] = await Promise.all([
    fetchRecurringItems(true),
    db
      .select({
        amount: transactions.amount,
        creditorName: transactions.creditorName,
        debtorName: transactions.debtorName,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.bookingDate, dateFrom),
          lte(transactions.bookingDate, dateTo),
          lt(transactions.amount, 0),
        ),
      ),
  ])

  const recurringPayees = new Set(recurringItems.map((r) => r.payee))
  const discretionaryTransactions = await excludeCanonicalMerchants(
    weeklyTransactions,
    recurringPayees,
  )

  const total = discretionaryTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const txCount = discretionaryTransactions.length
  const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

  const recurringNote = recurringPayees.size > 0 ? ` (excl. ${recurringPayees.size} recurring)` : ""

  await sendToSubs(subs, {
    title: "Weekly discretionary spend",
    body: `Last week: ${fmt(total)} across ${txCount} transaction${txCount !== 1 ? "s" : ""}${recurringNote}`,
    url: "/analytics/discretionary",
  })

  await setDbSetting("last_weekly_digest", weekKey)
  log.info("notifications.weekly_digest.sent")
}

// Two-tier budget alert tracking: "warned" (≥80%) then "exceeded" (≥100%).
// Each budget can fire at most two notifications per month.
type BudgetAlertState = Record<number, "warned" | "exceeded">

export async function checkBudgetAlerts() {
  const subs = await getSubscribersForPreference("budgetAlerts")
  if (subs.length === 0) return

  const today = new Date()
  const month = today.toISOString().slice(0, 7)

  const alertKey = `budget_alert_state_${month}`
  const stateRaw = await getDbSetting(alertKey)
  const state: BudgetAlertState = stateRaw ? JSON.parse(stateRaw) : {}

  const { getBudgetVsActualInternal } = await import("./budgets.server")
  const { categoryBudgets, groupBudgets } = await getBudgetVsActualInternal(month)

  const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const allBudgets = [
    ...categoryBudgets.map((b) => ({ ...b, name: b.categoryName })),
    ...groupBudgets.map((b) => ({ ...b, name: b.groupName })),
  ]

  let dirty = false

  for (const budget of allBudgets) {
    const ratio = budget.budgeted > 0 ? budget.spent / budget.budgeted : 0
    const current = state[budget.budgetId]

    if (ratio >= 1 && current !== "exceeded") {
      // Over budget — send exceeded alert (upgrade from warned or fresh)
      const overBy = budget.spent - budget.budgeted
      await sendToSubs(subs, {
        title: `Over budget: ${budget.name}`,
        body: `Over by ${fmt(overBy)} — spent ${fmt(budget.spent)} of ${fmt(budget.budgeted)}`,
        url: "/budgets",
      })
      state[budget.budgetId] = "exceeded"
      dirty = true
    } else if (ratio >= 0.8 && !current) {
      // Approaching limit — send warning (only if not yet warned or exceeded)
      const remaining = budget.budgeted - budget.spent
      const pct = Math.round(ratio * 100)
      await sendToSubs(subs, {
        title: `Budget warning: ${budget.name}`,
        body: `${pct}% used — ${fmt(remaining)} remaining of ${fmt(budget.budgeted)}`,
        url: "/budgets",
      })
      state[budget.budgetId] = "warned"
      dirty = true
    }
  }

  if (dirty) {
    await setDbSetting(alertKey, JSON.stringify(state))
    log.info("notifications.budget_alerts.sent")
  }
}

export async function checkBudgetMonthEnd() {
  const subs = await getSubscribersForPreference("budgetAlerts")
  if (subs.length === 0) return

  // Only run on the 1st of the month
  const today = new Date()
  if (today.getDate() !== 1) return

  // Summarise the previous month
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
  const monthName = prev.toLocaleString("en-IE", { month: "long" })

  const summaryKey = `budget_month_summary_${month}`
  if (await getDbSetting(summaryKey)) return // already sent

  const { getBudgetVsActualInternal } = await import("./budgets.server")
  const { categoryBudgets, groupBudgets } = await getBudgetVsActualInternal(month)

  const allBudgets = [
    ...categoryBudgets.map((b) => ({ ...b, name: b.categoryName })),
    ...groupBudgets.map((b) => ({ ...b, name: b.groupName })),
  ]

  if (allBudgets.length === 0) return

  const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const onTrack  = allBudgets.filter((b) => b.spent <= b.budgeted)
  const overBudget = allBudgets
    .filter((b) => b.spent > b.budgeted)
    .sort((a, b) => (b.spent - b.budgeted) - (a.spent - a.budgeted))

  let body: string
  if (overBudget.length === 0) {
    body = `All ${allBudgets.length} budgets kept. Great month!`
  } else {
    const overList = overBudget
      .slice(0, 3)
      .map((b) => `${b.name} +${fmt(b.spent - b.budgeted)}`)
      .join(", ")
    const more = overBudget.length > 3 ? ` (+${overBudget.length - 3} more)` : ""
    body = `${onTrack.length}/${allBudgets.length} on track. Over: ${overList}${more}`
  }

  await sendToSubs(subs, {
    title: `${monthName} budget summary`,
    body,
    url: "/budgets",
  })

  await setDbSetting(summaryKey, "1")
  log.info("notifications.budget_month_end.sent", { month })
}
