import { describe, expect, it } from "vitest";
import { parseAnalyzeRequest, ValidationError } from "../src/validate";

function req(body: unknown) {
  return new Request("https://example.com/v1/analyze-text", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseAnalyzeRequest", () => {
  it("applies defaults", async () => {
    const parsed = await parseAnalyzeRequest(req({ text: "This is a sufficiently long piece of text to analyze." }));
    expect(parsed.privacy_mode).toBe(true);
    expect(parsed.context.format).toBe("other");
    expect(parsed.context.intended_use).toBe("other");
  });

  it("accepts valid context", async () => {
    const parsed = await parseAnalyzeRequest(req({
      text: "At Gare du Nord near the RER B machines, a man asked us to sign a fake charity form.",
      context: { format: "article", intended_use: "publish", domain: "travel" },
      privacy_mode: false,
    }));
    expect(parsed.context.format).toBe("article");
    expect(parsed.context.intended_use).toBe("publish");
    expect(parsed.context.domain).toBe("travel");
    expect(parsed.privacy_mode).toBe(false);
  });

  it("rejects short text", async () => {
    await expect(parseAnalyzeRequest(req({ text: "too short" }))).rejects.toBeInstanceOf(ValidationError);
  });
  it("accepts the 100k production pricing limit", async () => {
    const text = "a".repeat(100_000);
    const parsed = await parseAnalyzeRequest(req({ text }));
    expect(parsed.text).toHaveLength(100_000);
  });

  it("rejects text above the 100k production pricing limit", async () => {
    const text = "a".repeat(100_001);
    await expect(parseAnalyzeRequest(req({ text }))).rejects.toBeInstanceOf(ValidationError);
  });

});
