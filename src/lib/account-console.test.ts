import { describe, expect, it } from "vitest";
import {
  aggregateBalanceHistory,
  makeMonthKeys,
  monthEndBalance,
  syncCallsRemaining,
} from "./account-console";

describe("account console", () => {
  it("resets the daily sync allowance on a new day", () => {
    expect(
      syncCallsRemaining(
        { syncCallsDate: "2026-09-22", syncCallsToday: 4 },
        "2026-09-23",
      ),
    ).toBe(4);
  });

  it("never reports a negative sync allowance", () => {
    expect(
      syncCallsRemaining(
        { syncCallsDate: "2026-09-23", syncCallsToday: 7 },
        "2026-09-23",
      ),
    ).toBe(0);
  });

  it("builds month keys across a year boundary", () => {
    expect(makeMonthKeys(3, new Date(2026, 1, 15))).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("aggregates balances recorded on the same day", () => {
    expect(
      aggregateBalanceHistory([
        { accountId: "a", balance: 100, recordedAt: "2026-09-01T10:00:00Z" },
        { accountId: "b", balance: -20, recordedAt: "2026-09-01T11:00:00Z" },
      ]),
    ).toEqual([{ date: "2026-09-01", value: 80 }]);
  });

  it("uses the latest known account balance at month end", () => {
    const history = [
      { accountId: "a", balance: 100, recordedAt: "2026-08-15T10:00:00Z" },
      { accountId: "a", balance: 125, recordedAt: "2026-08-31T10:00:00Z" },
      { accountId: "a", balance: 90, recordedAt: "2026-09-01T10:00:00Z" },
    ];
    expect(monthEndBalance(history, "a", "2026-08")).toBe(125);
  });
});
