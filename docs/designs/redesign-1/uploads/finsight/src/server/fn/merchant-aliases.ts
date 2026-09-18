import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const getMerchantAliases = createServerFn().handler(async () => {
  const { db } = await import("../../db/index.server")
  const { merchantAliases } = await import("../../db/schema")
  const { asc } = await import("drizzle-orm")
  return db
    .select()
    .from(merchantAliases)
    .orderBy(asc(merchantAliases.canonicalName), asc(merchantAliases.alias))
})

export const upsertMerchantAlias = createServerFn()
  .inputValidator(
    z.object({
      alias: z.string().min(1),
      canonicalName: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { db } = await import("../../db/index.server")
    const { merchantAliases } = await import("../../db/schema")
    await db
      .insert(merchantAliases)
      .values({ alias: data.alias, canonicalName: data.canonicalName })
      .onConflictDoUpdate({
        target: merchantAliases.alias,
        set: { canonicalName: data.canonicalName },
      })
  })

export const deleteMerchantAlias = createServerFn()
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const { db } = await import("../../db/index.server")
    const { merchantAliases } = await import("../../db/schema")
    const { eq } = await import("drizzle-orm")
    await db.delete(merchantAliases).where(eq(merchantAliases.id, data.id))
  })
