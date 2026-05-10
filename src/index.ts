import { ulid } from "ulid";
import { authenticate, AuthError, sha256Hex } from "./auth";
import { logAnalysis } from "./db";
import { LlmError, scoreText } from "./llm";
import { deriveAction, deriveRiskLevel } from "./scoring";
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
      return html(request.method === "HEAD" ? "" : homepageHtml());
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json(request.method === "HEAD" ? null : { status: "ok", service: "veracityapi", version: env.MODEL_VERSION || "v0.1" });
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze") {
      return handleDemoAnalyze(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-text") {
      return handleAnalyzeText(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};

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
