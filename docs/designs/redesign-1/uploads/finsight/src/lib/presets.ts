import { daysAgo, startOfMonth, startOfYear, todayStr } from "@/lib/utils"

export type PresetKey = "month" | "3months" | "6months" | "ytd" | "12months" | "all"

export function getPresetDates(preset: PresetKey): { dateFrom?: string; dateTo?: string } {
  const today = todayStr()
  switch (preset) {
    case "month":    return { dateFrom: startOfMonth(), dateTo: today }
    case "3months":  return { dateFrom: daysAgo(90),    dateTo: today }
    case "6months":  return { dateFrom: daysAgo(180),   dateTo: today }
    case "ytd":      return { dateFrom: startOfYear(),  dateTo: today }
    case "12months": return { dateFrom: daysAgo(365),   dateTo: today }
    case "all":      return {}
  }
}
