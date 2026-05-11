import { z } from "zod";

export const formatSchema = z.enum(["article", "social_post", "product_review", "caption", "other"]).default("other");
export const intendedUseSchema = z.enum(["publish", "train", "cite", "moderate", "other"]).default("other");

export const contextSchema = z.object({
  format: formatSchema.optional(),
  intended_use: intendedUseSchema.optional(),
  domain: z.string().max(100).optional(),
}).optional().transform((context) => ({
  format: context?.format ?? "other",
  intended_use: context?.intended_use ?? "other",
  ...(context?.domain ? { domain: context.domain } : {}),
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

export const analyzeBatchInputSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(120),
    text: z.string().min(20).max(4000),
  })).min(1).max(25).describe("1-25 text items. Each item is capped at 4,000 characters; total API request is capped at 50,000 characters."),
  context: contextSchema,
  store_content: z.boolean().optional().default(false),
  privacy_mode: z.boolean().optional(),
});

export type AnalyzeTextInput = z.infer<typeof analyzeTextInputSchema>;
export type AnalyzeImageInput = z.infer<typeof analyzeImageInputSchema>;
export type AnalyzeAudioInput = z.infer<typeof analyzeAudioInputSchema>;
export type AnalyzeBatchInput = z.infer<typeof analyzeBatchInputSchema>;

const balanceInputSchema = {
  type: "object",
  properties: {},
} as const;

export const toolInputSchemas = {
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
    },
  };
}
