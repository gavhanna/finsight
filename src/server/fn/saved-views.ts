import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db/index.server"
import { savedViews } from "@/db/schema"

const ScopeSchema = z.enum(["transactions", "explore"])
const DefinitionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
type SavedViewDefinition = Record<string, z.infer<typeof DefinitionValueSchema>>

export const getSavedViews = createServerFn()
  .inputValidator(z.object({ scope: ScopeSchema }))
  .handler(async ({ data: { scope } }) => {
    const rows = await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.scope, scope))
      .orderBy(asc(savedViews.createdAt), asc(savedViews.id))

    return rows.map((row) => ({
      ...row,
      definition: JSON.parse(row.definition) as SavedViewDefinition,
    }))
  })

export const createSavedView = createServerFn()
  .inputValidator(z.object({
    scope: ScopeSchema,
    name: z.string().trim().min(1).max(80),
    definition: z.record(z.string(), DefinitionValueSchema),
  }))
  .handler(async ({ data }) => {
    const [row] = await db
      .insert(savedViews)
      .values({
        scope: data.scope,
        name: data.name,
        definition: JSON.stringify(data.definition),
      })
      .onConflictDoUpdate({
        target: [savedViews.scope, savedViews.name],
        set: {
          definition: JSON.stringify(data.definition),
          updatedAt: sql`now()`,
        },
      })
      .returning()
    return row
  })

export const deleteSavedView = createServerFn()
  .inputValidator(z.object({ id: z.number(), scope: ScopeSchema }))
  .handler(async ({ data }) => {
    await db
      .delete(savedViews)
      .where(and(eq(savedViews.id, data.id), eq(savedViews.scope, data.scope)))
  })
