import type { AnalyzeAudioInput, AnalyzeBatchInput, AnalyzeImageInput, AnalyzeTextInput, AnalyzeVideoInput, VerifyContentInput } from "./schemas.js";

export interface VeracityClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class VeracityApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "VeracityApiError";
  }
}

export class VeracityClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VeracityClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.VERACITY_API_KEY ?? "";
    this.baseUrl = stripTrailingSlash(options.baseUrl ?? process.env.VERACITY_API_BASE_URL ?? "https://api.veracityapi.com");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  verifyContent(input: VerifyContentInput): Promise<Record<string, unknown>> {
    const contentType = input.content_type === "auto" || !input.content_type ? detectContentType(input.content, input.media_type) : input.content_type;
    const context = { intended_use: input.intended_use ?? "other", domain: input.domain, custom_policy: input.custom_policy };
    if (contentType === "text") return this.post("/v1/analyze", { type: "text", content: input.content, context, store_content: input.store_content ?? false });
    if (contentType === "video" && !input.media_type) return this.post("/v1/analyze-video", { video_url: input.content, context, store_content: false });
    const source = input.media_type ? { kind: "base64", media_type: input.media_type, data: input.content } : undefined;
    return this.post("/v1/analyze", { type: contentType, content: source ? "" : input.content, source, transcript: input.transcript, context, store_content: false });
  }

  analyzeText(input: AnalyzeTextInput): Promise<Record<string, unknown>> {
    return this.post("/v1/analyze", { type: "text", content: input.text, auto_revise: input.auto_revise, context: input.context, store_content: input.store_content ?? (input.privacy_mode === undefined ? false : !input.privacy_mode) });
  }

  analyzeImage(input: AnalyzeImageInput): Promise<Record<string, unknown>> {
    return this.post("/v1/analyze", { type: "image", content: input.image_url, context: input.context, store_content: false });
  }

  analyzeAudio(input: AnalyzeAudioInput): Promise<Record<string, unknown>> {
    return this.post("/v1/analyze", { type: "audio", content: input.audio_url, transcript: input.transcript, context: input.context, store_content: false });
  }

  analyzeVideo(input: AnalyzeVideoInput): Promise<Record<string, unknown>> {
    return this.post("/v1/analyze-video", { video_url: input.video_url, context: input.context, store_content: false });
  }

  analyzeBatch(input: AnalyzeBatchInput): Promise<Record<string, unknown>> {
    return this.post("/v1/analyze-batch", { items: input.items, context: input.context, store_content: input.store_content ?? false });
  }

  getBalance(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v1/balance");
  }

  private post(path: string, body: unknown): Promise<Record<string, unknown>> {
    return this.request("POST", path, body);
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    if (!this.apiKey) throw new VeracityApiError(401, "VERACITY_API_KEY is required. Create/copy a key at https://veracityapi.com/account.");

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });

    const parsed = await parseResponse(res);
    if (!res.ok) throw new VeracityApiError(res.status, errorMessage(res.status, parsed), parsed);
    return parsed;
  }
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed ? parsed as Record<string, unknown> : { value: parsed };
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function errorMessage(status: number, body: Record<string, unknown>): string {
  const apiMessage = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "Request failed";
  const topUp = typeof body.top_up_url === "string" ? ` Top up at ${body.top_up_url}.` : status === 402 ? " Top up at https://veracityapi.com/account." : "";
  if (status === 400) return `VeracityAPI bad request: ${apiMessage}`;
  if (status === 401) return "VeracityAPI unauthorized: missing or invalid API key. Create/copy a key at https://veracityapi.com/account.";
  if (status === 402) return `VeracityAPI insufficient balance: ${apiMessage}.${topUp}`;
  if (status === 429) return `VeracityAPI rate limited: ${apiMessage}. Retry later.`;
  if (status === 503) return `VeracityAPI scoring model unavailable: ${apiMessage}. Retry shortly.`;
  return `VeracityAPI returned HTTP ${status}: ${apiMessage}`;
}

function detectContentType(content: string, mediaType?: string): "text" | "image" | "audio" | "video" {
  if (mediaType?.startsWith("image/")) return "image";
  if (mediaType?.startsWith("audio/")) return "audio";
  if (mediaType?.startsWith("video/")) return "video";
  try {
    const url = new URL(content);
    const pathname = url.pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/.test(pathname)) return "image";
    if (/\.(mp4|mov|m4v|webm)$/.test(pathname)) return "video";
    if (/\.(mp3|wav|m4a|ogg)$/.test(pathname)) return "audio";
  } catch {}
  return "text";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
