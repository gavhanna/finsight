import webpush from "web-push"
import { db } from "../../db/index.server"
import { pushSubscriptions, settings, transactions } from "../../db/schema"
import { eq, and, gte, lt, lte } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { log } from "../../lib/logger.server"
import { fetchRecurringItems } from "./recurring.server"

export type NotificationPreferences = {
  syncCompleted: boolean
  largeTransactions: boolean
  recurringReminders: boolean
  weeklyDigest: boolean
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  syncCompleted: true,
  largeTransactions: true,
  recurringReminders: true,
  weeklyDigest: true,
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

  const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const expenses = newTxs.filter((tx) => tx.amount < 0 && tx.payee)

  for (const tx of expenses) {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const since = ninetyDaysAgo.toISOString().slice(0, 10)

    const [hist] = await db
      .select({
        avg: sql<number>`AVG(ABS(${transactions.amount}))`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}) = ${tx.payee}`,
          gte(transactions.bookingDate, since),
          lt(transactions.bookingDate, tx.bookingDate),
          lt(transactions.amount, 0),
        ),
      )

    const avg = hist?.avg
    const count = Number(hist?.count ?? 0)
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

  // Exclude active recurring payees — same logic as the discretionary page
  const recurringItems = await fetchRecurringItems(true)
  const recurringPayees = recurringItems.map((r) => r.payee)

  const baseConditions = [
    gte(transactions.bookingDate, dateFrom),
    lte(transactions.bookingDate, dateTo),
    lt(transactions.amount, 0),
  ]
  const conditions =
    recurringPayees.length > 0
      ? [
          ...baseConditions,
          sql`COALESCE(${transactions.creditorName}, ${transactions.debtorName}, ${transactions.description}) NOT IN (${sql.join(recurringPayees.map((p) => sql`${p}`), sql`, `)})` as any,
        ]
      : baseConditions

  const [result] = await db
    .select({
      total: sql<number>`SUM(ABS(${transactions.amount}))`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(...conditions))

  const total = result?.total ?? 0
  const txCount = Number(result?.count ?? 0)
  const currency = (await getDbSetting("preferred_currency")) ?? "GBP"
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

  const recurringNote = recurringPayees.length > 0 ? ` (excl. ${recurringPayees.length} recurring)` : ""

  await sendToSubs(subs, {
    title: "Weekly discretionary spend",
    body: `Last week: ${fmt(total)} across ${txCount} transaction${txCount !== 1 ? "s" : ""}${recurringNote}`,
    url: "/analytics/discretionary",
  })

  await setDbSetting("last_weekly_digest", weekKey)
  log.info("notifications.weekly_digest.sent")
}
