export type Modality = "text" | "image" | "audio" | "asset" | "content";

export function summarizeAnalysisResult(modality: Modality, result: Record<string, unknown>): string {
  const risk = stringValue(result.risk_level, "unknown");
  const action = stringValue(result.recommended_action, "unknown");
  const trust = numberValue(result.content_trust_score);
  const scores = modalityScores(modality, result);
  const evidence = firstStrings(result.evidence, "explanation", 3);
  const fixes = firstStrings(result.recommended_fixes, undefined, 3);
  const limitations = firstStrings(result.limitations, undefined, 2);

  return [
    `VeracityAPI ${modality} result: ${risk} risk, recommended_action=${action}${trust === undefined ? "" : `, content_trust_score=${trust}`}.`,
    scores,
    evidence.length ? `Top evidence: ${evidence.join(" | ")}.` : "Top evidence: none returned.",
    fixes.length ? `Recommended fixes: ${fixes.join(" | ")}.` : "Recommended fixes: none returned.",
    limitations.length ? `Limitations: ${limitations.join(" | ")}. This is a workflow risk signal, not proof.` : "Limitations: workflow risk signal, not proof of authorship, truth, AI generation, voice cloning, or speaker identity.",
  ].filter(Boolean).join("\n");
}

export function summarizeBalance(result: Record<string, unknown>): string {
  const balanceCents = typeof result.balance_cents === "number" ? result.balance_cents : 0;
  const recent = typeof result.recent_usage === "object" && result.recent_usage ? result.recent_usage as Record<string, unknown> : {};
  return `VeracityAPI balance: ${formatDollars(balanceCents)} ${stringValue(result.currency, "USD")}. Recent usage: today=${formatDollars(num(recent.today_cents))}, 7d=${formatDollars(num(recent.last_7_days_cents))}, 30d=${formatDollars(num(recent.last_30_days_cents))}. Top up at https://veracityapi.com/account.`;
}

export function formatToolError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function modalityScores(modality: Modality, result: Record<string, unknown>): string {
  if (modality === "text") {
    return ["synthetic_texture_risk", "slop_risk", "specificity_risk", "provenance_weakness"].map((key) => scorePart(key, result)).filter(Boolean).join(", ");
  }
  if (modality === "image") return [scorePart("synthetic_image_risk", result), scorePart("synthetic_risk", result)].filter(Boolean).join(", ");
  return [scorePart("synthetic_audio_risk", result), scorePart("workflow_risk", result), scorePart("synthetic_risk", result)].filter(Boolean).join(", ");
}

function scorePart(key: string, result: Record<string, unknown>): string | undefined {
  const value = numberValue(result[key]);
  return value === undefined ? undefined : `${key}=${value}`;
}

function firstStrings(value: unknown, field?: string, limit = 3): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item) => {
    if (field && typeof item === "object" && item) return String((item as Record<string, unknown>)[field] ?? "").trim();
    return String(item ?? "").trim();
  }).filter(Boolean);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
