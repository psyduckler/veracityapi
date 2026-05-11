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
      "/alternatives/reality-defender",
      "/alternatives/resemble-detect",
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
    expect(spec.info.description).toMatch(/text, image URLs, and audio URLs/i);
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

  it("adds conversion/proof homepage blocks and checkmark logo/favicons", async () => {
    const html = homepageHtml();
    expect(html).toContain("Input and pre-publish guardrails");
    expect(html).toContain("How agents use VeracityAPI");
    expect(html).toContain("Example workflow costs");
    expect(html).toContain("Operational proof");
    expect(html).toContain('rel="icon"');
    expect(html).toContain("✅");

    for (const path of ["/favicon.svg", "/favicon.ico"]) {
      const res = await worker.fetch(new Request(`https://veracityapi.com${path}`), env);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("image/svg+xml");
      expect(await res.text(), path).toContain("✅");
    }
  });

  it("lists new distribution pages in sitemap", () => {
    const sitemap = sitemapXml();
    for (const path of ["/ai-detection-api", "/ai-audio-detection-api", "/alternatives/deepmedia", "/alternatives/reality-defender", "/integrations/mcp", "/integrations/claude", "/integrations/langgraph"]) {
      expect(sitemap).toContain(`https://veracityapi.com${path}`);
    }
  });
});
