import { z } from "zod";
import type { AnalyzeRequest } from "./types";

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

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
