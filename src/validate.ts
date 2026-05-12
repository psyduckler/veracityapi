import { z } from "zod";
import type { AnalyzeAudioRequest, AnalyzeBatchRequest, AnalyzeImageRequest, AnalyzeRequest, MediaSource, UnifiedAnalyzeRequest } from "./types";

const CUSTOM_POLICY_MAX = 2000;
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_AUDIO_BYTES = 4_000_000;
const IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const AUDIO_MEDIA_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"] as const;

const formatSchema = z.enum(["article", "social_post", "product_review", "caption", "other"]).default("other");
const intendedUseSchema = z.enum(["publish", "train", "cite", "moderate", "other"]).default("other");
const contextSchema = z.object({
  format: formatSchema.optional(),
  intended_use: intendedUseSchema.optional(),
  domain: z.string().max(100).optional(),
  custom_policy: z.string().trim().min(1).max(CUSTOM_POLICY_MAX).optional(),
}).optional();

const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url().max(2000) }),
  z.object({ kind: z.literal("base64"), media_type: z.string().max(100), data: z.string().min(1) }),
]);

const requestSchema = z.object({
  text: z.string().min(20).max(100_000),
  context: contextSchema,
  privacy_mode: z.boolean().optional(),
  store_content: z.boolean().optional(),
  auto_revise: z.boolean().optional().default(false),
});

const batchRequestSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(120),
    text: z.string().min(20).max(4_000),
  })).min(1).max(25),
  context: contextSchema,
  privacy_mode: z.boolean().optional(),
  store_content: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const totalChars = value.items.reduce((sum, item) => sum + item.text.length, 0);
  if (totalChars > 50_000) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "batch total text must be 50,000 characters or less" });
  }
});

const audioRequestSchema = z.object({
  audio_url: z.string().url().max(2000).refine((value) => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, "audio_url must be an https URL").optional(),
  source: sourceSchema.optional(),
  transcript: z.string().max(10000).optional(),
  context: contextSchema,
  privacy_mode: z.boolean().optional(),
  store_content: z.boolean().optional(),
});


const unifiedRequestSchema = z.object({
  type: z.enum(["text", "image", "audio", "asset"]),
  content: z.union([z.string().min(1).max(100_000), z.array(z.object({ type: z.enum(["text", "image", "audio"]), text: z.string().optional(), source: sourceSchema.optional() })).min(1).max(8)]),
  source: sourceSchema.optional(),
  transcript: z.string().max(10000).optional(),
  context: contextSchema,
  privacy_mode: z.boolean().optional(),
  store_content: z.boolean().optional(),
  auto_revise: z.boolean().optional().default(false),
});

const imageRequestSchema = z.object({
  image_url: z.string().url().max(2000).refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "image_url must be an https:// URL").optional(),
  source: sourceSchema.optional(),
  context: contextSchema,
  privacy_mode: z.boolean().optional(),
  store_content: z.boolean().optional(),
});


function normalizedContext(context: z.infer<typeof contextSchema>) {
  return {
    format: context?.format ?? "other",
    intended_use: context?.intended_use ?? "other",
    domain: context?.domain,
    custom_policy: context?.custom_policy,
  };
}

function privacyModeFrom(parsed: { privacy_mode?: boolean; store_content?: boolean }): boolean {
  if (parsed.privacy_mode !== undefined && parsed.store_content !== undefined && parsed.privacy_mode === parsed.store_content) {
    throw new ValidationError("privacy_mode and store_content conflict; prefer store_content:false or omit both for no raw content storage");
  }
  if (parsed.store_content !== undefined) return !parsed.store_content;
  return parsed.privacy_mode ?? true;
}

