import type { IntendedUse, RecommendedAction, RiskLevel } from "./types";

export function clamp01(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, n));
}

export function deriveRiskLevel(syntheticRisk: number, slopRisk: number): RiskLevel {
  const maxRisk = Math.max(clamp01(syntheticRisk), clamp01(slopRisk));
  if (maxRisk < 0.4) return "low";
  if (maxRisk < 0.7) return "medium";
  return "high";
}

export function deriveAction(level: RiskLevel, intendedUse: IntendedUse): RecommendedAction {
  const matrix: Record<IntendedUse, Record<RiskLevel, RecommendedAction>> = {
    publish: { low: "allow", medium: "revise", high: "human_review" },
    train: { low: "allow", medium: "human_review", high: "reject" },
    cite: { low: "allow", medium: "human_review", high: "reject" },
    moderate: { low: "allow", medium: "allow", high: "revise" },
    other: { low: "allow", medium: "revise", high: "human_review" },
  };
  return matrix[intendedUse][level];
}
