import { z } from "zod";

export const formatSchema = z.enum(["article", "social_post", "product_review", "caption", "other"]).default("other");
export const intendedUseSchema = z.enum(["publish", "train", "cite", "moderate", "other"]).default("other");

export const contextSchema = z.object({
  format: formatSchema.optional(),
  intended_use: intendedUseSchema.optional(),
  domain: z.string().max(100).optional(),
  custom_policy: z.string().max(2000).optional(),
}).optional().transform((context) => ({
  format: context?.format ?? "other",
  intended_use: context?.intended_use ?? "other",
  ...(context?.domain ? { domain: context.domain } : {}),
  ...(context?.custom_policy ? { custom_policy: context.custom_policy } : {}),
}));

const httpsUrl = (field: string) => z.string().url().max(2000).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, `${field} must be an https URL`);

export const analyzeTextInputSchema = z.object({
  text: z.string().min(20).max(100_000),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
  auto_revise: z.boolean().optional().default(false),
});

export const analyzeImageInputSchema = z.object({
  image_url: httpsUrl("image_url"),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
});

export const analyzeAudioInputSchema = z.object({
  audio_url: httpsUrl("audio_url"),
  transcript: z.string().max(10_000).optional(),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
});

export const analyzeVideoInputSchema = z.object({
  video_url: httpsUrl("video_url"),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
});

export const verifyContentInputSchema = z.object({
  content: z.string().min(1).max(100_000),
  content_type: z.enum(["auto", "text", "image", "audio", "video"]).optional().default("auto"),
  intended_use: intendedUseSchema.optional(),
  custom_policy: z.string().max(2000).optional(),
  domain: z.string().max(100).optional(),
  transcript: z.string().max(10_000).optional(),
  media_type: z.string().max(100).optional(),
  store_content: z.boolean().optional().default(false),
});

export const analyzeBatchInputSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(120),
    text: z.string().min(20).max(4000),
  })).min(1).max(25).describe("1-25 text items. Each item is capped at 4,000 characters; total API request is capped at 50,000 characters."),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
});

export type VerifyContentInput = z.infer<typeof verifyContentInputSchema>;
export type AnalyzeTextInput = z.infer<typeof analyzeTextInputSchema>;
export type AnalyzeImageInput = z.infer<typeof analyzeImageInputSchema>;
export type AnalyzeAudioInput = z.infer<typeof analyzeAudioInputSchema>;
export type AnalyzeVideoInput = z.infer<typeof analyzeVideoInputSchema>;
export type AnalyzeBatchInput = z.infer<typeof analyzeBatchInputSchema>;

const balanceInputSchema = {
  type: "object",
  properties: {},
} as const;

export const toolInputSchemas = {
  verify_content: {
    type: "object",
    required: ["content"],
    properties: {
      content: { type: "string", minLength: 1, maxLength: 100000, description: "Text, HTTPS image/audio/video URL, or base64 image/audio media data." },
      content_type: { type: "string", enum: ["auto", "text", "image", "audio", "video"], default: "auto" },
      intended_use: { type: "string", enum: ["publish", "train", "cite", "moderate", "other"], default: "other" },
      custom_policy: { type: "string", maxLength: 2000, description: "Caller policy applied as user workflow criteria, not model/system authority." },
      domain: { type: "string", maxLength: 100 },
      transcript: { type: "string", maxLength: 10000 },
      media_type: { type: "string", description: "Required when content is raw base64 media, e.g. image/png or audio/mpeg." },
      store_content: { type: "boolean", default: false },
    },
  },
  analyze_text: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 20, maxLength: 100000, description: "Call this tool immediately before publishing any generated draft, or whenever ingesting text from an unverified user. It returns safe routing plus optional revised_text when auto_revise=true." },
      context: contextJsonSchema(),
      store_content: { type: "boolean", default: false, description: "Explicit default: do not store raw content. Set true only if you want raw text retained for debugging/audit workflows." },
      privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false." },
      auto_revise: { type: "boolean", default: false, description: "When true, bill Analyze + revise at $0.010 per 1k chars and return revised_text only when recommended_action=revise." },
    },
  },
  analyze_image: {
    type: "object",
    required: ["image_url"],
    properties: {
      image_url: { type: "string", format: "uri", maxLength: 2000, description: "HTTPS image URL to analyze." },
      context: contextJsonSchema(),
      store_content: { type: "boolean", default: false, description: "Explicit default and only supported media-storage behavior: do not store image bytes or full image URLs; only URL hash and hostname are logged." },
      privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false; media raw-byte/full-URL storage is not supported." },
    },
  },
  analyze_audio: {
    type: "object",
    required: ["audio_url"],
    properties: {
      audio_url: { type: "string", format: "uri", maxLength: 2000, description: "HTTPS audio URL. VeracityAPI supports common short audio formats up to 4 MB." },
      transcript: { type: "string", maxLength: 10000, description: "Optional caller-supplied transcript/context. VeracityAPI transcribes audio with Gemini and returns a transcript in the response." },
      context: contextJsonSchema(),
      store_content: { type: "boolean", default: false, description: "Explicit default and only supported media-storage behavior: do not store audio bytes, base64, or full audio URLs; only URL hash and hostname are logged." },
      privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false; media raw-byte/full-URL storage is not supported." },
    },
  },
  analyze_video: {
    type: "object",
    required: ["video_url"],
    properties: {
      video_url: { type: "string", format: "uri", maxLength: 2000, description: "Direct downloadable HTTPS video URL. Private beta supports short MP4/WebM/QuickTime clips; no platform scraping." },
      context: contextJsonSchema(),
      store_content: { type: "boolean", default: false, description: "Explicit default and only supported video-storage behavior: do not store raw video, frames, contact sheets, or full video URLs; only URL hash, hostname, and safe metadata are logged." },
      privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false; raw-media/full-URL storage is not supported." },
    },
  },
  analyze_batch: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 25,
        description: "1-25 text items. Each item is capped at 4,000 characters; batch total max is 50,000 characters.",
        items: {
          type: "object",
          required: ["id", "text"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 120 },
            text: { type: "string", minLength: 20, maxLength: 4000 },
          },
        },
      },
      context: contextJsonSchema(),
      store_content: { type: "boolean", default: false, description: "Explicit default: do not store raw content. Set true only if you want raw text retained for debugging/audit workflows." },
      privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false." },
    },
  },
  check_balance: balanceInputSchema,
  get_balance: balanceInputSchema,
} as const;

