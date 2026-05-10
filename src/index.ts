import { ulid } from "ulid";
import { authenticate, AuthError } from "./auth";
import { logAnalysis } from "./db";
import { LlmError, scoreText } from "./llm";
import { deriveAction, deriveRiskLevel } from "./scoring";
import type { AnalyzeResponse, Env } from "./types";
import { parseAnalyzeRequest, ValidationError } from "./validate";

const LIMITATIONS = [
  "Probabilistic risk score, not proof of authorship.",
  "English-only at MVP.",
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "veracityapi", version: env.MODEL_VERSION || "v0.1" });
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-text") {
      return handleAnalyzeText(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};

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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
