import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const getRecurringIgnores = createServerFn().handler(async () => {
  const { db } = await import("../../db/index.server")
  const { recurringIgnores } = await import("../../db/schema")
  const { asc } = await import("drizzle-orm")
  return db.select().from(recurringIgnores).orderBy(asc(recurringIgnores.payee))
})

export const ignoreRecurringPayee = createServerFn()
  .inputValidator(z.object({ payee: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db } = await import("../../db/index.server")
    const { recurringIgnores } = await import("../../db/schema")
    await db.insert(recurringIgnores).values({ payee: data.payee }).onConflictDoNothing()
  })

export const unignoreRecurringPayee = createServerFn()
  .inputValidator(z.object({ payee: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db } = await import("../../db/index.server")
    const { recurringIgnores } = await import("../../db/schema")
    const { eq } = await import("drizzle-orm")
    await db.delete(recurringIgnores).where(eq(recurringIgnores.payee, data.payee))
  })
