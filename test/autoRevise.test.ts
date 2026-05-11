import { afterEach, describe, expect, it, vi } from "vitest";
import { priceForChars } from "../src/billing";
import { reviseText, scoreText } from "../src/llm";
import type { AnalyzeRequest, EvidenceType } from "../src/types";
import { parseAnalyzeRequest, parseUnifiedAnalyzeRequest } from "../src/validate";
import { openApiSpec } from "../src/discovery";

function req(body: unknown) {
  return new Request("https://example.com/v1/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseText = "This is a sufficiently long generic draft that needs concrete examples and cleaner phrasing before publication.";
const baseRequest: AnalyzeRequest = {
  text: baseText,
  context: { format: "article", intended_use: "publish", domain: "travel safety" },
  privacy_mode: true,
  auto_revise: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("auto_revise request and pricing contract", () => {
  it("parses auto_revise on typed and unified text requests", async () => {
    await expect(parseAnalyzeRequest(req({ text: baseText, auto_revise: true }))).resolves.toMatchObject({ auto_revise: true });
    await expect(parseUnifiedAnalyzeRequest(req({ type: "text", content: baseText, auto_revise: true }))).resolves.toMatchObject({ type: "text", auto_revise: true });
  });

  it("charges $0.010 per 1k characters when analyze+revise is requested", () => {
    expect(priceForChars(1000, false)).toEqual({ bucket: "text_1k_units", priceCents: 0.5, billableUnits: 1 });
    expect(priceForChars(1000, true)).toEqual({ bucket: "text_revise_1k_units", priceCents: 1, billableUnits: 1 });
    expect(priceForChars(1001, true)).toEqual({ bucket: "text_revise_1k_units", priceCents: 2, billableUnits: 2 });
  });
});

describe("strict evidence enums", () => {
  it("normalizes model evidence types to deterministic enums", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      content: [{
        type: "tool_use",
        name: "return_content_risk_score",
        input: {
          synthetic_risk: 0.2,
          slop_risk: 0.55,
          confidence: "medium",
          evidence: [
            { type: "generic_phrasing", severity: "medium", span: "overall", explanation: "Generic phrasing." },
            { type: "surprise_new_type", severity: "low", span: "overall", explanation: "Unknown signal." },
          ],
          recommended_fixes: ["Add named examples."],
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const scored = await scoreText(baseRequest, { ANTHROPIC_API_KEY: "test", DB: {} as any });
    expect(scored.evidence.map((item) => item.type)).toEqual<EvidenceType[]>(["generic_phrasing", "other"]);
  });
});

describe("reviseText", () => {
  it("returns revised_text and notes from an internal LLM pass", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      content: [{
        type: "tool_use",
        name: "return_revised_text",
        input: {
          revised_text: "At Shinjuku Station's east exit, watch for strangers claiming ticket machines are broken and asking tourists for cash.",
          revision_notes: ["Added named location and concrete behavior."],
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await reviseText(baseRequest, ["Replace generic warnings with named examples."], { ANTHROPIC_API_KEY: "test", DB: {} as any });
    expect(result.revised_text).toContain("Shinjuku Station");
    expect(result.revision_notes).toEqual(["Added named location and concrete behavior."]);
  });
});

describe("OpenAPI auto-revise contract", () => {
  it("documents auto_revise, revised_text, actionable descriptions, and evidence enum values", () => {
    const spec = openApiSpec();
    const json = JSON.stringify(spec);
    expect(json).toContain("auto_revise");
    expect(json).toContain("Analyze + revise");
    expect(json).toContain("revised_text");
    expect(json).toContain("Call this endpoint immediately before publishing");
    expect(json).toContain("generic_phrasing");
    expect(json).toContain("low_specificity");
  });
});
