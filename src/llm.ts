import type { AnalyzeImageRequest, AnalyzeRequest, Env, ImageScoredFields, LlmScoredFields } from "./types";
import { clamp01 } from "./scoring";

interface AnthropicToolUse {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}

const SCORE_TOOL = {
  name: "return_content_risk_score",
  description: "Return content trust and slop/specificity risk scoring as strict structured data.",
  input_schema: {
    type: "object",
    properties: {
      synthetic_risk: { type: "number", minimum: 0, maximum: 1 },
      slop_risk: { type: "number", minimum: 0, maximum: 1 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      evidence: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            span: { type: "string", maxLength: 120 },
            explanation: { type: "string", maxLength: 240 },
          },
          required: ["type", "severity", "span", "explanation"],
          additionalProperties: false,
        },
      },
      recommended_fixes: {
        type: "array",
        maxItems: 5,
        items: { type: "string", maxLength: 240 },
      },
    },
    required: ["synthetic_risk", "slop_risk", "confidence", "evidence", "recommended_fixes"],
    additionalProperties: false,
  },
};

const SCORE_IMAGE_TOOL = {
  name: "return_image_risk_score",
  description: "Return synthetic-image trust scoring as strict structured data.",
  input_schema: {
    type: "object",
    properties: {
      synthetic_image_risk: { type: "number", minimum: 0, maximum: 1 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      evidence: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            span: { type: "string", maxLength: 200 },
            explanation: { type: "string", maxLength: 240 },
          },
          required: ["type", "severity", "span", "explanation"],
          additionalProperties: false,
        },
      },
      recommended_fixes: {
        type: "array",
        maxItems: 5,
        items: { type: "string", maxLength: 240 },
      },
    },
    required: ["synthetic_image_risk", "confidence", "evidence", "recommended_fixes"],
    additionalProperties: false,
  },
};

