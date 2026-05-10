import { ulid } from "ulid";
import { authenticate, AuthError, sha256Hex } from "./auth";
import { logAnalysis } from "./db";
import { LlmError, scoreText } from "./llm";
import { deriveAction, deriveRiskLevel } from "./scoring";
import { agentsJson, llmsTxt, ogSvg, openApiSpec, robotsTxt, sitemapXml } from "./discovery";
import { docsHtml, evalsHtml, examplesHtml, pricingHtml, privacyHtml, requestAccessHtml } from "./pages";
import { homepageHtml } from "./site";
import type { AnalyzeResponse, Env } from "./types";
import { parseAnalyzeRequest, ValidationError } from "./validate";

const LIMITATIONS = [
  "Probabilistic risk score, not proof of authorship.",
  "English-only at MVP.",
];

const demoHits = new Map<string, { count: number; resetAt: number }>();
const DEMO_MAX_CHARS = 4_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/index.html")) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : homepageHtml());
    }

    const pageRoutes: Record<string, () => string> = {
      "/docs": docsHtml,
      "/evals": evalsHtml,
      "/examples": examplesHtml,
      "/pricing": pricingHtml,
      "/privacy": privacyHtml,
      "/request-access": requestAccessHtml,
    };
    const pageRenderer = pageRoutes[url.pathname];
    if ((request.method === "GET" || request.method === "HEAD") && pageRenderer) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : pageRenderer());
    }

    if (request.method === "POST" && url.pathname === "/request-access") {
      return handleAccessRequest(request, env);
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/openapi.json") {
      return json(request.method === "HEAD" ? null : openApiSpec(), 200, { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/.well-known/agents.json") {
      return json(request.method === "HEAD" ? null : agentsJson(), 200, { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/llms.txt") {
      return text(request.method === "HEAD" ? "" : llmsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
      return text(request.method === "HEAD" ? "" : sitemapXml(), "application/xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
      return text(request.method === "HEAD" ? "" : robotsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/og.svg") {
      return text(request.method === "HEAD" ? "" : ogSvg(), "image/svg+xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json(request.method === "HEAD" ? null : { status: "ok", service: "veracityapi", version: env.MODEL_VERSION || "v0.1" });
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze") {
      await logSiteEvent(env, request, "demo_run", url.pathname);
      return handleDemoAnalyze(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-text") {
      return handleAnalyzeText(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};

async function handleAccessRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const company = cleanText(body.company, 160);
    const useCase = cleanText(body.use_case, 1200);
    const volume = cleanText(body.volume, 80);
    if (!name || !email || !useCase) return json({ error: "bad_request", message: "name, email, and use_case are required" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_request", message: "email must be valid" }, 400);
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const requestId = `req_${ulid()}`;
    await env.DB.prepare(`INSERT INTO access_requests (request_id, created_at, name, email, company, use_case, volume, source, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(requestId, new Date().toISOString(), name, email, company || null, useCase, volume || null, "website", await sha256Hex(ip), request.headers.get("user-agent") || null)
      .run();
    await logSiteEvent(env, request, "access_request", "/request-access", { request_id: requestId, volume });
    return json({ ok: true, request_id: requestId });
  } catch (err) {
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleDemoAnalyze(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (!consumeDemoQuota(ip, Number(env.DEMO_RATE_LIMIT_PER_HOUR || 12))) {
      return json({ error: "rate_limited", message: "Public demo limit reached. Try again later or request an API key." }, 429, { "Retry-After": "3600" });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    if (typeof body.text !== "string" || body.text.length > DEMO_MAX_CHARS) {
      throw new ValidationError(`text: Demo text must be 20-${DEMO_MAX_CHARS} characters`);
    }

    const sanitized = {
      text: body.text,
      context: body.context,
      privacy_mode: true,
    };
    const parsed = await parseAnalyzeRequest(jsonRequest(request.url, sanitized));
    const scored = await scoreText(parsed, env);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: `demo_${ulid()}`,
      ...scored,
      risk_level: riskLevel,
      recommended_action: action,
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: LIMITATIONS,
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash: `demo:${await sha256Hex(ip)}`,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
    });
    return json(response);
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleAnalyzeText(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const { apiKeyHash } = await authenticate(request, env);
    const parsed = await parseAnalyzeRequest(request);
    const scored = await scoreText(parsed, env);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: `ana_${ulid()}`,
      ...scored,
      risk_level: riskLevel,
      recommended_action: action,
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: LIMITATIONS,
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
    });
    return json(response);
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "unauthorized" }, 401);
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function logSiteEvent(env: Env, request: Request, eventName: string, path: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    await env.DB.prepare(`INSERT INTO site_events (event_id, created_at, event_name, path, ip_hash, user_agent, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`evt_${ulid()}`, new Date().toISOString(), eventName, path, await sha256Hex(ip), request.headers.get("user-agent") || null, JSON.stringify(metadata))
      .run();
  } catch (err) {
    console.warn("site_event_log_failed", err);
  }
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function consumeDemoQuota(key: string, limit: number): boolean {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  for (const [k, value] of demoHits.entries()) {
    if (value.resetAt <= now) demoHits.delete(k);
  }
  const current = demoHits.get(key);
  if (!current || current.resetAt <= now) {
    demoHits.set(key, { count: 1, resetAt: now + hour });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120",
      ...corsHeaders(),
    },
  });
}

function text(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
      ...corsHeaders(),
    },
  });
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };
}