function contextJsonSchema() {
  return {
    type: "object",
    properties: {
      format: { type: "string", enum: ["article", "social_post", "product_review", "caption", "other"], default: "other" },
      intended_use: { type: "string", enum: ["publish", "train", "cite", "moderate", "other"], default: "other" },
      domain: { type: "string", maxLength: 100 },
      custom_policy: { type: "string", maxLength: 2000, description: "Caller-supplied workflow policy." },
    },
  };
}

export const analysisOutputSchema = {
  type: "object",
  required: ["analysis_id", "risk_level", "recommended_action", "confidence", "evidence", "recommended_fixes", "model_version", "limitations"],
  properties: {
    analysis_id: { type: "string" },
    modality: { type: "string", enum: ["text", "image", "audio", "video", "asset", "content"] },
    content_trust_score: { type: "number", minimum: 0, maximum: 1 },
    synthetic_risk: { type: "number", minimum: 0, maximum: 1 },
    slop_risk: { type: "number", minimum: 0, maximum: 1 },
    synthetic_image_risk: { type: "number", minimum: 0, maximum: 1 },
    synthetic_audio_risk: { type: "number", minimum: 0, maximum: 1 },
    synthetic_video_risk: { type: "number", minimum: 0, maximum: 1 },
    visual_synthetic_risk: { type: "number", minimum: 0, maximum: 1 },
    metadata_risk: { type: "number", minimum: 0, maximum: 1 },
    workflow_risk: { type: "number", minimum: 0, maximum: 1 },
    transcript: { type: "string" },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    recommended_action: { type: "string", enum: ["allow", "revise", "human_review", "reject"] },
    primary_reason: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    evidence: { type: "array", items: { type: "object" } },
    recommended_fixes: { type: "array", items: { type: "string" } },
    revised_text: { type: "string" },
    revision_notes: { type: "array", items: { type: "string" } },
    billing: { type: "object" },
    model_version: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
  },
} as const;

export const batchOutputSchema = {
  type: "object",
  required: ["batch_id", "status", "partial_failure", "results"],
  properties: {
    batch_id: { type: "string" },
    status: { type: "string", enum: ["completed", "completed_with_errors", "failed"] },
    partial_failure: { type: "boolean" },
    results: { type: "array", items: { type: "object" } },
    billing: { type: "object" },
  },
} as const;

export const balanceOutputSchema = {
  type: "object",
  required: ["account_id", "balance_cents", "currency", "recent_usage"],
  properties: {
    account_id: { type: "string" },
    balance_cents: { type: "integer" },
    currency: { type: "string", enum: ["USD"] },
    last_usage_at: { type: ["string", "null"] },
    recent_usage: { type: "object" },
  },
} as const;

export const toolOutputSchemas = {
  verify_content: analysisOutputSchema,
  analyze_text: analysisOutputSchema,
  analyze_image: analysisOutputSchema,
  analyze_audio: analysisOutputSchema,
  analyze_video: analysisOutputSchema,
  analyze_batch: batchOutputSchema,
  check_balance: balanceOutputSchema,
  get_balance: balanceOutputSchema,
} as const;
