import { describe, expect, it } from "vitest";
import { analyzeAudioInputSchema, analyzeImageInputSchema, analyzeTextInputSchema, toolInputSchemas } from "../src/schemas.js";

describe("MCP input schemas", () => {
  it("defaults text context and raw-content storage", () => {
    const parsed = analyzeTextInputSchema.parse({ text: "This is a sufficiently long piece of text to analyze for workflow risk." });
    expect(parsed.store_content).toBe(false);
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
    expect(parsed.store_content).toBe(false);
    expect(parsed.transcript).toBe("optional context");
    expect(parsed.context.format).toBe("other");
  });

  it("documents media privacy as no raw-byte or full-URL storage", () => {
    const imageStore = String(toolInputSchemas.analyze_image.properties.store_content.description);
    const audioStore = String(toolInputSchemas.analyze_audio.properties.store_content.description);
    const mediaCopy = `${imageStore} ${audioStore}`;
    expect(mediaCopy).toContain("only supported media-storage behavior");
    expect(mediaCopy).toContain("do not store image bytes or full image URLs");
    expect(mediaCopy).toContain("do not store audio bytes, base64, or full audio URLs");
    expect(mediaCopy).not.toContain("raw text retained");
  });

  it("rejects non-HTTPS audio URLs", () => {
    expect(() => analyzeAudioInputSchema.parse({ audio_url: "http://example.com/clip.mp3" })).toThrow(/https/i);
  });
});
