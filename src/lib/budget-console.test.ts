import { describe, expect, it } from "vitest";
import {
  budgetHistoryVerdict,
  median,
  projectEnvelope,
} from "./budget-console";

describe("budget console", () => {
  it("calculates a median without mutating the source values", () => {
    const values = [30, 10, 20, 40];
    expect(median(values)).toBe(25);
    expect(values).toEqual([30, 10, 20, 40]);
  });

  it("projects an unsettled envelope against elapsed time", () => {
    expect(projectEnvelope({ planned: 300, spent: 200 }, 0.5)).toMatchObject({
      landing: 400,
      miss: 100,
      settled: false,
    });
  });

  it("does not project a fixed envelope beyond its settled spend", () => {
    expect(
      projectEnvelope(
        { planned: 300, spent: 280, note: "Fixed monthly bill" },
        0.5,
      ),
    ).toMatchObject({ landing: 280, miss: -20, settled: true });
  });

  it("distinguishes persistent misses from variable months", () => {
    expect(budgetHistoryVerdict([30, 45, 60, 35, 50, 10])).toBe("Set too low");
    expect(budgetHistoryVerdict([40, -35, 5, 10, 0, 15])).toBe("Variable");
    expect(budgetHistoryVerdict([-20, -10, 5, 0, -5, 10])).toBe("Well set");
  });
});
