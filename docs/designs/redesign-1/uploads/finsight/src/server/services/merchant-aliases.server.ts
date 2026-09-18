import { db } from "../../db/index.server"
import { merchantAliases } from "../../db/schema"

/** Loads all aliases and returns a Map<alias → canonicalName> for in-process use. */
export async function loadAliasMap(): Promise<Map<string, string>> {
  const rows = await db.select().from(merchantAliases)
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.alias, row.canonicalName)
  }
  return map
}
