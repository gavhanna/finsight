import { describe, it, expect } from "vitest"
import { getMedian, classifyInterval, toMonthlyEquiv } from "./recurring"

describe("getMedian", () => {
  it("returns 0 for empty array", () => {
    expect(getMedian([])).toBe(0)
  })
  it("returns the single value for a one-element array", () => {
    expect(getMedian([30])).toBe(30)
  })
  it("returns middle value for odd-length array", () => {
    expect(getMedian([10, 30, 50])).toBe(30)
  })
  it("returns average of two middle values for even-length array", () => {
    expect(getMedian([10, 20, 30, 40])).toBe(25)
  })
  it("sorts before computing (does not assume sorted input)", () => {
    expect(getMedian([50, 10, 30])).toBe(30)
  })
})

describe("classifyInterval", () => {
  it("classifies 1 as Daily", () => expect(classifyInterval(1)).toBe("Daily"))
  it("classifies 7 as Weekly", () => expect(classifyInterval(7)).toBe("Weekly"))
  it("classifies 14 as Fortnightly", () => expect(classifyInterval(14)).toBe("Fortnightly"))
  it("classifies 30 as Monthly", () => expect(classifyInterval(30)).toBe("Monthly"))
  it("classifies 60 as Every 2 months", () => expect(classifyInterval(60)).toBe("Every 2 months"))
  it("classifies 91 as Quarterly", () => expect(classifyInterval(91)).toBe("Quarterly"))
  it("classifies 180 as Every 6 months", () => expect(classifyInterval(180)).toBe("Every 6 months"))
  it("classifies 365 as Annual", () => expect(classifyInterval(365)).toBe("Annual"))
  it("returns null for irregular interval (e.g. 45 days)", () => expect(classifyInterval(45)).toBeNull())
  it("returns null for interval of 0", () => expect(classifyInterval(0)).toBeNull())
})

describe("toMonthlyEquiv", () => {
  it("Monthly stays the same", () => expect(toMonthlyEquiv(100, "Monthly")).toBe(100))
  it("Annual divides by 12", () => expect(toMonthlyEquiv(120, "Annual")).toBe(10))
  it("Quarterly divides by 3", () => expect(toMonthlyEquiv(90, "Quarterly")).toBe(30))
  it("Weekly multiplies by 4.33", () => expect(toMonthlyEquiv(10, "Weekly")).toBeCloseTo(43.3))
})
