import type { AnalyzeAudioRequest, AnalyzeAudioResponse, AnalyzeImageRequest, AnalyzeImageResponse, AnalyzeRequest, AnalyzeResponse, AnalyzeVideoRequest, AnalyzeVideoResponse, Env } from "./types";
import { sha256Hex } from "./auth";

export async function logAnalysis(args: {
  env: Env;
  analysisId: string;
  apiKeyHash: string;
  request: AnalyzeRequest | AnalyzeImageRequest | AnalyzeAudioRequest | AnalyzeVideoRequest;
  response: AnalyzeResponse | AnalyzeImageResponse | AnalyzeAudioResponse | AnalyzeVideoResponse;
  latencyMs: number;
  kind?: "text" | "image" | "audio" | "video";
}): Promise<void> {
  const { env, analysisId, apiKeyHash, request, response, latencyMs } = args;
  const kind = args.kind ?? ("video_url" in request ? "video" : "audio_url" in request ? "audio" : "image_url" in request ? "image" : "text");
  const inputForHash = kind === "video" ? (request as AnalyzeVideoRequest).video_url : kind === "image" ? (request as AnalyzeImageRequest).image_url : kind === "audio" ? (request as AnalyzeAudioRequest).audio_url : (request as AnalyzeRequest).text;
  const textHash = await sha256Hex(inputForHash);
  const textToStore = kind === "text" && !request.privacy_mode ? (request as AnalyzeRequest).text : null;
  const imageUrlDomain = kind === "video" ? safeHostname((request as AnalyzeVideoRequest).video_url) : kind === "image" ? safeHostname((request as AnalyzeImageRequest).image_url) : kind === "audio" ? safeHostname((request as AnalyzeAudioRequest).audio_url) : null;

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
