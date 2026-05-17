import { describe, expect, it, vi, afterEach } from "vitest";
import worker from "../src/index";
import { accountHtml, type AccountView } from "../src/account";
import { authenticateUsageKey, BillingAuthError } from "../src/billing";
import { logAnalysis } from "../src/db";
import { openApiSpec, llmsTxt, agentsJson, sitemapXml, sampleAnalyzeResponse, sampleAnalyzeImageResponse, sampleAnalyzeAudioResponse } from "../src/discovery";
import { homepageHtml } from "../src/site";
import { welcomeHtml } from "../src/welcome";
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

describe("hosted Chrome extension welcome onboarding", () => {
  it("renders the hosted Chrome extension welcome onboarding page", () => {
    const html = welcomeHtml();
    expect(html).toContain("Veracity is installed");
    expect(html).toContain("Highlight text");
    expect(html).toContain("Right-click");
    expect(html).toContain("Check with Veracity");
    expect(html).toContain("Right-click a public image");
    expect(html).toContain("Check image with Veracity");
    expect(html).toContain("public image URLs");
    expect(html).toContain("Try it out here");
    expect(html).toContain("chrome.runtime.sendMessage");
    expect(html).toContain("check-connection");
    expect(html).toContain("connect");
    expect(html).toContain("workflow-risk triage");
    expect(html).toContain("Step 1");
    expect(html).toContain("Highlight any text");
    expect(html).toContain("Step 2");
    expect(html).toContain("Get AI risk analysis");
    expect(html).toContain("Use the same public tester image from the homepage");
    expect(html).toContain("Review image risk analysis");
    expect(html).toContain("/demo/influencer-beauty-tonic.jpg");
    expect(html).toContain("/welcome/image-step-1.webp");
    expect(html).toContain("/welcome/image-step-2.webp");
    expect(html).toContain('/welcome/right-click-menu.webp');
    expect(html).toContain('/welcome/result-window.webp');
  });

  it("serves /welcome via static pageRoutes for GET and HEAD", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const response = await worker.fetch(new Request("https://veracityapi.com/welcome"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Veracity is installed");

    const head = await worker.fetch(new Request("https://veracityapi.com/welcome", { method: "HEAD" }), env);
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toContain("text/html");
    expect(await head.text()).toBe("");
  });

  it("serves real WebP welcome screenshots", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    for (const path of ["/welcome/right-click-menu.webp", "/welcome/result-window.webp", "/welcome/image-step-1.webp", "/welcome/image-step-2.webp"]) {
      const response = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/webp");
      expect(response.headers.get("cache-control")).toContain("max-age=31536000");
      const body = new Uint8Array(await response.arrayBuffer());
      expect(body.byteLength).toBeGreaterThan(50_000);
      expect(Array.from(body.slice(0, 4))).toEqual([82, 73, 70, 70]);
      expect(String.fromCharCode(...body.slice(8, 12))).toBe("WEBP");

      const head = await worker.fetch(new Request(`https://veracityapi.com${path}`, { method: "HEAD" }), env);
      expect(head.status).toBe(200);
      expect(head.headers.get("content-type")).toContain("image/webp");
      expect(await head.text()).toBe("");
    }
  });
});

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
    expect(spec.components.schemas.UnifiedAnalyzeRequest.properties.type.enum).toEqual(["text", "image", "audio", "video", "asset"]);
    expect(spec.components.schemas.UnifiedAnalyzeRequest.properties.source).toBeTruthy();
    expect(spec.components.schemas.MediaSource).toBeTruthy();
    expect(spec.components.schemas.AnalyzeTextRequest.properties.context.properties.custom_policy.description).toMatch(/workflow policy/i);
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
  const response: AnalyzeResponse = { analysis_id: "ana_1", modality: "text", synthetic_risk: 0.2, slop_risk: 0.3, confidence: "medium", evidence: [], recommended_fixes: [], content_trust_score: 0.7, specificity_risk: 0.3, provenance_weakness: 0.3, synthetic_texture_risk: 0.2, risk_level: "low", recommended_action: "allow", primary_reason: "unsupported_generic_claims", model_version: "v0.1", limitations: [] };

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
  it("leads with AI output linter positioning, action-first routing, and developer switch-statement value", () => {
    const html = homepageHtml();
    expect(html).toContain("Detect AI slop before it ships.");
    expect(html).toContain("VeracityAPI is a drop-in linter for AI outputs");
    expect(html).toContain("We don’t care who wrote it. We care whether it’s shippable.");
    expect(html).toContain("Workflow signals, not forensic proof");
    expect(html).toContain("AI forgery detection");
    expect(html).toContain("Don’t just detect slop. Fix it.");
    expect(html).toContain("auto_revise");
    expect(html).toContain("Just write your switch statement");
    expect(html).toContain("switch (result.recommended_action)");
    expect(html).toContain("$1.50 free credit");
    expect(html).toContain("curl https://api.veracityapi.com/v1/analyze");
    expect(html).toContain('"recommended_action"');
    const hero = html.slice(html.indexOf("<section class=\"hero"), html.indexOf("</section>", html.indexOf("<section class=\"hero")));
    expect((hero.match(/class=\"btn/g) || []).length).toBe(4);
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
    expect(html).toContain("hosted remote MCP is live for compatible custom connectors");
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

describe("Batch 2 demo conversion trust", () => {
  it("renders why-this-action panels, action matrix, and billing estimates in demos", () => {
    const html = homepageHtml();
    expect(html).toContain("Why this action?");
    expect(html).toContain("Billing estimate");
    expect(html).toContain("Action-routing matrix");
    expect(html).toContain("Text demo: generic travel safety copy should route to human_review");
    expect(html).toContain("Image demo: low-risk sample should route to allow with provenance caveat");
    expect(html).toContain("Audio demo: suspicious voice fixture should route to human_review");
    expect(html).toContain("estimatedCostCents");
    expect(html).toContain("$0.005 / 1k text chars");
    expect(html).toContain("$0.02 / image");
    expect(html).toContain("$0.01 / audio request");
  });
});

describe("Batch 3 agent policy and schema docs", () => {
  it("upgrades /for-agents with decision policies, framework recipes, modality, and enum docs", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/for-agents"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(html).toContain("Agent decision policy templates");
    expect(html).toContain("Policy: pre-publish QA");
    expect(html).toContain("Policy: RAG/source triage");
    expect(html).toContain("Policy: UGC/media moderation");
    expect(html).toContain("OpenAI tool schema");
    expect(html).toContain("Vercel AI SDK tool");
    expect(html).toContain("LangGraph conditional edge");
    expect(html).toContain("modality");
    expect(html).toContain("Primary reason enum-like values");
    expect(html).toContain("unsupported_generic_claims");
  });

  it("documents modality on response schemas and examples", () => {
    const spec = openApiSpec() as any;
    for (const [name, modality] of [["AnalyzeTextResponse", "text"], ["AnalyzeImageResponse", "image"], ["AnalyzeAudioResponse", "audio"]]) {
      const schema = spec.components.schemas[name];
      expect(schema.required).toContain("modality");
      expect(schema.properties.modality.enum).toEqual([modality]);
    }
    expect(sampleAnalyzeResponse().modality).toBe("text");
    expect(sampleAnalyzeImageResponse().modality).toBe("image");
    expect(sampleAnalyzeAudioResponse().modality).toBe("audio");
  });
});

describe("Batch 4 search and proof expansion", () => {
  it("serves high-intent category pages for content verification, moderation, and deepfake terms", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    for (const path of ["/content-verification-api", "/ai-content-moderation-api", "/deepfake-detection-api"]) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      expect(res.status, path).toBe(200);
      const html = await res.text();
      expect(html, path).toContain("recommended_action");
      expect(html, path).toContain("not forensic proof");
      expect(html, path).toContain(`href="https://veracityapi.com${path}"`);
    }
  });

  it("publishes honest benchmark comparison scaffold on evals", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/evals"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(html).toContain("Comparison scaffold");
    expect(html).toContain("GPTZero");
    expect(html).toContain("Sapling");
    expect(html).toContain("LLM judge");
    expect(html).toContain("routing-action F1, not detector-score accuracy");
    expect(html).toContain("External comparison pending");
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
    expect(html).toContain("reviseChecks");
    expect(html).toContain("estimateCost");
    expect(html).toContain("Analyze + revise");
    expect(html).toContain("auto_revise:true");
    expect(html).toContain("$0.005 / 1k characters");
    expect(html).toContain("$0.010 / 1k characters");
    expect(html).toContain("$0.02 / image");
    expect(html).toContain("$0.01 / audio request");
    expect(html).toContain("Prepaid usage");
    expect(html).toContain("Custom volume");
    expect(html).not.toContain("20k characters analyze-only");
    expect(html).not.toContain("50k characters analyze-only");
    expect(html).not.toContain("100k characters analyze-only");
    expect(html).not.toContain("Long text budget multiplier");
    expect(html).not.toContain("Team / Pro");
    expect(html).not.toContain("$99/mo");
    expect(html).toContain("Contact sales");
    expect(html).not.toContain("Audio URL analysis</td><td><b>$0.005");
    expect(html).not.toContain("chars characters");
    expect(html).not.toContain("chars chars");
  });

  it("renders public status and changelog pages", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const status = await (await worker.fetch(new Request("https://veracityapi.com/status"), env)).text();
    const changelog = await (await worker.fetch(new Request("https://veracityapi.com/changelog"), env)).text();
    expect(status).toContain("VeracityAPI is live");
    expect(status).toContain("/health");
    expect(status).toContain("Operational");
    expect(changelog).toContain("VeracityAPI is shipping");
    expect(changelog).toContain("2026-05-11");
    expect(changelog).toContain("@veracityapi/mcp");
  });

  it("renders fair comparison tables on high-intent alternatives pages", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const html = await (await worker.fetch(new Request("https://veracityapi.com/alternatives/gptzero-api"), env)).text();
    expect(html).toContain("Side-by-side comparison");
    expect(html).toContain("recommended_action");
    expect(html).toContain("MCP, OpenAPI, llms.txt, agents.json");
    expect(html).toContain("Authorship-likelihood checks where a team will interpret a probability");
    expect(html).not.toMatch(/student accusations|Student discipline|employee surveillance|GPTZero-style tools/i);
  });

  it("keeps unified endpoint examples in docs and framework pages on {type, content}", async () => {
    const docs = await (await worker.fetch(new Request("https://veracityapi.com/docs"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    const examples = await (await worker.fetch(new Request("https://veracityapi.com/examples"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    const homepage = homepageHtml();
    expect(`${docs} ${examples}`).toContain('type: "text"');
    expect(`${docs} ${examples}`).toContain("analyzeText");
    expect(`${docs} ${examples}`).toContain("analyze_text");
    expect(`${docs} ${examples}`).toContain("auto_revise");
    expect(`${docs} ${examples} ${homepage}`).toContain("npm install @veracityapi/sdk");
    expect(`${docs} ${examples} ${homepage}`).toContain("pip install veracityapi");
    expect(`${docs} ${examples}`).toContain('from veracityapi import VeracityAPI');
    expect(`${docs} ${examples}`).toContain('import { VeracityAPI } from "@veracityapi/sdk"');
    expect(`${docs} ${examples}`).not.toContain("JSON.stringify({ text,");
    expect(`${docs} ${examples}`).not.toContain("store_content:true");
    expect(`${docs} ${examples} ${homepage}`).not.toContain("$VERAC...KEY");
    expect(`${docs} ${examples} ${homepage}`).not.toContain(["Authorization: Bearer", "***"].join(" "));
    expect(docs).toContain('context={"format": "article", "intended_use": "publish"},\n)');
  });

  it("renders corrected privacy/storage copy", async () => {
    const html = await (await worker.fetch(new Request("https://veracityapi.com/privacy"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any)).text();
    expect(html).toContain("VeracityAPI runs only when you or your app explicitly submit content");
    expect(html).toContain("Chrome extension data");
    expect(html).toContain("Extension storage");
    expect(html).toContain("public HTTPS image URL");
    expect(html).toContain("cleaned up after 24 hours");
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
    expect(mcp).toContain("@veracityapi/mcp@0.1.0");
    expect(mcp).toContain("https://www.npmjs.com/package/@veracityapi/mcp");
    expect(mcp).toContain("npx -y @veracityapi/mcp");
    expect(mcp).not.toContain("npm auth is completed");
    expect(mcp).not.toContain("package is not yet visible");
    expect(mcp).not.toContain("Remote MCP for Claude.ai custom connectors is a later milestone");
    expect(mcp).toContain("https://api.veracityapi.com/mcp");
    expect(mcp).toContain("/integrations/claude");
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


describe("patches 1-4 audit remediations", () => {
  it("keeps request-access success notice hidden until a real submission", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/request-access"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(html).toContain('id="notice" class="notice" hidden');
    expect(html).toContain("notice.hidden=false");
    expect(html).not.toContain('style="display:block"');
  });

  it("keeps account/auth surfaces noindex and free of GA injection", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/account"), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    const html = await res.text();
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(html).not.toContain("googletagmanager.com/gtag/js");
    expect(html).not.toContain("G-BMB8X59JBY");
  });

  it("serves alternatives hub and canonicalizes trust aliases to methodology", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    const alternatives = await worker.fetch(new Request("https://veracityapi.com/alternatives"), env);
    expect(alternatives.status).toBe(200);
    expect(await alternatives.text()).toContain("Compare AI detector APIs by workflow job");
    for (const path of ["/trust", "/trust-model"]) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`, { redirect: "manual" }), env);
      expect(res.status, path).toBe(301);
      expect(res.headers.get("location"), path).toBe("https://veracityapi.com/methodology");
    }
  });
});


describe("conversion remediation shipment", () => {
  const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;

  it("upgrades docs with quickstart, response schema, errors, and signal definitions", async () => {
    const docs = await (await worker.fetch(new Request("https://veracityapi.com/docs"), env)).text();
    expect(docs).toContain("Quickstart — 5 minutes to your first analyzed result");
    expect(docs).toContain("Complete response example");
    expect(docs).toContain("recommended_action");
    expect(docs).toContain("allow → publish or proceed");
    expect(docs).toContain("revise → fix the flagged signals");
    expect(docs).toContain("human_review → route to a human");
    expect(docs).toContain("reject → block or discard");
    expect(docs).toContain("auto_revise");
    expect(docs).toContain("store_content:false");
    for (const term of ["slop_risk", "synthetic_risk", "specificity_risk", "provenance_weakness", "risk_level", "confidence", "primary_reason", "threshold", "intended_use"]) {
      expect(docs).toContain(term);
    }
    expect(docs).toContain("/docs/errors");
  });

  it("serves /docs/errors with production retry guidance", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/docs/errors"), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("401");
    expect(html).toContain("429");
    expect(html).toContain("Retry-After");
    expect(html).toContain("exponential backoff");
    expect(html).toContain("insufficient credits");
    expect(html).toContain("validation errors");
  });

  it("renders transparent pricing and starter-credit units", async () => {
    const pricing = await (await worker.fetch(new Request("https://veracityapi.com/pricing"), env)).text();
    expect(pricing).toContain("300,000 characters");
    expect(pricing).toContain("$1.50");
    expect(pricing).toContain("$0.005");
    expect(pricing).toContain("$0.010");
    expect(pricing).toContain("$0.02");
    expect(pricing).toContain("$0.01");
    expect(pricing).toContain("rounded up");
    expect(pricing).toContain("auto_revise:true");
    expect(pricing).toContain("Why does human_review cost the same as allow?");
  });

  it("serves /what-we-detect with concrete examples and modality-aware boundaries", async () => {
    const res = await worker.fetch(new Request("https://veracityapi.com/what-we-detect"), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("What we catch");
    expect(html).toContain("What we do not catch");
    expect(html).toContain("Generic, low-information phrasing");
    expect(html).toContain("Unsupported claims presented as fact");
    expect(html).toContain("Weak provenance / source risk");
    expect(html).toContain("Synthetic image cues");
    expect(html).toContain("Synthetic audio cues");
    expect(html).not.toContain("Image slop");
    expect(html).not.toContain("Audio slop");
  });

  it("updates sitemap and agent discovery for new conversion pages", () => {
    const sitemap = sitemapXml();
    const agents = agentsJson() as any;
    expect(sitemap).toContain("https://veracityapi.com/docs/errors");
    expect(sitemap).toContain("https://veracityapi.com/what-we-detect");
    expect(llmsTxt()).toContain("https://veracityapi.com/docs/errors");
    expect(llmsTxt()).toContain("https://veracityapi.com/what-we-detect");
    expect(agents.docs_errors).toBe("https://veracityapi.com/docs/errors");
    expect(agents.what_we_detect).toBe("https://veracityapi.com/what-we-detect");
  });

  it("tightens homepage demo conversion copy and dogfood proof", () => {
    const homepage = homepageHtml();
    expect(homepage).toContain("Paste your own draft");
    expect(homepage).toContain("no signup required");
    expect(homepage).toContain("4,000 characters");
    expect(homepage).toContain("store_content=false");
    expect(homepage).toContain("Want the full API output");
    expect(homepage).toContain("Sign up free");
    expect(homepage).toContain("Public demo limit reached");
    expect(homepage).toContain("Create a free API key");
    expect(homepage).toContain("Dogfooded");
    expect(homepage).not.toContain("Trusted by customers");
  });
});
