import { vi, describe, it, expect } from "vitest"

// Mock the db and constants modules so importing the categoriser doesn't
// attempt a real database connection during tests.
vi.mock("../../db/index.server", () => ({ db: {} }))
vi.mock("../../lib/constants", () => ({ MCC_CATEGORY_MAP: {} }))

import { matchesField } from "./categoriser.server"
import type { RulePattern } from "../../db/schema"

function pattern(
  p: string,
  field: RulePattern["field"],
  matchType: RulePattern["matchType"],
): RulePattern {
  return { id: 0, ruleId: 0, pattern: p, field, matchType }
}

const tx = {
  amount: -10,
  description: "NETFLIX SUBSCRIPTION",
  creditorName: "Netflix Inc.",
  debtorName: null,
  merchantCategoryCode: "5815",
}

describe("matchesField — contains", () => {
  it("matches when pattern is a substring", () => {
    expect(matchesField(pattern("netflix", "description", "contains"), tx)).toBe(true)
  })
  it("is case-insensitive", () => {
    expect(matchesField(pattern("NetFlix", "description", "contains"), tx)).toBe(true)
  })
  it("does not match unrelated text", () => {
    expect(matchesField(pattern("spotify", "description", "contains"), tx)).toBe(false)
  })
  it("matches on creditorName field", () => {
    expect(matchesField(pattern("netflix inc", "creditorName", "contains"), tx)).toBe(true)
  })
})

describe("matchesField — exact", () => {
  it("matches the full description exactly (case-insensitive)", () => {
    expect(matchesField(pattern("netflix subscription", "description", "exact"), tx)).toBe(true)
  })
  it("does not match a partial value", () => {
    expect(matchesField(pattern("netflix", "description", "exact"), tx)).toBe(false)
  })
})

describe("matchesField — startsWith", () => {
  it("matches when description starts with pattern", () => {
    expect(matchesField(pattern("netflix", "description", "startsWith"), tx)).toBe(true)
  })
  it("does not match when pattern is in the middle", () => {
    expect(matchesField(pattern("subscription", "description", "startsWith"), tx)).toBe(false)
  })
})

describe("matchesField — null/missing values", () => {
  it("returns false when the target field is null", () => {
    expect(matchesField(pattern("anything", "debtorName", "contains"), tx)).toBe(false)
  })
  it("returns false when the target field is undefined", () => {
    const txNoMcc = { ...tx, merchantCategoryCode: undefined }
    expect(matchesField(pattern("5815", "merchantCategoryCode", "contains"), txNoMcc)).toBe(false)
  })
})

describe("matchesField — MCC field", () => {
  it("matches on merchantCategoryCode", () => {
    expect(matchesField(pattern("5815", "merchantCategoryCode", "exact"), tx)).toBe(true)
  })
})