export async function scoreText(input: AnalyzeRequest, env: Env): Promise<LlmScoredFields> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0,
        system:
          "You are a content trust analyst. Score text for observable content trust risks: low specificity, weak provenance, generic/slop patterns, and synthetic/LLM-like texture. Use the tool exactly once. Do not overclaim; this is workflow risk scoring, not proof of authorship or truth.",
        messages: [
          {
            role: "user",
            content: buildPrompt(input),
          },
        ],
        tools: [SCORE_TOOL],
        tool_choice: { type: "tool", name: "return_content_risk_score" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new LlmError(`Anthropic returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: Array<AnthropicToolUse | Record<string, unknown>> };
    const toolUse = data.content?.find((item): item is AnthropicToolUse => item.type === "tool_use" && item.name === "return_content_risk_score");
    if (!toolUse) throw new LlmError("Anthropic response did not include expected tool_use");
    return normalizeScoredFields(toolUse.input);
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") throw new LlmError("Anthropic request timed out");
    throw new LlmError(err instanceof Error ? err.message : "Unknown Anthropic error");
  } finally {
    clearTimeout(timeout);
  }
}

export async function scoreImage(input: AnalyzeImageRequest, env: Env): Promise<ImageScoredFields> {
  try {
    return await scoreImageWithSource(input, env, { type: "url", url: input.image_url });
  } catch (err) {
    if (!(err instanceof LlmError) || !/Anthropic returned 400|source|url|image/i.test(err.message)) throw err;
    const fetched = await fetchImageForAnthropic(input.image_url);
    return scoreImageWithSource(input, env, { type: "base64", media_type: fetched.mediaType, data: fetched.base64 });
  }
}

async function scoreImageWithSource(input: AnalyzeImageRequest, env: Env, source: Record<string, string>): Promise<ImageScoredFields> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const model = env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0,
        system:
          "You are an image trust analyst. Score only observable visual synthetic-image risk signals. Do not claim authorship proof, metadata, EXIF, C2PA, source provenance, or truth. Use the tool exactly once.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source },
              { type: "text", text: buildImagePrompt(input) },
            ],
          },
        ],
        tools: [SCORE_IMAGE_TOOL],
        tool_choice: { type: "tool", name: "return_image_risk_score" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new LlmError(`Anthropic returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: Array<AnthropicToolUse | Record<string, unknown>> };
    const toolUse = data.content?.find((item): item is AnthropicToolUse => item.type === "tool_use" && item.name === "return_image_risk_score");
    if (!toolUse) throw new LlmError("Anthropic response did not include expected image tool_use");
    return normalizeImageScoredFields(toolUse.input);
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") throw new LlmError("Anthropic request timed out");
    throw new LlmError(err instanceof Error ? err.message : "Unknown Anthropic error");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImageForAnthropic(imageUrl: string): Promise<{ mediaType: string; base64: string }> {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") throw new LlmError("Only https image URLs are supported");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)) throw new LlmError("Private or localhost image URLs are not supported");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(imageUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "VeracityAPI/0.1 image-analysis" },
    });
    if (!res.ok) throw new LlmError(`Image fetch returned ${res.status}`);
    const mediaType = normalizeImageMediaType(res.headers.get("content-type") || "");
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > 5_000_000) throw new LlmError("Image is too large; max size is 5 MB");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 5_000_000) throw new LlmError("Image is too large; max size is 5 MB");
    return { mediaType, base64: uint8ToBase64(bytes) };
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") throw new LlmError("Image fetch timed out");
    throw new LlmError(err instanceof Error ? err.message : "Image fetch failed");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeImageMediaType(contentType: string): string {
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() || "";
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) return mediaType;
  throw new LlmError("Image URL did not return a supported image content-type");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isPrivateIp(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return host === "::1" || host === "[::1]";
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function buildPrompt(input: AnalyzeRequest): string {
  return `Score the following English text for content trust risk.

Return only by calling the provided tool.

Scoring guidance:
- synthetic_risk: legacy/backward-compatible synthetic texture risk, not proof of authorship. Score observable LLM-like texture such as formulaic cadence, template structure, hedging, and generic phrasing. Well-sourced or specific AI-assisted text may score low; weak human writing may score high.
- slop_risk: risk that the text is low-value/generic regardless of authorship. Signals: vague generalities, repeated transitions, listicle bloat, no concrete claims, no firsthand detail, weak source/provenance markers.
- Prefer evidence spans that explain specificity gaps, unsupported claims, weak provenance, and generic language.
- Calibrate to format: ${input.context.format}
- Calibrate to intended use: ${input.context.intended_use}
- Domain: ${input.context.domain || "general"}
- Short text under 100 words should usually return confidence low.
- Evidence spans must be verbatim quotes from the text.

Text:\n"""\n${input.text}\n"""`;
}

function buildImagePrompt(input: AnalyzeImageRequest): string {
  return `Score this image for observable synthetic-image risk for an agent workflow.

Return only by calling the provided tool.

Scoring guidance:
- synthetic_image_risk: probability-like workflow risk from visible image artifacts only, not proof of AI authorship.
- Look for observable artifacts: hands/fingers, face/teeth/eyes, text/signage/logos, geometry/perspective, object boundaries, lighting/shadows/reflections, repeated textures, over-smoothed plastic skin, malformed small details, and scene plausibility problems.
- Do not infer EXIF, C2PA, camera model, source provenance, copyright status, location truth, or metadata integrity.
- Missing metadata is not visible; do not cite it as evidence.
- Calibrate to format: ${input.context.format}
- Calibrate to intended use: ${input.context.intended_use}
- Domain: ${input.context.domain || "general"}
- Evidence span should be a short description of the visible image region or artifact, not a quote.
- If the image is ambiguous or low resolution, lower confidence and say why.`;
}

function normalizeScoredFields(raw: Record<string, unknown>): LlmScoredFields {
  const confidence = raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low" ? raw.confidence : "low";
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence.slice(0, 5) : [];
  const evidence = evidenceRaw.map((item) => {
    const obj = typeof item === "object" && item ? (item as Record<string, unknown>) : {};
    const rawSeverity = obj.severity;
    const severity: "low" | "medium" | "high" = rawSeverity === "high" || rawSeverity === "medium" || rawSeverity === "low" ? rawSeverity : "low";
    return {
      type: String(obj.type || "unspecified_signal").slice(0, 80),
      severity,
      span: String(obj.span || "").slice(0, 120),
      explanation: String(obj.explanation || "").slice(0, 240),
    };
  });
  const fixes = Array.isArray(raw.recommended_fixes) ? raw.recommended_fixes.slice(0, 5).map((x) => String(x).slice(0, 240)) : [];
  return {
    synthetic_risk: clamp01(raw.synthetic_risk),
    slop_risk: clamp01(raw.slop_risk),
    confidence,
    evidence,
    recommended_fixes: fixes,
  };
}

function normalizeImageScoredFields(raw: Record<string, unknown>): ImageScoredFields {
  const confidence = raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low" ? raw.confidence : "low";
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence.slice(0, 5) : [];
  const evidence = evidenceRaw.map((item) => {
    const obj = typeof item === "object" && item ? (item as Record<string, unknown>) : {};
    const rawSeverity = obj.severity;
    const severity: "low" | "medium" | "high" = rawSeverity === "high" || rawSeverity === "medium" || rawSeverity === "low" ? rawSeverity : "low";
    return {
      type: String(obj.type || "visual_artifact").slice(0, 80),
      severity,
      span: String(obj.span || "").slice(0, 200),
      explanation: String(obj.explanation || "").slice(0, 240),
    };
  });
  const fixes = Array.isArray(raw.recommended_fixes) ? raw.recommended_fixes.slice(0, 5).map((x) => String(x).slice(0, 240)) : [];
  const syntheticImageRisk = clamp01(raw.synthetic_image_risk);
  return {
    synthetic_image_risk: syntheticImageRisk,
    synthetic_risk: syntheticImageRisk,
    confidence,
    evidence,
    recommended_fixes: fixes,
  };
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}
