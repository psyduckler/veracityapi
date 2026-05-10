import type { AnalyzeRequest, AnalyzeResponse, Env } from "./types";
import { sha256Hex } from "./auth";

export async function logAnalysis(args: {
  env: Env;
  analysisId: string;
  apiKeyHash: string;
  request: AnalyzeRequest;
  response: AnalyzeResponse;
  latencyMs: number;
}): Promise<void> {
  const { env, analysisId, apiKeyHash, request, response, latencyMs } = args;
  const textHash = await sha256Hex(request.text);
  const textToStore = request.privacy_mode ? null : request.text;
  await env.DB.prepare(
    `INSERT INTO analysis_logs
      (analysis_id, created_at, api_key_hash, privacy_mode, text_hash, text, context_json, response_json, latency_ms, model_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      response.model_version
    )
    .run();
}
