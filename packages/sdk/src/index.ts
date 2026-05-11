export type VeracityFormat = "article" | "social_post" | "product_review" | "caption" | "other";
export type VeracityIntendedUse = "publish" | "train" | "cite" | "moderate" | "other";
export type VeracityRiskLevel = "low" | "medium" | "high";
export type VeracityRecommendedAction = "allow" | "revise" | "human_review" | "reject";
export type VeracityConfidence = "low" | "medium" | "high";
export type VeracityAnalyzeType = "text" | "image" | "audio" | "asset";

export interface VeracityContext {
  format?: VeracityFormat;
  intended_use?: VeracityIntendedUse;
  domain?: string;
  custom_policy?: string;
}

export type VeracityMediaSource =
  | { kind: "url"; url: string }
  | { kind: "base64"; media_type: string; data: string };

export interface VeracityEvidenceItem {
  type: string;
  severity: "low" | "medium" | "high";
  span?: string;
  explanation: string;
}

export interface VeracityBillingMetadata {
  chars_analyzed?: number;
  units_analyzed?: number;
  billable_units?: number;
  unit_chars?: number;
  unit_price_cents?: number;
  bucket: string;
  price_cents: number;
  remaining_balance_cents: number;
}

export interface VeracityAnalyzeResponse {
  analysis_id: string;
  modality?: "text" | "image" | "audio" | "asset";
  content_trust_score?: number;
  risk_level: VeracityRiskLevel;
  recommended_action: VeracityRecommendedAction;
  confidence: VeracityConfidence;
  primary_reason?: string;
  evidence: VeracityEvidenceItem[];
  recommended_fixes: string[];
  limitations: string[];
  model_version?: string;
  revised_text?: string;
  revision_notes?: string[];
  transcript?: string;
  synthetic_risk?: number;
  specificity_risk?: number;
  provenance_weakness?: number;
  billing?: VeracityBillingMetadata;
  [key: string]: unknown;
}

export interface VeracityAnalyzeRequest {
  type: VeracityAnalyzeType;
  content: string | Array<{ type: "text" | "image" | "audio"; text?: string; source?: VeracityMediaSource }>;
  source?: VeracityMediaSource;
  transcript?: string;
  auto_revise?: boolean;
  context?: VeracityContext;
  store_content?: boolean;
}

export interface AnalyzeTextOptions {
  text: string;
  context?: VeracityContext;
  auto_revise?: boolean;
  storeContent?: boolean;
  /** @deprecated Use storeContent instead. */
  store_content?: boolean;
}

export interface AnalyzeImageOptions {
  imageUrl: string;
  context?: VeracityContext;
  /** Media raw bytes/full URLs are not retained by VeracityAPI; this option is forced false for media helpers. */
  storeContent?: boolean;
  /** @deprecated Use storeContent instead. */
  store_content?: boolean;
}

export interface AnalyzeAudioOptions {
  audioUrl: string;
  transcript?: string;
  context?: VeracityContext;
  /** Media raw bytes/full URLs are not retained by VeracityAPI; this option is forced false for media helpers. */
  storeContent?: boolean;
  /** @deprecated Use storeContent instead. */
  store_content?: boolean;
}

export interface AnalyzeBatchOptions {
  items: Array<{ id: string; text: string }>;
  context?: VeracityContext;
  storeContent?: boolean;
  /** @deprecated Use storeContent instead. */
  store_content?: boolean;
}

export interface VeracityBalanceResponse {
  account_id: string;
  balance_cents: number;
  currency: "USD";
  last_usage_at: string | null;
  recent_usage: {
    today_cents: number;
    last_7_days_cents: number;
    last_30_days_cents: number;
  };
  [key: string]: unknown;
}

export interface VeracityAPIOptions {
  /** API key from https://veracityapi.com/account. Defaults to VERACITY_API_KEY in Node runtimes. */
  apiKey?: string;
  /** Defaults to https://api.veracityapi.com. */
  baseUrl?: string;
  /** Custom fetch implementation for tests, edge runtimes, or instrumented clients. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. Defaults to no SDK timeout. */
  timeoutMs?: number;
}

