import type { AnalyzeImageRequest, AnalyzeImageResponse, AnalyzeRequest, AnalyzeResponse, Env } from "./types";
import { sha256Hex } from "./auth";

export async function logAnalysis(args: {
  env: Env;
  analysisId: string;
  apiKeyHash: string;
  request: AnalyzeRequest | AnalyzeImageRequest;
  response: AnalyzeResponse | AnalyzeImageResponse;
  latencyMs: number;
  kind?: "text" | "image";
}): Promise<void> {
  const { env, analysisId, apiKeyHash, request, response, latencyMs } = args;
  const kind = args.kind ?? ("image_url" in request ? "image" : "text");
  const inputForHash = kind === "image" ? (request as AnalyzeImageRequest).image_url : (request as AnalyzeRequest).text;
  const textHash = await sha256Hex(inputForHash);
  const textToStore = kind === "text" && !request.privacy_mode ? (request as AnalyzeRequest).text : null;
  const imageUrlDomain = kind === "image" ? safeHostname((request as AnalyzeImageRequest).image_url) : null;

  await env.DB.prepare(
    `INSERT INTO analysis_logs
      (analysis_id, created_at, api_key_hash, privacy_mode, text_hash, text, context_json, response_json, latency_ms, model_version, kind, image_url_domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      analysisId,
      new Date().toISOString(),
      apiKeyHash,
      request.privacy_mode ? 1 : 0,
      textHash,
      textToStore,
      JSON.stringify(request.context),
      JSON.stringify(response),
      latencyMs,
      response.model_version,
      kind,
      imageUrlDomain
    )
    .run();
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
