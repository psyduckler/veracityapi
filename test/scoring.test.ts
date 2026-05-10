import { describe, expect, it } from "vitest";
import { deriveAction, deriveRiskLevel } from "../src/scoring";
import type { IntendedUse, RiskLevel } from "../src/types";

describe("deriveRiskLevel", () => {
  it("maps max risk into low/medium/high", () => {
    expect(deriveRiskLevel(0.1, 0.39)).toBe("low");
    expect(deriveRiskLevel(0.4, 0.2)).toBe("medium");
    expect(deriveRiskLevel(0.2, 0.69)).toBe("medium");
    expect(deriveRiskLevel(0.7, 0.1)).toBe("high");
  });
});

describe("deriveAction", () => {
  const expected: Record<IntendedUse, Record<RiskLevel, string>> = {
    publish: { low: "allow", medium: "revise", high: "human_review" },
    train: { low: "allow", medium: "human_review", high: "reject" },
    cite: { low: "allow", medium: "human_review", high: "reject" },
    moderate: { low: "allow", medium: "allow", high: "revise" },
    other: { low: "allow", medium: "revise", high: "human_review" },
  };

  for (const intendedUse of Object.keys(expected) as IntendedUse[]) {
    for (const level of Object.keys(expected[intendedUse]) as RiskLevel[]) {
      it(`${intendedUse} ${level}`, () => {
        expect(deriveAction(level, intendedUse)).toBe(expected[intendedUse][level]);
      });
    }
  }
});
