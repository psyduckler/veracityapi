import { describe, expect, it, vi } from "vitest";
import { VeracityClient, VeracityApiError } from "../src/veracity-client.js";

describe("VeracityClient", () => {
  it("verifyContent auto-detects image URLs and sends unified analyze requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "img_1", modality: "image", recommended_action: "allow" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    const result = await client.verifyContent({ content: "https://cdn.example.com/image.png", content_type: "auto", intended_use: "publish", custom_policy: "Flag medical claims without evidence." });

    expect(result).toMatchObject({ analysis_id: "img_1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "image", content: "https://cdn.example.com/image.png", context: { intended_use: "publish", domain: undefined, custom_policy: "Flag medical claims without evidence." }, store_content: false })
    }));
  });

  it("verifyContent sends base64 media as explicit source objects", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "aud_1", modality: "audio", recommended_action: "human_review" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    await client.verifyContent({ content: "UklGRg==", content_type: "audio", media_type: "audio/wav", transcript: "hello world" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "audio", content: "", source: { kind: "base64", media_type: "audio/wav", data: "UklGRg==" }, transcript: "hello world", context: { intended_use: "other", domain: undefined, custom_policy: undefined }, store_content: false })
    }));
  });

  it("sends bearer auth to analyze audio", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "aud_1", risk_level: "low" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    const result = await client.analyzeAudio({ audio_url: "https://example.com/clip.mp3", store_content: true, privacy_mode: false, context: { format: "other", intended_use: "other" } });

    expect(result).toMatchObject({ analysis_id: "aud_1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer vapi_secret" }),
      body: JSON.stringify({ type: "audio", content: "https://example.com/clip.mp3", context: { format: "other", intended_use: "other" }, store_content: false })
    }));
  });

  it("forces image media storage off even if legacy privacy flags request opt-in", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "img_1", risk_level: "low" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    await client.analyzeImage({ image_url: "https://example.com/image.jpg", store_content: true, privacy_mode: false, context: { format: "other", intended_use: "other" } });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ type: "image", content: "https://example.com/image.jpg", context: { format: "other", intended_use: "other" }, store_content: false })
    }));
  });

  it("sends direct video requests to the private-beta endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "vid_1", modality: "video", recommended_action: "human_review" }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    const result = await client.analyzeVideo({ video_url: "https://example.com/clip.mp4", store_content: true, privacy_mode: false, context: { format: "social_post", intended_use: "moderate" } });

    expect(result).toMatchObject({ analysis_id: "vid_1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze-video", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer vapi_secret" }),
      body: JSON.stringify({ video_url: "https://example.com/clip.mp4", context: { format: "social_post", intended_use: "moderate" }, store_content: false })
    }));
  });

  it("sends analyze batch requests to the batch endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ batch_id: "bat_1", results: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityClient({ apiKey: "vapi_secret", baseUrl: "https://api.example.test", fetchImpl: fetchMock as typeof fetch });

    await client.analyzeBatch({ items: [{ id: "one", text: "This sample text is long enough to analyze." }], store_content: false, context: { format: "other", intended_use: "other" } });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze-batch", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ items: [{ id: "one", text: "This sample text is long enough to analyze." }], context: { format: "other", intended_use: "other" }, store_content: false })
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
