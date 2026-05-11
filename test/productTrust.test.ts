import { describe, expect, it, vi, afterEach } from "vitest";
import worker from "../src/index";
import { accountHtml, type AccountView } from "../src/account";
import { authenticateUsageKey, BillingAuthError } from "../src/billing";
import { logAnalysis } from "../src/db";
import { openApiSpec, llmsTxt, agentsJson } from "../src/discovery";
import { homepageHtml } from "../src/site";
import { EVIDENCE_TYPES, type AnalyzeRequest, type AnalyzeResponse } from "../src/types";

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

    expect(spec.paths["/v1/analyze"].post.operationId).toBe("analyze");
    expect(spec.paths["/v1/analyze"].post.responses["402"]).toBeTruthy();
    expect(spec.components.schemas.UnifiedAnalyzeRequest.properties.type.enum).toEqual(["text", "image", "audio"]);
    expect(spec.paths["/v1/analyze-text"].post.responses["402"]).toBeTruthy();
    expect(spec.paths["/v1/analyze-image"].post.operationId).toBe("analyzeImage");
    expect(spec.paths["/v1/analyze-audio"].post.operationId).toBe("analyzeAudio");
    expect(spec.paths["/v1/balance"].get.operationId).toBe("getBalance");
    expect(spec.components.schemas.AnalyzeTextResponse.properties.billing).toBeTruthy();
    expect(spec.components.schemas.AnalyzeImageResponse.properties.billing).toBeTruthy();
    expect(spec.components.schemas.AnalyzeTextResponse.required).toContain("primary_reason");
    expect(spec.components.schemas.AnalyzeImageResponse.required).toContain("primary_reason");
    expect(spec.components.schemas.AnalyzeAudioResponse.required).toContain("primary_reason");
    expect(spec.components.schemas.AnalyzeTextResponse.properties.primary_reason.description).toMatch(/enum-like/i);
    expect(spec.components.schemas.AnalyzeAudioRequest.properties.audio_url.description).toMatch(/HTTPS audio URL/i);
    expect(spec.components.schemas.AnalyzeAudioResponse.properties.billing.properties.bucket.example).toBe("audio_v0");
    expect(spec.components.schemas.BalanceResponse.required).toContain("balance_cents");
    expect(JSON.stringify(spec.components.schemas.AnalyzeAudioRequest)).not.toMatch(/metadata/i);
  });

  it("keeps OpenAPI examples valid against strict evidence and audio transcript contracts", () => {
    const spec = openApiSpec() as any;
    const imageExample = spec.paths["/v1/analyze-image"].post.responses["200"].content["application/json"].examples.highRisk.value;
    const audioExample = spec.paths["/v1/analyze-audio"].post.responses["200"].content["application/json"].examples.sample.value;
    for (const item of imageExample.evidence) {
      expect(EVIDENCE_TYPES).toContain(item.type);
    }
    expect(audioExample.transcript).toEqual(expect.any(String));
    expect(audioExample.transcript.length).toBeGreaterThan(0);
    expect(imageExample.primary_reason).toEqual(expect.any(String));
    expect(audioExample.primary_reason).toEqual(expect.any(String));
  });

  it("uses precise signup credit copy in machine-readable discovery", () => {
    const combined = `${llmsTxt()} ${JSON.stringify(agentsJson())}`;
    expect(combined).toContain("$1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests");
    expect(combined).not.toContain("150 free API calls");
  });
});

