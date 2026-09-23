import { createServerFn } from "@tanstack/react-start"
import { asc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db/index.server"
import { recurringCommitments } from "@/db/schema"

const cadence = z.enum(["daily", "weekly", "fortnightly", "monthly", "quarterly", "annual"])
const input = z.object({
  payee: z.string().trim().min(1).max(160), categoryId: z.number().nullable().optional(), amount: z.number().positive(),
  currency: z.string().trim().min(3).max(3).default("EUR"), cadence, nextExpected: z.string().min(10).max(10), source: z.enum(["detected", "manual"]),
})

export const getRecurringCommitments = createServerFn().handler(async () => db.select().from(recurringCommitments).orderBy(asc(recurringCommitments.nextExpected)))

export const saveRecurringCommitment = createServerFn().inputValidator(input).handler(async ({ data }) => {
  const [row] = await db.insert(recurringCommitments).values(data).onConflictDoUpdate({ target: recurringCommitments.payee, set: { ...data, updatedAt: sql`now()` } }).returning()
  return row
})

export const deleteRecurringCommitment = createServerFn().inputValidator(z.object({ id: z.number() })).handler(async ({ data }) => {
  await db.delete(recurringCommitments).where(eq(recurringCommitments.id, data.id))
})
