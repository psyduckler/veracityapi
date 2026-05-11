import { describe, expect, it, vi } from "vitest";
import { VeracityClient, VeracityApiError } from "../src/veracity-client.js";

describe("VeracityClient", () => {
  it("sends bearer auth to analyze audio", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "aud_1", risk_level: "low" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    const result = await client.analyzeAudio({ audio_url: "https://example.com/clip.mp3", store_content: false, context: { format: "other", intended_use: "other" } });

    expect(result).toMatchObject({ analysis_id: "aud_1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer vapi_secret" }),
      body: JSON.stringify({ type: "audio", content: "https://example.com/clip.mp3", context: { format: "other", intended_use: "other" }, store_content: false })
    }));
  });

  it("fails at call time when API key is missing", async () => {
    const client = new VeracityClient({ apiKey: "", baseUrl: "https://api.example.test", fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(client.getBalance()).rejects.toThrow(/VERACITY_API_KEY/);
  });

  it("maps insufficient balance errors without leaking key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "insufficient_balance", message: "This request costs $0.01.", top_up_url: "https://veracityapi.com/account" }), { status: 402 }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getBalance()).rejects.toMatchObject({ status: 402 });
    await client.getBalance().catch((err) => {
      expect(String(err.message)).not.toContain("vapi_secret");
      expect(err).toBeInstanceOf(VeracityApiError);
    });
  });
});