describe("privacy logging", () => {
  const request: AnalyzeRequest = { text: "This is a sufficiently long private text sample for scoring.", context: { format: "article", intended_use: "publish" }, privacy_mode: true };
  const response: AnalyzeResponse = { analysis_id: "ana_1", synthetic_risk: 0.2, slop_risk: 0.3, confidence: "medium", evidence: [], recommended_fixes: [], content_trust_score: 0.7, specificity_risk: 0.3, provenance_weakness: 0.3, synthetic_texture_risk: 0.2, risk_level: "low", recommended_action: "allow", primary_reason: "unsupported_generic_claims", model_version: "v0.1", limitations: [] };

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
  it("leads with content verification, action-first routing, and developer switch-statement value", () => {
    const html = homepageHtml();
    expect(html).toContain("Content Verification API for AI Agents");
    expect(html).toContain("Stop agents from ingesting, citing, or publishing synthetic slop and suspicious media");
    expect(html).toContain("Just write your switch statement");
    expect(html).toContain("switch (result.recommended_action)");
    expect(html).toContain("$1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests");
    expect(html).toContain("curl https://api.veracityapi.com/v1/analyze");
    expect(html).toContain('"recommended_action"');
    const hero = html.slice(html.indexOf("<section class=\"hero"), html.indexOf("</section>", html.indexOf("<section class=\"hero")));
    expect((hero.match(/class=\"btn/g) || []).length).toBe(3);
    expect(hero).toContain("Get API key");
    expect(hero).toContain("Read docs");
    expect(hero).toContain("Try live demo");
  });

  it("surfaces four routing actions, agent-ready discovery, local MCP, and P0 jobs to be done", () => {
    const html = homepageHtml();
    expect(html).toContain("One API call. Four routing actions.");
    expect(html).toContain("<code>allow</code>");
    expect(html).toContain("<code>revise</code>");
    expect(html).toContain("<code>human_review</code>");
    expect(html).toContain("<code>reject</code>");
    expect(html).toContain("Agent-ready by default");
    expect(html).toContain("Claude Desktop / MCP ready");
    expect(html).toContain("Claude.ai connector requires remote MCP later");
    expect(html).toContain("veracityapi.com/llms.txt");
    expect(html).toContain("Pre-publish QA");
    expect(html).toContain("RAG / training-data ingestion");
    expect(html).toContain("Async UGC moderation");
    expect(html).toContain("Demo audio is a generated fixture");
  });

  it("uses live homepage use-case links instead of stale slugs", () => {
    const html = homepageHtml();
    expect(html).toContain('/use-cases/training-data-curation');
    expect(html).toContain('/use-cases/audio-phone-snippet-triage');
    expect(html).not.toContain('/use-cases/rag-source-validation');
    expect(html).not.toContain('/use-cases/audio-voice-message-authenticity-triage');
  });
});

describe("developer examples and dashboard conversion", () => {
  it("renders framework copy-paste wrappers for agent builders", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/examples"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(html).toContain("LangChain @tool");
    expect(html).toContain("Vercel AI SDK tool");
    expect(html).toContain("LlamaIndex FunctionTool");
    expect(html).toContain("LangGraph routing node");
  });

  it("renders a pricing calculator", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/pricing"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(html).toContain("Interactive pricing calculator");
    expect(html).toContain("textChecks");
    expect(html).toContain("imageChecks");
    expect(html).toContain("audioChecks");
    expect(html).toContain("estimateCost");
    expect(html).toContain("Analyze + revise");
    expect(html).toContain("auto_revise:true");
    expect(html).toContain("$0.010 / 1k characters");
    expect(html).toContain("$0.01/request");
    expect(html).not.toContain("Audio URL analysis</td><td><b>$0.005");
    expect(html).not.toContain("chars characters");
    expect(html).not.toContain("chars chars");
  });

  it("keeps unified endpoint examples in docs and framework pages on {type, content}", async () => {
    const docs = await (await worker.fetch(new Request("https://veracityapi.com/docs"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    const examples = await (await worker.fetch(new Request("https://veracityapi.com/examples"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    expect(`${docs} ${examples}`).toContain('type: "text"');
    expect(`${docs} ${examples}`).toContain("content: text");
    expect(`${docs} ${examples}`).toContain("auto_revise");
    expect(`${docs} ${examples}`).not.toContain("JSON.stringify({ text,");
    expect(`${docs} ${examples}`).not.toContain("store_content:true");
  });

  it("renders corrected privacy/storage copy", async () => {
    const html = await (await worker.fetch(new Request("https://veracityapi.com/privacy"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    expect(html).toContain("Raw text, image bytes, audio bytes, base64, and full media URLs are off by default");
    expect(html).toContain("Audio privacy");
    expect(html).toContain("store_content=true");
    expect(html).toContain("text-only client opt-in");
    expect(html).not.toContain("<h3>store_content=false</h3><p>Reserved for explicit client opt-in");
  });
});

  it("renders /for-agents and /mcp pages for agent distribution", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const forAgents = await (await worker.fetch(new Request("https://veracityapi.com/for-agents"), env)).text();
    const mcp = await (await worker.fetch(new Request("https://veracityapi.com/mcp"), env)).text();
    expect(forAgents).toContain("Call VeracityAPI before your workflow trusts content");
    expect(forAgents).toContain("recommended_action");
    expect(forAgents).toContain("routing-action quality, not authorship proof");
    expect(mcp).toContain("Content verification tools for MCP agents");
    expect(mcp).toContain("@veracityapi/mcp");
    expect(mcp).toContain("VERACITY_API_KEY");
    expect(mcp).toContain("check_balance");
    expect(mcp).toContain("get_balance");
    expect(mcp).toContain("analyze_batch");
  });

  it("keeps public copy aligned with guaranteed response fields", () => {
    const combined = `${homepageHtml()} ${llmsTxt()} ${JSON.stringify(openApiSpec())}`;
    expect(combined).toContain("primary_reason");
    expect(combined).toMatch(/unsupported_generic_claims|visible_synthetic_media_cues|synthetic_speech_cues/);
  });

  it("publishes benchmark proof and agent eval metadata", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const evals = await (await worker.fetch(new Request("https://veracityapi.com/evals"), env)).text();
    const agents = agentsJson() as any;
    expect(evals).toContain("500");
    expect(evals).toContain("Macro F1");
    expect(evals).toContain("0.871");
    expect(evals).toContain("routing-action F1, not AI-authorship proof");
    expect(agents.for_agents).toBe("https://veracityapi.com/for-agents");
    expect(agents.mcp).toBe("https://veracityapi.com/mcp");
    expect(agents.evals_object.sample_count).toBe(500);
    expect(agents.evals_object.macro_f1).toBe(0.871);
  });

describe("dashboard activation", () => {
  it("renders copy-key guidance, balance progress, prefilled curl, and a terminal-style run block", () => {
    const account: AccountView = { account_id: "acct_1", email: "agent@example.com", balance_cents: 150, apiKeys: [{ key_id: "key_1", key_prefix: "vap_abc12345", label: "default", created_at: "2026-05-10T00:00:00Z" }], usage: [] };
    const html = accountHtml(account, "API key created. Copy it now: vap_secret_example");
    expect(html).toContain("Copy API key");
    expect(html).toContain("Current balance");
    expect(html).toContain("Equivalent to ~300 analyze-only 1k-character text requests or ~150 Analyze + revise requests");
    expect(html).toContain("progressbar");
    expect(html).toContain("Run this");
    expect(html).toContain("curl https://api.veracityapi.com/v1/analyze");
    expect(html).toContain("Bearer vap_secret_example");
    expect(html).toContain("Authorization: Bearer");
    expect(html).toContain("terminal");
  });
});
