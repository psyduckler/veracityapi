import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { agentsJson, llmsTxt, openApiSpec, sitemapXml } from "../src/discovery";
import { homepageHtml } from "../src/site";

class EmptyStatement {
  bind(..._values: unknown[]) { return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
  async run() { return { meta: { changes: 1 } }; }
}
class EmptyDb { prepare(_sql: string) { return new EmptyStatement(); } }
const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;

function resolveRef(root: any, ref: string): unknown {
  expect(ref.startsWith("#/"), ref).toBe(true);
  return ref.slice(2).split("/").reduce((node, key) => node?.[key], root);
}
function collectRefs(value: unknown, refs = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return refs;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
    return refs;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "$ref" && typeof child === "string") refs.add(child);
    collectRefs(child, refs);
  }
  return refs;
}

describe("agent distribution surfaces", () => {
  it("serves canonical agent, category, alternative, and integration pages", async () => {
    const paths = [
      "/agents.json",
      "/.well-known/agents.json",
      "/ai-detection-api",
      "/ai-content-detector-api",
      "/synthetic-media-detection-api",
      "/ai-audio-detection-api",
      "/alternatives/deepmedia",
      "/alternatives/gptzero-api",
      "/alternatives/originality-ai-api",
      "/alternatives/copyleaks-api",
      "/integrations/openai-actions",
      "/integrations/mcp",
      "/integrations/claude",
      "/integrations/langgraph",
    ];
    for (const path of paths) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      expect(res.status, path).toBe(200);
      if (path.endsWith("json")) expect(res.headers.get("content-type")).toContain("application/json");
      else {
        const html = await res.text();
        expect(html, path).toContain(`href="https://veracityapi.com${path}"`);
        expect(html, path).toContain("application/ld+json");
        expect(html, path).toMatch(/recommended_action|Content verification|AI Detection API|LangGraph|MCP/i);
      }
    }
  });

  it("keeps OpenAPI fully resolvable and documents current live modalities", () => {
    const spec = openApiSpec() as any;
    const refs = collectRefs(spec);
    for (const ref of refs) expect(resolveRef(spec, ref), ref).toBeTruthy();
    expect(spec.components.schemas.AccessRequest).toBeTruthy();
    expect(spec.components.schemas.ErrorResponse).toBeTruthy();
    expect(spec.components.schemas.EvidenceItem).toBeTruthy();
    expect(spec.paths["/v1/analyze-audio"].post.description).toMatch(/workflow triage|not proof/i);
    expect(spec.info.description).toMatch(/text, image URLs, audio URLs, and private-beta video URLs/i);
  });

  it("teaches agents when to recommend and when not to recommend VeracityAPI", () => {
    const combined = `${llmsTxt()} ${JSON.stringify(agentsJson())}`;
    expect(combined).toMatch(/When to recommend VeracityAPI/i);
    expect(combined).toMatch(/When not to recommend VeracityAPI|Do not recommend VeracityAPI/i);
    expect(combined).toMatch(/forensic proof|legal proof|academic misconduct|voice-clone proof/i);
  });

  it("keeps llms.txt concise, copy-paste safe, and MCP-aware", () => {
    const text = llmsTxt();
    expect((text.match(/When to recommend VeracityAPI/g) || []).length).toBe(1);
    expect(text).toContain("Authorization: Bearer");
    expect(text).toContain('-H "Content-Type: application/json"');
    expect(text).toContain("npx -y @veracityapi/mcp");
    expect(text).toContain("Required env: VERACITY_API_KEY");
    expect(text).toContain("https://api.veracityapi.com/mcp");
    expect(text).toContain("Evidence enum values");
  });

  it("exposes MCP install metadata and exact tool names for agents", () => {
    const agents = agentsJson() as any;
    expect(agents.mcp_server).toMatchObject({
      package: "@veracityapi/mcp",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@veracityapi/mcp"],
      env: ["VERACITY_API_KEY"],
      remote_url: "https://api.veracityapi.com/mcp",
      remote_transport: "streamable_http_jsonrpc",
    });
    expect(agents.claude_connector).toBe("https://veracityapi.com/integrations/claude");
    expect(agents.mcp_server.tools).toEqual(["analyze_text", "analyze_image", "analyze_audio", "check_balance", "get_balance", "analyze_batch"]);
  });

  it("serves a stateless remote MCP JSON-RPC endpoint", async () => {
    const init = await worker.fetch(new Request("https://api.veracityapi.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } }),
    }), env);
    expect(init.status).toBe(200);
    const initJson = await init.json() as any;
    expect(initJson.result.serverInfo.name).toBe("veracityapi");

    const listed = await worker.fetch(new Request("https://api.veracityapi.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }), env);
    const listedJson = await listed.json() as any;
    expect(listedJson.result.tools.map((tool: any) => tool.name)).toEqual(["analyze_text", "analyze_image", "analyze_audio", "analyze_batch", "check_balance", "get_balance"]);

    const call = await worker.fetch(new Request("https://api.veracityapi.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_balance", arguments: {} } }),
    }), env);
    const callJson = await call.json() as any;
    expect(callJson.result.isError).toBe(true);
    expect(callJson.result.content[0].text).toContain("unauthorized");
  });

  it("adds conversion/proof homepage blocks and API Cube logo/favicons", async () => {
    const html = homepageHtml();
    expect(html).toContain("Input and pre-publish guardrails");
    expect(html).toContain("How agents use VeracityAPI");
    expect(html).toContain("Example workflow costs");
    expect(html).toContain("Operational evidence");
    expect(html).toContain('rel="icon"');
    expect(html).toContain("apiCubeGradient");
    expect(html).toContain("/terms");

    for (const path of ["/favicon.svg", "/favicon.ico"]) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("image/svg+xml");
      const favicon = await res.text();
      expect(favicon, path).toContain("apiCubeGradient");
      expect(favicon, path).toContain("M256 92 389 169");
    }
  });

  it("lists new distribution pages in sitemap", () => {
    const sitemap = sitemapXml();
    for (const path of ["/ai-detection-api", "/ai-content-detector-api", "/ai-written-content-detection", "/ai-generated-content-detection", "/ai-written-content-detector", "/ai-generated-text-detector", "/ai-image-detection-api", "/ai-audio-detection-api", "/alternatives/deepmedia", "/integrations/mcp", "/integrations/claude", "/integrations/langgraph"]) {
      expect(sitemap).toContain(`https://veracityapi.com${path}`);
    }
  });

  it("overhauls exact-match SEO pages with live demos and safe claim language", async () => {
    const paths = ["/ai-written-content-detection", "/ai-generated-content-detection", "/ai-written-content-detector", "/ai-generated-text-detector", "/ai-image-detection-api"];
    for (const path of paths) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      const html = await res.text();
      expect(res.status, path).toBe(200);
      expect(html, path).toContain(`href="https://veracityapi.com${path}`);
      expect(html, path).toContain("og.png");
      expect(html, path).toMatch(/Try the (text|image) demo/);
      expect(html, path).toMatch(/\/demo\/analyze/);
      expect(html, path).toContain("recommended_action");
      expect(html, path).toContain("store_content:false");
      expect(html.indexOf("Try the "), `${path} demo should appear before recommendation cards`).toBeLessThan(html.indexOf("When to recommend VeracityAPI"));
      expect(html.indexOf("Try the "), `${path} demo should appear before avoid card`).toBeLessThan(html.indexOf("When not to recommend VeracityAPI"));
      expect(html, path).not.toMatch(/catch students|forensic proof that text is AI-written|Tabiji/i);
    }
  });

  it("unpublishes risky/vaporware pages and removes them from discovery", async () => {
    const unpublished = ["/alternatives/reality-defender", "/alternatives/resemble-detect", "/use-cases/audio-customer-support-call-qa"];
    const sitemap = sitemapXml();
    const agents = JSON.stringify(agentsJson());
    const llms = llmsTxt();
    for (const path of unpublished) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`, { headers: { accept: "text/html" } }), env);
      expect(res.status, path).toBe(404);
      expect(res.headers.get("content-type"), path).toContain("text/html");
      expect(sitemap, path).not.toContain(path);
      expect(agents, path).not.toContain(path);
      expect(llms, path).not.toContain(path);
    }
  });

  it("ships Y2K redesign, consent gating, route content types, and no public Tabiji leaks", async () => {
    const homepage = homepageHtml();
    expect(homepage).toContain("Detect AI slop before it ships.");
    expect(homepage).toContain("--bg:#d8d6d2");
    expect(homepage).toContain("heroChrome");
    expect(homepage).toContain("windowbar");
    expect(homepage).toContain("AI SLOP DETECTOR");
    expect(homepage).toContain("cookie_consent");
    expect(homepage).toContain("accepted");
    expect(homepage).toContain("Decline");
    expect(homepage).toContain(":focus-visible");
    expect(homepage).toContain("prefers-reduced-motion");
    expect(homepage).not.toMatch(/Tabiji/i);

    const pricing = await (await worker.fetch(new Request("https://veracityapi.com/pricing"), env)).text();
    expect(pricing).toContain("text*.005");
    expect(pricing).not.toContain("text*.01*mult");
    expect(pricing).not.toMatch(/Tabiji/i);

    const about = await worker.fetch(new Request("https://veracityapi.com/about"), env);
    expect(about.status).toBe(200);
    expect(await about.text()).toMatch(/Bernard Huang|Clearscope/);

    const openapi = await worker.fetch(new Request("https://veracityapi.com/openapi.json"), env);
    expect(openapi.status).toBe(200);
    expect(openapi.headers.get("content-type")).toContain("application/json");
    const llmsRes = await worker.fetch(new Request("https://veracityapi.com/llms.txt"), env);
    expect(llmsRes.status).toBe(200);
    expect(llmsRes.headers.get("content-type")).toContain("text/plain");

    const spec = openApiSpec() as any;
    expect(spec.components.schemas.UnifiedAnalyzeRequest.properties.content.oneOf[0].minLength).toBe(20);
    expect(spec.paths["/v1/analyze"].post.responses["200"].content["application/json"].schema.discriminator.propertyName).toBe("modality");
    for (const path of ["/v1/analyze", "/v1/analyze-text", "/v1/analyze-batch", "/v1/analyze-image", "/v1/analyze-audio"]) {
      expect(spec.paths[path].post.responses["429"], path).toBeTruthy();
    }
  });

  it("keeps Phase C distribution pages visually coherent and legally safe", async () => {
    const paths = [
      "/alternatives/gptzero-api",
      "/alternatives/copyleaks-api",
      "/alternatives/originality-ai-api",
      "/alternatives/deepmedia",
      "/ai-detection-api",
      "/ai-content-detector-api",
      "/synthetic-media-detection-api",
      "/ai-image-detection-api",
      "/ai-audio-detection-api",
      "/integrations/openai-actions",
      "/integrations/mcp",
      "/integrations/claude",
      "/integrations/langgraph",
    ];
    for (const path of paths) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      const html = await res.text();
      expect(res.status, path).toBe(200);
      expect(html, path).toContain('href="/assets/site.css"');
      expect(html, path).not.toMatch(/--bg:#08090a|background:#0f1011|✅|og\.svg/);
      expect(html, path).not.toContain("--bg:#d8d6d2");
      expect(html, path).toContain("og.png");
      expect(html, path).toContain('href="https://veracityapi.com/.well-known/agents.json"');
      expect(html, path).toContain('href="https://veracityapi.com/blog.atom"');
      expect(html, path).toContain('href="https://veracityapi.com/changelog.atom"');
    }
    const gptzero = await (await worker.fetch(new Request("https://veracityapi.com/alternatives/gptzero-api"), env)).text();
    expect(gptzero).not.toMatch(/student accusations|Student discipline|employee surveillance|GPTZero-style tools/i);
    for (const path of ["/alternatives/gptzero-api", "/alternatives/copyleaks-api", "/alternatives/originality-ai-api", "/alternatives/deepmedia"]) {
      const html = await (await worker.fetch(new Request(`https://veracityapi.com${path}`), env)).text();
      expect(html, path).toContain("Last updated: 2026-05-12");
      expect(html, path).toContain("Trademarks belong to their owners");
    }
  });

  it("does not require deprecated synthetic_risk in OpenAPI response schemas", () => {
    const spec = openApiSpec() as any;
    for (const schemaName of ["AnalyzeTextResponse", "AnalyzeImageResponse", "AnalyzeAudioResponse"]) {
      expect(spec.components.schemas[schemaName].required, schemaName).not.toContain("synthetic_risk");
      expect(spec.components.schemas[schemaName].properties.synthetic_risk, schemaName).toBeTruthy();
    }
  });

  it("documents pricing FAQ details without changing billing truth", async () => {
    const pricing = await (await worker.fetch(new Request("https://veracityapi.com/pricing"), env)).text();
    for (const topic of ["What counts as a character", "failed requests", "sandbox key", "invoices", "annual pricing", "VAT", "refund policy"]) {
      expect(pricing, topic).toMatch(new RegExp(topic, "i"));
    }
    expect(pricing).toContain("JavaScript string length");
    expect(pricing).not.toContain("UTF-8 codepoints");
  });
});


