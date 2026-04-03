import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency = "EUR",
  opts?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(amount)
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function startOfMonth(date = new Date()) {
  return localDateStr(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth(date = new Date()) {
  return localDateStr(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

export function startOfYear(date = new Date()) {
  return localDateStr(new Date(date.getFullYear(), 0, 1))
}

export function todayStr() {
  return localDateStr(new Date())
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day // shift back to Monday
  d.setDate(d.getDate() + diff)
  return localDateStr(d)
}

export function startOfLastWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const thisWeekMondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + thisWeekMondayOffset - 7)
  return localDateStr(d)
}

export function endOfLastWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const thisWeekMondayOffset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + thisWeekMondayOffset - 1) // day before this Monday = last Sunday
  return localDateStr(d)
}

export function startOfLastMonth(date = new Date()) {
  return localDateStr(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

export function endOfLastMonth(date = new Date()) {
  return localDateStr(new Date(date.getFullYear(), date.getMonth(), 0))
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-")
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} '${year.slice(2)}`
}
