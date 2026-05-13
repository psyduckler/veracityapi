import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { sitemapXml } from "../src/discovery";

class EmptyStatement {
  bind(..._values: unknown[]) { return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: [] as T[] }; }
  async run() { return { meta: { changes: 1 } }; }
}
class EmptyDb { prepare(_sql: string) { return new EmptyStatement(); } }
const env = { DB: new EmptyDb(), ANTHROPIC_API_KEY: "test", API_KEYS: "" } as any;

const BASE = "https://veracityapi.com";
const UNPUBLISHED = ["/alternatives/reality-defender", "/alternatives/resemble-detect", "/use-cases/audio-customer-support-call-qa"];
const ROUTED_OPERATIONAL_PATHS = new Set(["/account", "/health", "/openapi.json", "/llms.txt", "/llms-full.txt", "/agents.json", "/sitemap.xml", "/favicon.svg", "/favicon.ico", "/og.png"]);

function sitemapPaths(): string[] {
  return Array.from(sitemapXml().matchAll(/<loc>(.*?)<\/loc>/g)).map((match) => {
    const path = new URL(match[1]).pathname;
    return path.length > 1 ? path.replace(/\/$/, "") : path;
  });
}

function normalizeInternalHref(href: string, fromPath: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return null;
  const url = new URL(href, `${BASE}${fromPath}`);
  if (url.hostname !== "veracityapi.com") return null;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  return path;
}

function extractInternalLinks(html: string, fromPath: string): string[] {
  return Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => normalizeInternalHref(match[1], fromPath))
    .filter((path): path is string => Boolean(path));
}

async function renderGraph() {
  const paths = sitemapPaths();
  const sitemapSet = new Set(paths);
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const status = new Map<string, number>();
  const htmlByPath = new Map<string, string>();

  for (const path of paths) {
    const response = await worker.fetch(new Request(`${BASE}${path}`), env);
    status.set(path, response.status);
    const html = await response.text();
    htmlByPath.set(path, html);
    const links = new Set(extractInternalLinks(html, path).filter((href) => sitemapSet.has(href)));
    outgoing.set(path, links);
    for (const link of links) {
      if (link === path) continue;
      if (!incoming.has(link)) incoming.set(link, new Set());
      incoming.get(link)!.add(path);
    }
  }

  return { paths, sitemapSet, outgoing, incoming, status, htmlByPath };
}

describe("internal linking architecture", () => {
  it("keeps sitemap pages reachable and gives priority pages enough contextual inlinks", async () => {
    const graph = await renderGraph();

    for (const [path, status] of graph.status) {
      expect(status, `${path} should render successfully`).toBe(200);
    }

    const orphans = graph.paths.filter((path) => path !== "/" && (graph.incoming.get(path)?.size ?? 0) === 0);
    expect(orphans).toEqual([]);

    const minimums: Record<string, number> = {
      "/what-we-detect": 5,
      "/vs": 5,
      "/blog": 3,
      "/examples": 3,
      "/mcp": 3,
      "/ai-detection-api": 3,
      "/ai-content-detector-api": 3,
      "/ai-written-content-detection": 3,
      "/ai-generated-content-detection": 3,
      "/ai-written-content-detector": 3,
      "/ai-generated-text-detector": 3,
      "/synthetic-media-detection-api": 3,
      "/ai-image-detection-api": 3,
      "/ai-audio-detection-api": 3,
    };
    for (const [path, min] of Object.entries(minimums)) {
      expect(graph.incoming.get(path)?.size ?? 0, `${path} should have at least ${min} inlinks`).toBeGreaterThanOrEqual(min);
    }

    for (const path of graph.paths.filter((path) => path.startsWith("/use-cases/"))) {
      expect(graph.incoming.get(path)?.size ?? 0, `${path} should have at least 2 inlinks`).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not link to unpublished or unroutable internal pages", async () => {
    const graph = await renderGraph();
    const linked = new Map<string, Set<string>>();
    for (const path of graph.paths) {
      const allLinks = extractInternalLinks(graph.htmlByPath.get(path) ?? "", path);
      for (const link of allLinks) {
        if (!linked.has(link)) linked.set(link, new Set());
        linked.get(link)!.add(path);
      }
    }

    for (const unpublished of UNPUBLISHED) {
      expect(linked.has(unpublished), `${unpublished} should not be linked`).toBe(false);
    }

    const contentLinks = Array.from(linked.keys()).filter((path) => !path.includes(".") && !path.startsWith("/demo/") && !path.startsWith("/assets/") && !ROUTED_OPERATIONAL_PATHS.has(path));
    const sitemapSet = new Set(graph.paths);
    const missing = contentLinks.filter((path) => !sitemapSet.has(path));
    expect(missing).toEqual([]);
  });
});
