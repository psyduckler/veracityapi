import { describe, expect, it } from "vitest";
import { summarizeAnalysisResult, summarizeBalance } from "../src/summaries.js";

describe("summaries", () => {
  it("summarizes audio results without proof language", () => {
    const summary = summarizeAnalysisResult("audio", {
      risk_level: "medium",
      recommended_action: "human_review",
      content_trust_score: 0.61,
      synthetic_audio_risk: 0.48,
      workflow_risk: 0.52,
      evidence: [{ explanation: "Clip contains synthetic-sounding prosody.", severity: "medium" }],
      recommended_fixes: ["Verify provenance and consent before publishing."],
      limitations: ["Not proof of AI generation."]
    });

    expect(summary).toContain("medium risk");
    expect(summary).toContain("synthetic_audio_risk=0.48");
    expect(summary).toContain("not proof");
  });

  it("summarizes balance with top-up URL", () => {
    const summary = summarizeBalance({
      balance_cents: 149,
      currency: "USD",
      recent_usage: { today_cents: 1, last_7_days_cents: 4, last_30_days_cents: 10 }
    });

    expect(summary).toContain("$1.49");
    expect(summary).toContain("https://veracityapi.com/account");
  });
});
