import { createServerFn } from "@tanstack/react-start"
import { db } from "../../db/index.server"
import { settings } from "../../db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { log } from "../../lib/logger.server"

export const getSettings = createServerFn().handler(async () => {
  const rows = await db.select().from(settings)
  const map: Record<string, string | null> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }
  return map
})

export const getSetting = createServerFn()
  .inputValidator(z.string())
  .handler(async ({ data: key }) => {
    const [row] = await db.select().from(settings).where(eq(settings.key, key))
    return row?.value ?? null
  })

export const setSetting = createServerFn()
  .inputValidator(z.object({ key: z.string(), value: z.string().nullable() }))
  .handler(async ({ data: { key, value } }) => {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      })
  })

export const saveSettings = createServerFn()
  .inputValidator(
    z.object({
      gocardless_secret_id: z.string().optional(),
      gocardless_secret_key: z.string().optional(),
      ollama_url: z.string().optional(),
      ollama_model: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const keys: string[] = []
    for (const [key, value] of Object.entries(data)) {
      const v = value as string | undefined
      if (v !== undefined) {
        await db
          .insert(settings)
          .values({ key, value: v, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: v, updatedAt: new Date() },
          })
        keys.push(key)
      }
    }
    if (keys.length > 0) {
      log.info("settings.saved", { keys })
    }
  })