function validateHttpsUrl(value: string, message: string): void {
  let parsedUrl: URL;
  try { parsedUrl = new URL(value); } catch { throw new ValidationError(message); }
  if (parsedUrl.protocol !== "https:") throw new ValidationError(message);
  if (!isPublicHostname(parsedUrl.hostname)) throw new ValidationError("Media URL must use a public HTTPS hostname");
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (host === "::1" || host.includes(":")) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return true;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

function normalizeSource(type: "image" | "audio" | "text" | "asset", source: MediaSource): MediaSource {
  if (source.kind === "url") {
    validateHttpsUrl(source.url, "source.url: Media source URL must be an https URL");
    return source;
  }
  if (type !== "image" && type !== "audio") throw new ValidationError("source: base64 source is only supported for image or audio");
  const mediaType = source.media_type.split(";")[0]?.trim().toLowerCase() || "";
  const allowed = type === "image" ? IMAGE_MEDIA_TYPES : AUDIO_MEDIA_TYPES;
  if (!(allowed as readonly string[]).includes(mediaType)) throw new ValidationError(`source.media_type: Unsupported ${type} media type`);
  const maxBytes = type === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (!/^[A-Za-z0-9+/=\s_-]+$/.test(source.data)) throw new ValidationError("source.data: Base64 data is invalid");
  const compact = source.data.replace(/\s/g, "");
  const estimatedBytes = Math.floor((compact.length * 3) / 4);
  if (estimatedBytes > maxBytes) throw new ValidationError(`source.data: ${type} base64 payload is too large; max size is ${Math.floor(maxBytes / 1_000_000)} MB`);
  return { kind: "base64", media_type: mediaType, data: compact };
}

export async function parseUnifiedAnalyzeRequest(request: Request): Promise<UnifiedAnalyzeRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const parsed = unifiedRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }

  const content = parsed.data.content;
  const source = parsed.data.source ? normalizeSource(parsed.data.type, parsed.data.source) : undefined;
  if (parsed.data.type === "text") {
    if (typeof content !== "string" || content.length < 20 || content.length > 100_000) {
      throw new ValidationError("content: Text content must be 20-100000 characters");
    }
  } else if (parsed.data.type === "asset") {
    if (!Array.isArray(content)) throw new ValidationError("content: Asset content must be an array of typed blocks");
    for (const [index, block] of content.entries()) {
      if (block.type === "text" && (!block.text || block.text.length > 100_000)) throw new ValidationError(`content.${index}.text: Text asset blocks require text up to 100000 characters`);
      if ((block.type === "image" || block.type === "audio") && !block.source) throw new ValidationError(`content.${index}.source: Media asset blocks require source`);
      if (block.source) normalizeSource(block.type, block.source);
    }
  } else {
    if (!source) {
      if (typeof content !== "string") throw new ValidationError("content: Media content must be an https URL when source is omitted");
      validateHttpsUrl(content, "content: Media content must be an https URL");
      if (content.length > 2000) throw new ValidationError("content: Media URL must be 2000 characters or less");
    }
  }

  return {
    type: parsed.data.type,
    content,
    source,
    transcript: parsed.data.transcript,
    auto_revise: parsed.data.type === "text" ? parsed.data.auto_revise : false,
    context: normalizedContext(parsed.data.context),
    privacy_mode: privacyModeFrom(parsed.data),
  };
}

export async function parseAnalyzeRequest(request: Request): Promise<AnalyzeRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }

  return {
    text: parsed.data.text,
    auto_revise: parsed.data.auto_revise,
    context: normalizedContext(parsed.data.context),
    privacy_mode: privacyModeFrom(parsed.data),
  };
}

export async function parseAnalyzeBatchRequest(request: Request): Promise<AnalyzeBatchRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const parsed = batchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }

  return {
    items: parsed.data.items,
    context: normalizedContext(parsed.data.context),
    privacy_mode: privacyModeFrom(parsed.data),
  };
}

export async function parseAnalyzeAudioRequest(request: Request): Promise<AnalyzeAudioRequest> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ValidationError("Request body must be valid JSON"); }
  const parsed = audioRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  const source = parsed.data.source ? normalizeSource("audio", parsed.data.source) : undefined;
  if (!parsed.data.audio_url && !source) throw new ValidationError("audio_url or source is required");
  const audio_url = parsed.data.audio_url ?? (source?.kind === "url" ? source.url : "base64:audio");
  return {
    audio_url,
    source,
    transcript: parsed.data.transcript,
    context: normalizedContext(parsed.data.context),
    privacy_mode: privacyModeFrom(parsed.data),
  };
}

export async function parseAnalyzeImageRequest(request: Request): Promise<AnalyzeImageRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const parsed = imageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }

  const source = parsed.data.source ? normalizeSource("image", parsed.data.source) : undefined;
  if (!parsed.data.image_url && !source) throw new ValidationError("image_url or source is required");
  if (parsed.data.image_url) validateHttpsUrl(parsed.data.image_url, "image_url must be an https:// URL");
  const image_url = parsed.data.image_url ?? (source?.kind === "url" ? source.url : "base64:image");
  return {
    image_url,
    source,
    context: normalizedContext(parsed.data.context),
    privacy_mode: privacyModeFrom(parsed.data),
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
