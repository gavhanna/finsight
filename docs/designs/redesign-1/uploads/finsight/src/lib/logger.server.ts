import fs from "fs"
import path from "path"

type Level = "debug" | "info" | "warn" | "error"

const LOG_DIR = path.resolve(process.env["LOG_DIR"] ?? "logs")
const MAX_LOG_DAYS = 14

function getLogPath(): string {
  const date = new Date().toISOString().slice(0, 10)
  return path.join(LOG_DIR, `app-${date}.log`)
}

function pruneOldLogs() {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - MAX_LOG_DAYS)
    const cutoffDate = cutoff.toISOString().slice(0, 10)

    for (const file of fs.readdirSync(LOG_DIR)) {
      if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue
      const fileDate = file.slice(4, 14) // "app-YYYY-MM-DD.log" → "YYYY-MM-DD"
      if (fileDate < cutoffDate) {
        fs.unlinkSync(path.join(LOG_DIR, file))
      }
    }
  } catch {
    // non-fatal
  }
}

let initialized = false
function init() {
  if (initialized) return
  initialized = true
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  } catch {
    // already exists or unwritable — writes will just fail silently below
  }
  pruneOldLogs()
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  try {
    init()
    const entry = { ts: new Date().toISOString(), level, event, ...data }
    fs.appendFileSync(getLogPath(), JSON.stringify(entry) + "\n", "utf8")
  } catch {
    // never let logging crash the app
  }
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) => write("debug", event, data),
  info:  (event: string, data?: Record<string, unknown>) => write("info",  event, data),
  warn:  (event: string, data?: Record<string, unknown>) => write("warn",  event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
}
