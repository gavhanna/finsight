import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { pushSubscriptions } from "../../db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  getOrCreateVapidKeys,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from "../services/notifications.server"

const PreferencesSchema = z.object({
  syncCompleted: z.boolean(),
  largeTransactions: z.boolean(),
  recurringReminders: z.boolean(),
  weeklyDigest: z.boolean(),
})

export const getVapidPublicKey = createServerFn().handler(async () => {
  const { publicKey } = await getOrCreateVapidKeys()
  return publicKey
})

export const savePushSubscription = createServerFn()
  .inputValidator(
    z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .insert(pushSubscriptions)
      .values({
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        preferences: JSON.stringify(DEFAULT_PREFERENCES),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: data.p256dh, auth: data.auth },
      })
    return { ok: true }
  })

export const removePushSubscription = createServerFn()
  .inputValidator(z.object({ endpoint: z.string() }))
  .handler(async ({ data }) => {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint))
    return { ok: true }
  })

export const getNotificationPreferences = createServerFn()
  .inputValidator(z.object({ endpoint: z.string() }))
  .handler(async ({ data }) => {
    const [sub] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, data.endpoint))
    if (!sub) return DEFAULT_PREFERENCES
    try {
      return JSON.parse(sub.preferences) as NotificationPreferences
    } catch {
      return DEFAULT_PREFERENCES
    }
  })

export const updateNotificationPreferences = createServerFn()
  .inputValidator(
    z.object({
      endpoint: z.string(),
      preferences: PreferencesSchema,
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(pushSubscriptions)
      .set({ preferences: JSON.stringify(data.preferences) })
      .where(eq(pushSubscriptions.endpoint, data.endpoint))
    return { ok: true }
  })

export const sendTestNotification = createServerFn().handler(async () => {
  // Lazy import to avoid pulling web-push into non-server bundles
  const { notifySyncCompleted } = await import("../services/notifications.server")
  await notifySyncCompleted("Test", 1)
  return { ok: true }
})
