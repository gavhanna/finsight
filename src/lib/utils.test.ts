import { describe, it, expect } from "vitest"
import {
  formatYearMonth,
  formatCurrency,
  formatDate,
  startOfMonth,
  endOfMonth,
  startOfYear,
  daysAgo,
  todayStr,
} from "./utils"

describe("formatYearMonth", () => {
  it("formats January correctly", () => expect(formatYearMonth("2025-01")).toBe("Jan '25"))
  it("formats December correctly", () => expect(formatYearMonth("2025-12")).toBe("Dec '25"))
  it("formats mid-year month correctly", () => expect(formatYearMonth("2024-07")).toBe("Jul '24"))
  it("handles year boundary (2000)", () => expect(formatYearMonth("2000-03")).toBe("Mar '00"))
})

describe("formatCurrency", () => {
  it("formats a positive amount as EUR by default", () => {
    expect(formatCurrency(1234.56)).toContain("1,234.56")
  })
  it("formats a negative amount", () => {
    expect(formatCurrency(-50)).toContain("50.00")
  })
  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0.00")
  })
  it("uses the provided currency symbol", () => {
    expect(formatCurrency(100, "GBP")).toContain("100.00")
  })
})

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string", () => {
    expect(formatDate("2025-03-15")).toBe("15 Mar 2025")
  })
  it("formats a Date object", () => {
    expect(formatDate(new Date(2024, 0, 1))).toBe("1 Jan 2024")
  })
})

describe("startOfMonth", () => {
  it("returns the first day of the given month", () => {
    expect(startOfMonth(new Date(2025, 2, 15))).toBe("2025-03-01")
  })
  it("handles January", () => {
    expect(startOfMonth(new Date(2025, 0, 31))).toBe("2025-01-01")
  })
})

describe("endOfMonth", () => {
  it("returns the last day of March", () => {
    expect(endOfMonth(new Date(2025, 2, 1))).toBe("2025-03-31")
  })
  it("returns the last day of February (non-leap year)", () => {
    expect(endOfMonth(new Date(2025, 1, 1))).toBe("2025-02-28")
  })
  it("returns the last day of February (leap year)", () => {
    expect(endOfMonth(new Date(2024, 1, 1))).toBe("2024-02-29")
  })
})

describe("startOfYear", () => {
  it("returns Jan 1 of the given year", () => {
    expect(startOfYear(new Date(2025, 5, 15))).toBe("2025-01-01")
  })
})

describe("daysAgo", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    expect(daysAgo(30)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it("returns a date strictly before today", () => {
    expect(daysAgo(1) < todayStr()).toBe(true)
  })
  it("returns today for 0 days ago", () => {
    expect(daysAgo(0)).toBe(todayStr())
  })
})