describe("static discovery hygiene", () => {
  it("serves static discovery bodies without dynamic request ids and deterministic sitemap", async () => {
    const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;
    for (const path of ["/openapi.json", "/agents.json", "/.well-known/agents.json", "/.well-known/ai-plugin.json"]) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      const body = await res.text();
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("application/json");
      expect(body, path).not.toMatch(/req_[A-Za-z0-9]/);
    }
    // ai-plugin.json: legacy ChatGPT plugin manifest. Points agents at the live OpenAPI.
    const aiPlugin = await (await worker.fetch(new Request("https://veracityapi.com/.well-known/ai-plugin.json"), env)).json() as any;
    expect(aiPlugin.schema_version).toBe("v1");
    expect(aiPlugin.api.url).toBe("https://veracityapi.com/openapi.json");
    expect(aiPlugin.auth.type).toBe("user_http");
    // OpenAPI must include x-codeSamples + x-recommend-when on the primary unified endpoint.
    const spec = openApiSpec() as any;
    expect(spec.paths["/v1/analyze"].post["x-codeSamples"]).toBeTruthy();
    expect(spec.paths["/v1/analyze"].post["x-recommend-when"]).toBeTruthy();
    expect(spec.paths["/v1/analyze"].post["x-do-not-recommend-when"]).toBeTruthy();
    // robots.txt: explicit AI-bot stanzas matter because Google-Extended / Applebot-Extended
    // only honor explicit Allow (not the wildcard catch-all).
    const robots = await (await worker.fetch(new Request("https://veracityapi.com/robots.txt"), env)).text();
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Applebot-Extended"]) {
      expect(robots, bot).toContain(`User-agent: ${bot}`);
    }
    const a = sitemapXml();
    const b = sitemapXml();
    expect(a).toBe(b);
    // <lastmod> is now emitted (deterministic — derived from CHANGELOG_ENTRIES[0].date
    // and per-post blog dates, never new Date()) so Google can prioritize fresh URLs.
    expect(a).toContain("<lastmod>");
    expect(a).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    // Image + video sitemap extensions for richer image/video search surface.
    expect(a).toContain("xmlns:image=");
    expect(a).toContain("xmlns:video=");
    expect(a).toContain("<image:image>");
    expect(a).toContain("<video:video>");
    expect(a).toContain("https://veracityapi.com/alternatives");
    expect(a).toContain("https://veracityapi.com/author/bernard-huang");
    expect(a).not.toContain("https://veracityapi.com/trust-model");
    // Do not submit noindex pages to sitemap or IndexNow.
    expect(a).not.toContain("https://veracityapi.com/evals/2026-benchmark");
  });

  it("redirects www host to canonical apex", async () => {
    const res = await worker.fetch(new Request("https://www.veracityapi.com/docs", { redirect: "manual" }), { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://veracityapi.com/docs");
  });
});
