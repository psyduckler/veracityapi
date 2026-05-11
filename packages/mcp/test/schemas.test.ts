import { describe, expect, it } from "vitest";
import { analyzeAudioInputSchema, analyzeImageInputSchema, analyzeTextInputSchema } from "../src/schemas.js";

describe("MCP input schemas", () => {
  it("defaults text context and privacy mode", () => {
    const parsed = analyzeTextInputSchema.parse({ text: "This is a sufficiently long piece of text to analyze for workflow risk." });
    expect(parsed.privacy_mode).toBe(true);
    expect(parsed.context.format).toBe("other");
    expect(parsed.context.intended_use).toBe("other");
  });

  it("rejects too-short text", () => {
    expect(() => analyzeTextInputSchema.parse({ text: "too short" })).toThrow(/Too small|20/);
  });

  it("requires HTTPS image URLs", () => {
    expect(() => analyzeImageInputSchema.parse({ image_url: "http://example.com/image.jpg" })).toThrow(/https/i);
  });

  it("matches the live audio contract", () => {
    const parsed = analyzeAudioInputSchema.parse({ audio_url: "https://example.com/clip.mp3", transcript: "optional context" });
    expect(parsed.privacy_mode).toBe(true);
    expect(parsed.transcript).toBe("optional context");
    expect(parsed.context.format).toBe("other");
  });

  it("rejects non-HTTPS audio URLs", () => {
    expect(() => analyzeAudioInputSchema.parse({ audio_url: "http://example.com/clip.mp3" })).toThrow(/https/i);
  });
});
