import { z } from "zod";
import type { AnalyzeBatchRequest, AnalyzeImageRequest, AnalyzeRequest } from "./types";

const formatSchema = z.enum(["article", "social_post", "product_review", "caption", "other"]).default("other");
const intendedUseSchema = z.enum(["publish", "train", "cite", "moderate", "other"]).default("other");

const requestSchema = z.object({
  text: z.string().min(20).max(100_000),
  context: z.object({
    format: formatSchema.optional(),
    intended_use: intendedUseSchema.optional(),
    domain: z.string().max(100).optional(),
  }).optional(),
  privacy_mode: z.boolean().optional().default(true),
});

const batchRequestSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(120),
    text: z.string().min(20).max(4_000),
  })).min(1).max(25),
  context: z.object({
    format: formatSchema.optional(),
    intended_use: intendedUseSchema.optional(),
    domain: z.string().max(100).optional(),
  }).optional(),
  privacy_mode: z.boolean().optional().default(true),
}).superRefine((value, ctx) => {
  const totalChars = value.items.reduce((sum, item) => sum + item.text.length, 0);
  if (totalChars > 50_000) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "batch total text must be 50,000 characters or less" });
  }
});

const imageRequestSchema = z.object({
  image_url: z.string().url().max(2000).refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "image_url must be an https:// URL"),
  context: z.object({
    format: formatSchema.optional(),
    intended_use: intendedUseSchema.optional(),
    domain: z.string().max(100).optional(),
  }).optional(),
  privacy_mode: z.boolean().optional().default(true),
});

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
    context: {
      format: parsed.data.context?.format ?? "other",
      intended_use: parsed.data.context?.intended_use ?? "other",
      domain: parsed.data.context?.domain,
    },
    privacy_mode: parsed.data.privacy_mode,
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
    context: {
      format: parsed.data.context?.format ?? "other",
      intended_use: parsed.data.context?.intended_use ?? "other",
      domain: parsed.data.context?.domain,
    },
    privacy_mode: parsed.data.privacy_mode,
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

  return {
    image_url: parsed.data.image_url,
    context: {
      format: parsed.data.context?.format ?? "other",
      intended_use: parsed.data.context?.intended_use ?? "other",
      domain: parsed.data.context?.domain,
    },
    privacy_mode: parsed.data.privacy_mode,
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
