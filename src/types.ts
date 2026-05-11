export type Format = "article" | "social_post" | "product_review" | "caption" | "other";
export type IntendedUse = "publish" | "train" | "cite" | "moderate" | "other";
export type RiskLevel = "low" | "medium" | "high";
export type RecommendedAction = "allow" | "revise" | "human_review" | "reject";
export type Confidence = "low" | "medium" | "high";

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  /** @deprecated Legacy env keys are not accepted by paid endpoints; use D1-backed account API keys. */
  API_KEYS?: string;
  MODEL_VERSION?: string;
  DEMO_RATE_LIMIT_PER_HOUR?: string;
  LOGIN_RATE_LIMIT_PER_HOUR?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export interface BillingMetadata {
  chars_analyzed?: number;
  units_analyzed?: number;
  billable_units?: number;
  unit_chars?: number;
  unit_price_cents?: number;
  bucket: string;
  price_cents: number;
  remaining_balance_cents: number;
}

export type UnifiedAnalyzeType = "text" | "image" | "audio";

export interface UnifiedAnalyzeRequest {
  type: UnifiedAnalyzeType;
  content: string;
  transcript?: string;
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface AnalyzeContext {
  format: Format;
  intended_use: IntendedUse;
  domain?: string;
}

export interface AnalyzeRequest {
  text: string;
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface AnalyzeBatchItem {
  id: string;
  text: string;
}

export interface AnalyzeBatchRequest {
  items: AnalyzeBatchItem[];
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface BalanceSummary {
  account_id: string;
  balance_cents: number;
  currency: "USD";
  last_usage_at: string | null;
  recent_usage: {
    today_cents: number;
    last_7_days_cents: number;
    last_30_days_cents: number;
  };
}

export interface AnalyzeImageRequest {
  image_url: string;
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface EvidenceItem {
  type: string;
  severity: "low" | "medium" | "high";
  span: string;
  explanation: string;
}

export interface LlmScoredFields {
  synthetic_risk: number;
  slop_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
}

export interface ImageScoredFields {
  synthetic_image_risk: number;
  synthetic_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
}

export interface DerivedTrustSignals {
  /** Overall allowability score derived from v0.1 observable quality/provenance signals. Higher is better. */
  content_trust_score: number;
  /** Risk that the text is too vague, generic, or low-detail for the intended workflow. */
  specificity_risk: number;
  /** Risk that claims lack visible sourcing, firsthand detail, or provenance markers. */
  provenance_weakness: number;
  /** Backward-compatible authorship-texture signal; probabilistic and not proof of AI authorship. */
  synthetic_texture_risk: number;
}

export interface AnalyzeResponse extends LlmScoredFields, DerivedTrustSignals {
  analysis_id: string;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  model_version: string;
  limitations: string[];
  billing?: BillingMetadata;
}

export interface AnalyzeImageResponse extends ImageScoredFields {
  analysis_id: string;
  content_trust_score: number;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  model_version: string;
  limitations: string[];
  billing?: BillingMetadata;
}


export interface AnalyzeAudioRequest {
  audio_url: string;
  transcript?: string;
  context: AnalyzeRequest["context"];
  privacy_mode: boolean;
}

export interface AudioScoredFields {
  /** Best-effort transcript generated from the audio by Gemini. If the caller supplied a transcript, Gemini may correct it against the audio. */
  transcript: string;
  synthetic_audio_risk: number;
  workflow_risk: number;
  synthetic_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
}

export interface AnalyzeAudioResponse extends AudioScoredFields {
  analysis_id: string;
  content_trust_score: number;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  model_version: string;
  limitations: string[];
  billing?: {
    units_analyzed: number;
    bucket: string;
    price_cents: number;
    remaining_balance_cents: number;
  };
}
