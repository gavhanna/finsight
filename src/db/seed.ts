import { db } from "./index"
import { categories } from "./schema"
import { DEFAULT_CATEGORIES } from "../lib/constants"
import { sql } from "drizzle-orm"

async function seed() {
  console.log("Seeding default categories...")

  for (const cat of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...cat, isDefault: true })
      .onConflictDoNothing()
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
  console.log(`Done. ${result[0].count} categories in DB.`)

  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
