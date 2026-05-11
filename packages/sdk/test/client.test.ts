import { describe, expect, it, vi } from "vitest";
import { VeracityAPI, VeracityAPIError, createClient } from "../src/index.js";

describe("@veracityapi/sdk", () => {
  it("sends typed text analyze requests with bearer auth and privacy defaults", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      analysis_id: "ana_123",
      modality: "text",
      recommended_action: "human_review",
      risk_level: "high",
      confidence: "medium",
      evidence: [],
      recommended_fixes: [],
      limitations: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new VeracityAPI({ apiKey: "vapi_test", baseUrl: "https://api.example.test/", fetch: fetchMock as typeof fetch });

    const result = await client.analyzeText({
      text: "This generic travel warning is long enough for the analyzer to inspect.",
      auto_revise: true,
      context: { format: "article", intended_use: "publish", domain: "travel safety" },
    });

    expect(result.recommended_action).toBe("human_review");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/analyze", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer vapi_test",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        type: "text",
        content: "This generic travel warning is long enough for the analyzer to inspect.",
        auto_revise: true,
        context: { format: "article", intended_use: "publish", domain: "travel safety" },
        store_content: false,
      }),
    }));
  });

  it("supports createClient and sends image/audio requests through the unified endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis_id: "ana_media", recommended_action: "allow", modality: "image" }), { status: 200 }));
    const client = createClient({ apiKey: "vapi_test", baseUrl: "https://api.example.test", fetch: fetchMock as typeof fetch });

    await client.analyzeImage({ imageUrl: "https://cdn.example.com/photo.webp", context: { intended_use: "moderate" }, storeContent: true });
    await client.analyzeAudio({ audioUrl: "https://cdn.example.com/clip.mp3", transcript: "Caller supplied transcript." });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/v1/analyze", expect.objectContaining({
      body: JSON.stringify({
        type: "image",
        content: "https://cdn.example.com/photo.webp",
        context: { intended_use: "moderate" },
        store_content: false,
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/v1/analyze", expect.objectContaining({
      body: JSON.stringify({
        type: "audio",
        content: "https://cdn.example.com/clip.mp3",
        transcript: "Caller supplied transcript.",
        context: undefined,
        store_content: false,
      }),
    }));
  });

  it("sends arbitrary unified analyze and batch requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new VeracityAPI({ apiKey: "vapi_test", baseUrl: "https://api.example.test", fetch: fetchMock as typeof fetch });

    await client.analyze({
      type: "image",
      content: "",
      source: { kind: "base64", media_type: "image/png", data: "iVBORw0KGgo=" },
      store_content: false,
    });
    await client.analyzeBatch({
      items: [{ id: "one", text: "This batch item is long enough for scoring." }],
      context: { format: "other", intended_use: "publish" },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/v1/analyze", expect.objectContaining({
      body: JSON.stringify({ type: "image", content: "", source: { kind: "base64", media_type: "image/png", data: "iVBORw0KGgo=" }, store_content: false }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/v1/analyze-batch", expect.objectContaining({
      body: JSON.stringify({ items: [{ id: "one", text: "This batch item is long enough for scoring." }], context: { format: "other", intended_use: "publish" }, store_content: false }),
    }));
  });

  it("maps API errors with status, request id, and parsed body without leaking credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "insufficient_balance", message: "Top up required." }), {
      status: 402,
      headers: { "x-request-id": "req_123" },
    }));
    const client = new VeracityAPI({ apiKey: "vapi_secret_should_not_leak", baseUrl: "https://api.example.test", fetch: fetchMock as typeof fetch });

    await expect(client.getBalance()).rejects.toMatchObject({ status: 402, requestId: "req_123", body: { error: "insufficient_balance", message: "Top up required." } });
    await client.getBalance().catch((error) => {
      expect(error).toBeInstanceOf(VeracityAPIError);
      expect(String(error.message)).toContain("insufficient balance");
      expect(String(error.message)).not.toContain("vapi_secret_should_not_leak");
    });
  });

  it("fails before the network when no API key is available", async () => {
    const fetchMock = vi.fn();
    const client = new VeracityAPI({ apiKey: "", fetch: fetchMock as typeof fetch });

    await expect(client.getBalance()).rejects.toThrow(/VERACITY_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
