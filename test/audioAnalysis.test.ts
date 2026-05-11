import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreAudio } from "../src/llm";
import type { AnalyzeAudioRequest } from "../src/types";
import { parseAnalyzeAudioRequest } from "../src/validate";

function req(body: unknown) {
  return new Request("https://example.com/v1/analyze-audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseAnalyzeAudioRequest", () => {
  it("accepts store_content:false as the primary no-storage field", async () => {
    const parsed = await parseAnalyzeAudioRequest(req({ audio_url: "https://example.com/clip.mp3", store_content: false }));
    expect(parsed.privacy_mode).toBe(true);
  });
});

describe("scoreAudio", () => {
  it("asks Gemini to transcribe audio and returns the transcript", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        const body = JSON.parse(String(init?.body));
        calls.push({ url, body });
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({
                transcript: "Send the transfer before noon.",
                synthetic_audio_risk: 0.2,
                workflow_risk: 0.3,
                confidence: "medium",
                evidence: [],
                recommended_fixes: ["Verify sender identity before acting."],
              }) }],
            },
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "audio/mpeg", "content-length": "4" },
      });
    }));

    const input: AnalyzeAudioRequest = {
      audio_url: "https://cdn.example.com/clip.mp3",
      context: { format: "social_post", intended_use: "publish" },
      privacy_mode: true,
    };
    const result = await scoreAudio(input, { GEMINI_API_KEY: "test", DB: {} as any, ANTHROPIC_API_KEY: "" });

    expect(result.transcript).toBe("Send the transfer before noon.");
    expect(result.synthetic_audio_risk).toBeGreaterThanOrEqual(0.2);
    const prompt = String((calls[0].body as any).contents[0].parts[0].text);
    expect(prompt).toContain("Return ONLY JSON with keys: transcript");
    expect(prompt).toContain("best-effort transcription");
  });
});
