import { Cron } from "croner"
import { syncAllAccounts } from "../services/sync.server"
import { log } from "../../lib/logger.server"

// Default: 7am and 12pm UTC. Override with CRON_SYNC_SCHEDULES env var (comma-separated cron expressions).
const DEFAULT_SCHEDULES = "0 7 * * *,0 12 * * *"
const SCHEDULES = (process.env["CRON_SYNC_SCHEDULES"] ?? DEFAULT_SCHEDULES)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

async function runSync() {
  try {
    await syncAllAccounts()
  } catch (err: any) {
    log.error("cron.sync.error", { error: err?.message })
  }
}

export default function () {
  for (const expr of SCHEDULES) {
    new Cron(expr, { timezone: "UTC" }, runSync)
  }
  log.info("cron.scheduled", { schedules: SCHEDULES })
}
