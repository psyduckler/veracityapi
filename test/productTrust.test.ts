import { describe, expect, it, vi, afterEach } from "vitest";
import worker from "../src/index";
import { accountHtml, type AccountView } from "../src/account";
import { authenticateUsageKey, BillingAuthError } from "../src/billing";
import { logAnalysis } from "../src/db";
import { openApiSpec, llmsTxt, agentsJson } from "../src/discovery";
import { homepageHtml } from "../src/site";
import type { AnalyzeRequest, AnalyzeResponse } from "../src/types";

class EmptyStatement {
  private values: unknown[] = [];
  constructor(private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
  async run() { return { meta: { changes: 1 } }; }
}

class EmptyDb {
  prepare(sql: string) { return new EmptyStatement(sql); }
}

class LogStatement {
  private values: unknown[] = [];
  constructor(private db: LogDb, private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async run() {
    if (this.sql.startsWith("INSERT INTO analysis_logs")) {
      this.db.logs.push({ privacy_mode: this.values[3], text_hash: this.values[4], text: this.values[5], kind: this.values[10], image_url_domain: this.values[11] });
    }
    return { meta: { changes: 1 } };
  }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
}
class LogDb {
  logs: Array<Record<string, unknown>> = [];
  prepare(sql: string) { return new LogStatement(this, sql); }
}

afterEach(() => vi.restoreAllMocks());

describe("paid endpoint auth", () => {
  it("rejects legacy env API_KEYS instead of allowing an unbilled bypass", async () => {
    const request = new Request("https://api.veracityapi.com/v1/analyze-text", { headers: { authorization: "Bearer legacy-secret" } });

    await expect(authenticateUsageKey(request, { DB: new EmptyDb(), API_KEYS: "legacy-secret", ANTHROPIC_API_KEY: "test" } as any)).rejects.toBeInstanceOf(BillingAuthError);
  });
});

describe("login rate limiting", () => {
  it("rate-limits repeated /auth/login attempts by IP and normalized email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const env = { DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) }, RESEND_API_KEY: "test", RESEND_FROM: "hello@example.com", ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const body = "email=person%40example.com";
    const makeReq = () => new Request("https://veracityapi.com/auth/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": "203.0.113.10" }, body });

    let response = new Response();
    for (let i = 0; i < 3; i++) response = await worker.fetch(makeReq(), env);
    expect(response.status).toBe(200);

    response = await worker.fetch(makeReq(), env);
    expect(response.status).toBe(429);
    expect(await response.text()).toContain("Too many login link requests");
  });
});

describe("OpenAPI and agent discovery", () => {
  it("has operationIds, valid examples, and no unshipped audio claims", () => {
    const spec = openApiSpec() as any;
    for (const [path, pathItem] of Object.entries(spec.paths) as Array<[string, any]>) {
      for (const [method, operation] of Object.entries(pathItem) as Array<[string, any]>) {
        if (operation.operationId !== undefined) expect(operation.operationId, `${method.toUpperCase()} ${path}`).toMatch(/^[a-z][A-Za-z0-9]+$/);
      }
    }
    expect(JSON.stringify(spec)).toMatch(/analyze-audio|synthetic_audio|audio_v0/i);
    expect(JSON.stringify(spec)).toMatch(/not proof|workflow risk|workflow triage/i);

    expect(spec.paths["/v1/analyze-text"].post.responses["402"]).toBeTruthy();
    expect(spec.paths["/v1/analyze-image"].post.operationId).toBe("analyzeImage");
    expect(spec.paths["/v1/analyze-audio"].post.operationId).toBe("analyzeAudio");
    expect(spec.paths["/v1/balance"].get.operationId).toBe("getBalance");
    expect(spec.components.schemas.AnalyzeTextResponse.properties.billing).toBeTruthy();
    expect(spec.components.schemas.AnalyzeImageResponse.properties.billing).toBeTruthy();
    expect(spec.components.schemas.AnalyzeAudioRequest.properties.audio_url.description).toMatch(/HTTPS audio URL/i);
    expect(spec.components.schemas.AnalyzeAudioResponse.properties.billing.properties.bucket.example).toBe("audio_v0");
    expect(spec.components.schemas.BalanceResponse.required).toContain("balance_cents");
    expect(JSON.stringify(spec.components.schemas.AnalyzeAudioRequest)).not.toMatch(/metadata/i);
  });

  it("uses precise signup credit copy in machine-readable discovery", () => {
    const combined = `${llmsTxt()} ${JSON.stringify(agentsJson())}`;
    expect(combined).toContain("$1.50 free credit — enough for 150 short text analyses");
    expect(combined).not.toContain("150 free API calls");
  });
});

describe("privacy logging", () => {
  const request: AnalyzeRequest = { text: "This is a sufficiently long private text sample for scoring.", context: { format: "article", intended_use: "publish" }, privacy_mode: true };
  const response: AnalyzeResponse = { analysis_id: "ana_1", synthetic_risk: 0.2, slop_risk: 0.3, confidence: "medium", evidence: [], recommended_fixes: [], content_trust_score: 0.7, specificity_risk: 0.3, provenance_weakness: 0.3, synthetic_texture_risk: 0.2, risk_level: "low", recommended_action: "allow", model_version: "v0.1", limitations: [] };

  it("does not store raw text when privacy_mode is true", async () => {
    const db = new LogDb();
    await logAnalysis({ env: { DB: db } as any, analysisId: "ana_1", apiKeyHash: "hash", request, response, latencyMs: 10, kind: "text" });
    expect(db.logs[0].text).toBeNull();
    expect(String(db.logs[0].text_hash)).toHaveLength(64);
  });

  it("stores raw text only when privacy_mode is explicitly false", async () => {
    const db = new LogDb();
    const nonPrivate = { ...request, privacy_mode: false };
    await logAnalysis({ env: { DB: db } as any, analysisId: "ana_2", apiKeyHash: "hash", request: nonPrivate, response, latencyMs: 10, kind: "text" });
    expect(db.logs[0].text).toBe(nonPrivate.text);
  });
});

describe("homepage conversion", () => {
  it("leads with the text/slop wedge, shows curl and JSON above the live demo, and has two primary CTAs", () => {
    const html = homepageHtml();
    expect(html).toContain("A content trust gate for agents");
    expect(html).toContain("workflow risk");
    expect(html).toContain("$1.50 free credit — enough for 150 short text analyses");
    expect(html).toContain("curl https://api.veracityapi.com/v1/analyze-text");
    expect(html).toContain('"recommended_action"');
    const hero = html.slice(html.indexOf("<section class=\"hero"), html.indexOf("</section>", html.indexOf("<section class=\"hero")));
    expect((hero.match(/class=\"btn/g) || []).length).toBe(2);
    expect(hero).toContain("Get API key");
    expect(hero).toContain("Read docs");
  });
});

describe("dashboard activation", () => {
  it("renders copy-key guidance, prefilled curl, and a terminal-style run block", () => {
    const account: AccountView = { account_id: "acct_1", email: "agent@example.com", balance_cents: 150, apiKeys: [{ key_id: "key_1", key_prefix: "vap_abc12345", label: "default", created_at: "2026-05-10T00:00:00Z" }], usage: [] };
    const html = accountHtml(account, "API key created. Copy it now: vap_secret_example");
    expect(html).toContain("Copy API key");
    expect(html).toContain("Run this");
    expect(html).toContain("curl https://api.veracityapi.com/v1/analyze-text");
    expect(html).toContain("Bearer vap_secret_example");
    expect(html).toContain("terminal");
  });
});
