import type { DerivedTrustSignals, EvidenceItem, IntendedUse, RecommendedAction, RiskLevel } from "./types";

export function clamp01(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, n));
}

export function round2(value: number): number {
  return Math.round(clamp01(value) * 100) / 100;
}

export function deriveTrustSignals(syntheticRisk: number, slopRisk: number, evidence: EvidenceItem[] = []): DerivedTrustSignals {
  const slop = clamp01(slopRisk);
  const syntheticTexture = clamp01(syntheticRisk);
  const hasProvenanceSignal = evidence.some((item) => /provenance|source|citation|unsupported|absence|specificity|generic/i.test(`${item.type} ${item.explanation}`));
  const provenanceWeakness = round2(Math.max(slop * 0.75, hasProvenanceSignal ? slop : slop * 0.55));
  const specificityRisk = round2(slop);
  const contentTrustPenalty = Math.max(specificityRisk, provenanceWeakness, syntheticTexture * 0.5);
  return {
    content_trust_score: round2(1 - contentTrustPenalty),
    specificity_risk: specificityRisk,
    provenance_weakness: provenanceWeakness,
    synthetic_texture_risk: round2(syntheticTexture),
  };
}

export function deriveRiskLevel(syntheticRisk: number, slopRisk: number): RiskLevel {
  const maxRisk = Math.max(clamp01(syntheticRisk), clamp01(slopRisk));
  if (maxRisk < 0.4) return "low";
  if (maxRisk < 0.7) return "medium";
  return "high";
}

export function deriveImageRiskLevel(syntheticImageRisk: number): RiskLevel {
  const risk = clamp01(syntheticImageRisk);
  if (risk < 0.4) return "low";
  if (risk < 0.7) return "medium";
  return "high";
}

export function deriveImageTrustScore(syntheticImageRisk: number): number {
  return round2(1 - clamp01(syntheticImageRisk));
}

export function derivePrimaryReason(kind: "text" | "image" | "audio", scored: { evidence?: Array<Pick<EvidenceItem, "type">> }): string {
  const firstEvidenceType = scored.evidence?.find((item) => item.type)?.type;
  if (firstEvidenceType) return firstEvidenceType;
  if (kind === "image") return "visible_synthetic_media_cues";
  if (kind === "audio") return "synthetic_speech_cues";
  return "unsupported_generic_claims";
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


export function deriveAudioRiskLevel(syntheticAudioRisk: number, workflowRisk: number): RiskLevel {
  const combined = Math.max(clamp01(syntheticAudioRisk), clamp01(workflowRisk));
  if (combined >= 0.55) return "high";
  if (combined >= 0.30) return "medium";
  return "low";
}

export function deriveAudioTrustScore(syntheticAudioRisk: number, workflowRisk: number): number {
  return round2(1 - Math.max(clamp01(syntheticAudioRisk), clamp01(workflowRisk)));
}
