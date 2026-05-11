import { afterEach, describe, expect, it, vi } from "vitest";
import { debitForImage } from "../src/billing";
import { logAnalysis } from "../src/db";
import { scoreImage } from "../src/llm";
import { deriveImageRiskLevel } from "../src/scoring";
import type { AnalyzeImageRequest, AnalyzeImageResponse } from "../src/types";
import { parseAnalyzeImageRequest, ValidationError } from "../src/validate";

function req(body: unknown) {
  return new Request("https://example.com/v1/analyze-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private db: FakeDb, private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.values); }
  async run() { return this.db.run(this.sql, this.values); }
  async all<T>() { return { results: [] as T[] }; }
}

class FakeDb {
  accounts = new Map<string, { balance_cents: number }>();
  ledger: Array<{ type: string; amount_cents: number; metadata: Record<string, unknown> }> = [];
  usage: Array<{ chars_analyzed: number; bucket: string; price_cents: number; status: string }> = [];
  logs: Array<Record<string, unknown>> = [];

  prepare(sql: string) { return new FakeStatement(this, sql); }

  async first<T>(sql: string, values: unknown[]): Promise<T | null> {
    if (sql.includes("SELECT balance_cents FROM accounts")) {
      const account = this.accounts.get(String(values[0]));
      return account ? ({ balance_cents: account.balance_cents } as T) : null;
    }
    return null;
  }

  async run(sql: string, values: unknown[]) {
    if (sql.startsWith("UPDATE accounts SET balance_cents = balance_cents -")) {
      const price = Number(values[0]);
      const accountId = String(values[2]);
      const account = this.accounts.get(accountId);
      if (!account || account.balance_cents < price) return { meta: { changes: 0 } };
      account.balance_cents -= price;
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO credit_ledger")) {
      this.ledger.push({ type: sql.includes("image_analysis_debit") ? "image_analysis_debit" : "usage_debit", amount_cents: Number(values[2]), metadata: JSON.parse(String(values[5])) });
    } else if (sql.startsWith("INSERT INTO usage_events")) {
      this.usage.push({ chars_analyzed: Number(values[4]), bucket: String(values[5]), price_cents: Number(values[6]), status: "debited" });
    } else if (sql.startsWith("INSERT INTO analysis_logs")) {
      this.logs.push({
        analysis_id: values[0],
        privacy_mode: values[3],
        text_hash: values[4],
        text: values[5],
        kind: values[10],
        image_url_domain: values[11],
      });
    }
    return { meta: { changes: 1 } };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseAnalyzeImageRequest", () => {
  it("accepts https image URLs and reuses text context defaults", async () => {
    const parsed = await parseAnalyzeImageRequest(req({ image_url: "https://cdn.example.com/photo.jpg" }));
    expect(parsed).toEqual({
      image_url: "https://cdn.example.com/photo.jpg",
      context: { format: "other", intended_use: "other", domain: undefined },
      privacy_mode: true,
    });
  });

  it("rejects non-https image URLs", async () => {
    await expect(parseAnalyzeImageRequest(req({ image_url: "http://localhost/admin.png" }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scoreImage", () => {
  it("calls Anthropic with an image URL block and normalizes structured scoring", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({
        content: [{
          type: "tool_use",
          name: "return_image_risk_score",
          input: {
            synthetic_image_risk: 0.72,
            confidence: "medium",
            evidence: [{ type: "hand_artifact", severity: "high", span: "left hand has fused fingers", explanation: "Visible anatomy artifact." }],
            recommended_fixes: ["Verify provenance before publishing."],
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const result = await scoreImage({ image_url: "https://cdn.example.com/photo.jpg", context: { format: "article", intended_use: "publish" }, privacy_mode: true } as AnalyzeImageRequest, { ANTHROPIC_API_KEY: "test", API_KEYS: "", DB: {} } as any);

    expect(result.synthetic_image_risk).toBe(0.72);
    expect(result.synthetic_risk).toBe(0.72);
    expect(result.evidence[0].span).toBe("left hand has fused fingers");
    const body = calls[0] as any;
    expect(body.messages[0].content[0]).toEqual({ type: "image", source: { type: "url", url: "https://cdn.example.com/photo.jpg" } });
  });
});

describe("image billing and logging", () => {
  it("falls back to base64 fetch when Anthropic rejects URL image source", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("api.anthropic.com")) {
        const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
        if (calls === 1) return new Response(JSON.stringify({ error: { message: "source: Field required" } }), { status: 400 });
        const body = await ((fetch as ReturnType<typeof vi.fn>).mock.calls[2][1] as RequestInit).body as string;
        expect(body).toContain('"type":"base64"');
        expect(body).toContain('"media_type":"image/png"');
        return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "return_image_risk_score", input: { synthetic_image_risk: 0.2, confidence: "high", evidence: [], recommended_fixes: [] } }] }), { status: 200 });
      }
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png", "content-length": "4" } });
    }));

    const result = await scoreImage({ image_url: "https://cdn.example.com/photo.png", context: { format: "article", intended_use: "publish" }, privacy_mode: true } as AnalyzeImageRequest, { ANTHROPIC_API_KEY: "test", API_KEYS: "", DB: {} as any });

    expect(result.synthetic_image_risk).toBe(0.2);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("debits exactly 2 cents for image analysis", async () => {
    const db = new FakeDb();
    db.accounts.set("acct_1", { balance_cents: 150 });

    const billing = await debitForImage({ DB: db } as any, "acct_1", "key_1", "img_1");

    expect(billing).toEqual({ units_analyzed: 1, bucket: "image_v0", price_cents: 2, remaining_balance_cents: 148 });
    expect(db.accounts.get("acct_1")?.balance_cents).toBe(148);
    expect(db.ledger[0]).toMatchObject({ type: "image_analysis_debit", amount_cents: -2 });
    expect(db.ledger[0].metadata).toMatchObject({ api_key_id: "key_1", units_analyzed: 1, bucket: "image_v0" });
    expect(db.usage[0]).toMatchObject({ chars_analyzed: 1, bucket: "image_v0", price_cents: 2 });
  });

  it("logs image analyses without raw URLs or raw image bytes", async () => {
    const db = new FakeDb();
    const request: AnalyzeImageRequest = { image_url: "https://cdn.example.com/path/photo.jpg?token=secret", context: { format: "article", intended_use: "publish" }, privacy_mode: true };
    const response: AnalyzeImageResponse = {
      analysis_id: "img_1",
      content_trust_score: 0.28,
      synthetic_image_risk: 0.72,
      synthetic_risk: 0.72,
      confidence: "medium",
      evidence: [],
      recommended_fixes: [],
      risk_level: "high",
      recommended_action: "human_review",
      primary_reason: "visible_synthetic_media_cues",
      model_version: "v0.1",
      limitations: [],
    };

    await logAnalysis({ env: { DB: db } as any, analysisId: "img_1", apiKeyHash: "hash", request, response, latencyMs: 25, kind: "image" });

    expect(db.logs[0]).toMatchObject({ kind: "image", image_url_domain: "cdn.example.com", text: null });
    expect(String(db.logs[0].text_hash)).toHaveLength(64);
  });
});

describe("deriveImageRiskLevel", () => {
  it("uses the same low/medium/high thresholds as text", () => {
    expect(deriveImageRiskLevel(0.39)).toBe("low");
    expect(deriveImageRiskLevel(0.4)).toBe("medium");
    expect(deriveImageRiskLevel(0.7)).toBe("high");
  });
});