export class VeracityAPIError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly requestId?: string;

  constructor(message: string, options: { status: number; body?: unknown; requestId?: string }) {
    super(message);
    this.name = "VeracityAPIError";
    this.status = options.status;
    this.body = options.body;
    this.requestId = options.requestId;
  }
}

export class VeracityAPI {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs?: number;

  constructor(options: VeracityAPIOptions = {}) {
    this.apiKey = options.apiKey ?? env("VERACITY_API_KEY") ?? "";
    this.baseUrl = stripTrailingSlash(options.baseUrl ?? env("VERACITY_API_BASE_URL") ?? "https://api.veracityapi.com");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs;
  }

  analyze(input: VeracityAnalyzeRequest): Promise<VeracityAnalyzeResponse> {
    return this.post<VeracityAnalyzeResponse>("/v1/analyze", {
      ...input,
      store_content: input.store_content ?? false,
    });
  }

  analyzeText(input: AnalyzeTextOptions): Promise<VeracityAnalyzeResponse> {
    return this.post<VeracityAnalyzeResponse>("/v1/analyze", {
      type: "text",
      content: input.text,
      auto_revise: input.auto_revise ?? false,
      context: input.context,
      store_content: normalizeStoreContent(input),
    });
  }

  analyzeImage(input: AnalyzeImageOptions): Promise<VeracityAnalyzeResponse> {
    return this.post<VeracityAnalyzeResponse>("/v1/analyze", {
      type: "image",
      content: input.imageUrl,
      context: input.context,
      store_content: false,
    });
  }

  analyzeAudio(input: AnalyzeAudioOptions): Promise<VeracityAnalyzeResponse> {
    return this.post<VeracityAnalyzeResponse>("/v1/analyze", {
      type: "audio",
      content: input.audioUrl,
      transcript: input.transcript,
      context: input.context,
      store_content: false,
    });
  }

  analyzeBatch(input: AnalyzeBatchOptions): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>("/v1/analyze-batch", {
      items: input.items,
      context: input.context,
      store_content: normalizeStoreContent(input),
    });
  }

  getBalance(): Promise<VeracityBalanceResponse> {
    return this.request<VeracityBalanceResponse>("GET", "/v1/balance");
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new VeracityAPIError("VERACITY_API_KEY is required. Create an API key at https://veracityapi.com/account.", { status: 401 });
    }
    if (!this.fetchImpl) {
      throw new VeracityAPIError("A fetch implementation is required in this runtime.", { status: 0 });
    }

    const controller = this.timeoutMs ? new AbortController() : undefined;
    const timeout = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new VeracityAPIError(`VeracityAPI request timed out after ${this.timeoutMs}ms.`, { status: 0 });
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const parsed = await parseResponse(response);
    if (!response.ok) {
      throw new VeracityAPIError(errorMessage(response.status, parsed), {
        status: response.status,
        body: parsed,
        requestId: response.headers.get("x-request-id") ?? undefined,
      });
    }
    return parsed as T;
  }
}

export type VeracityClient = VeracityAPI;
export const VeracityClient = VeracityAPI;

export function createClient(options: VeracityAPIOptions = {}): VeracityAPI {
  return new VeracityAPI(options);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || looksLikeJson(text)) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Fall through to text body below.
    }
  }
  return { message: text.slice(0, 500) };
}

function errorMessage(status: number, body: unknown): string {
  const message = bodyMessage(body);
  if (status === 400) return `VeracityAPI bad request: ${message}`;
  if (status === 401) return "VeracityAPI unauthorized: missing or invalid API key. Create an API key at https://veracityapi.com/account.";
  if (status === 402) return `VeracityAPI insufficient balance: ${message} Top up at https://veracityapi.com/account.`;
  if (status === 429) return `VeracityAPI rate limited: ${message}. Retry later.`;
  if (status === 503) return `VeracityAPI scoring model unavailable: ${message}. Retry shortly.`;
  return `VeracityAPI returned HTTP ${status}: ${message}`;
}

function bodyMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return "Request failed";
}

function normalizeStoreContent(input: { storeContent?: boolean; store_content?: boolean }): boolean {
  return input.storeContent ?? input.store_content ?? false;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function env(name: string): string | undefined {
  const maybeProcess = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
  return maybeProcess.process?.env?.[name];
}
