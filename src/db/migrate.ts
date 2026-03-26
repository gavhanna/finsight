import { migrate } from "drizzle-orm/postgres-js/migrator"
import { db } from "./index.server"
import path from "path"

// In production the bundled migrate.mjs sits at /app/migrate.mjs
// and migrations are copied to /app/migrations/
// MIGRATIONS_FOLDER env var can override for local use.
const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? path.resolve(process.cwd(), "migrations")

console.log(`Running migrations from ${migrationsFolder}...`)

migrate(db, { migrationsFolder })
  .then(() => {
    console.log("Migrations complete.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
