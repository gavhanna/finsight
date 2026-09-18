export type Frequency =
  | "Daily"
  | "Weekly"
  | "Fortnightly"
  | "Monthly"
  | "Every 2 months"
  | "Quarterly"
  | "Every 6 months"
  | "Annual"

export function getMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function classifyInterval(median: number): Frequency | null {
  if (median >= 1 && median <= 2) return "Daily"
  if (median >= 5 && median <= 9) return "Weekly"
  if (median >= 12 && median <= 17) return "Fortnightly"
  if (median >= 24 && median <= 36) return "Monthly"
  if (median >= 55 && median <= 75) return "Every 2 months"
  if (median >= 80 && median <= 100) return "Quarterly"
  if (median >= 160 && median <= 200) return "Every 6 months"
  if (median >= 340 && median <= 390) return "Annual"
  return null
}

export function toMonthlyEquiv(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "Daily":          return amount * 30
    case "Weekly":         return amount * 4.33
    case "Fortnightly":    return amount * 2.17
    case "Monthly":        return amount
    case "Every 2 months": return amount / 2
    case "Quarterly":      return amount / 3
    case "Every 6 months": return amount / 6
    case "Annual":         return amount / 12
  }
}
