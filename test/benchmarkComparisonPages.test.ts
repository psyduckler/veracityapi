import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { agentsJson, llmsTxt, sitemapXml } from "../src/discovery";

class EmptyStatement {
  bind(..._values: unknown[]) { return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
  async run() { return { meta: { changes: 1 } }; }
}
class EmptyDb { prepare(_sql: string) { return new EmptyStatement(); } }
const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;

async function get(path: string) {
  return worker.fetch(new Request(`https://veracityapi.com${path}`), env);
}

describe("benchmark and comparison launch surfaces", () => {
  it("serves the gated 2026 benchmark page without publishing fake numbers", async () => {
    const response = await get("/evals/2026-benchmark");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const html = await response.text();
    expect(html).toContain("2026-05-benchmark-v1");
    expect(html).toContain("Where Veracity loses");
    expect(html).toContain("No competitor numbers are published");
    expect(html).toContain("not forensic authorship proof");
  });

  it("serves noindex comparison hub and launch comparison pages", async () => {
    const hub = await get("/vs");
    expect(hub.status).toBe(200);
    expect(hub.headers.get("x-robots-tag")).toContain("noindex");
    const hubHtml = await hub.text();
    expect(hubHtml).toContain("Originality.ai vs VeracityAPI");
    expect(hubHtml).toContain("GPTZero vs VeracityAPI");

    for (const slug of ["originality-ai", "gptzero", "hive", "copyleaks"]) {
      const response = await get(`/vs/${slug}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      const html = await response.text();
      expect(html).toContain("When to choose");
      expect(html).toContain("Benchmark results block");
      expect(html).toContain("FAQPage");
      expect(html).toContain("/evals/2026-benchmark");
    }
  });

  it("serves blog launch wrapper posts", async () => {
    for (const path of ["/blog", "/blog/benchmarking-ai-detectors-routing-f1", "/blog/not-an-ai-detector-routing-linter"]) {
      const response = await get(path);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("/evals/2026-benchmark");
    }
  });

  it("adds new benchmark/blog URLs to discovery surfaces and excludes noindex pages from sitemap", () => {
    const sitemap = sitemapXml();
    for (const path of ["/blog", "/blog/benchmarking-ai-detectors-routing-f1", "/blog/not-an-ai-detector-routing-linter"]) {
      expect(sitemap).toContain(`https://veracityapi.com${path}`);
    }
    // /vs, /vs/*, and /evals/2026-benchmark serve X-Robots-Tag: noindex, follow and must
    // stay out of sitemap.xml / IndexNow to avoid contradictory crawl signals.
    for (const path of ["/evals/2026-benchmark", "/vs", "/vs/originality-ai", "/vs/gptzero", "/vs/hive", "/vs/copyleaks"]) {
      expect(sitemap).not.toContain(`<loc>https://veracityapi.com${path}</loc>`);
    }
    expect(llmsTxt()).toContain("2026 benchmark program");
    const agents = agentsJson() as any;
    expect(agents.benchmark_2026).toBe("https://veracityapi.com/evals/2026-benchmark");
    expect(agents.comparisons.pages).toHaveLength(4);
    expect(agents.blog.posts.length).toBeGreaterThanOrEqual(2);
  });

  it("links existing alternatives pages to deeper /vs buyer guides", async () => {
    const pairs: Array<[string, string]> = [["/alternatives/gptzero-api", "/vs/gptzero"], ["/alternatives/originality-ai-api", "/vs/originality-ai"], ["/alternatives/copyleaks-api", "/vs/copyleaks"]];
    for (const [path, expected] of pairs) {
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(expected);
    }
  });
});
