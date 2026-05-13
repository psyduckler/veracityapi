export type Format = "article" | "social_post" | "product_review" | "caption" | "other";
export type IntendedUse = "publish" | "train" | "cite" | "moderate" | "other";
export type RiskLevel = "low" | "medium" | "high";
export type RecommendedAction = "allow" | "revise" | "human_review" | "reject";
export type Confidence = "low" | "medium" | "high";
export const EVIDENCE_TYPES = ["generic_phrasing", "low_specificity", "weak_provenance", "unsupported_claim", "hedging_and_absolutes", "synthetic_texture", "repetitive_structure", "missing_concrete_examples", "absence_of_specificity", "source_quality", "visual_artifact", "audio_signal", "prosody_consistency", "other"] as const;
export type EvidenceType = typeof EVIDENCE_TYPES[number];

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;
  VIDEO_VISION_MODEL?: string;
  VIDEO_EXTRACTOR_URL?: string;
  VIDEO_EXTRACTOR_TOKEN?: string;
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

export type UnifiedAnalyzeType = "text" | "image" | "audio" | "video" | "asset";
export type MediaSource = { kind: "url"; url: string } | { kind: "base64"; media_type: string; data: string };

export interface AssetContentBlock {
  type: "text" | "image" | "audio" | "video";
  text?: string;
  source?: MediaSource;
}

export interface UnifiedAnalyzeRequest {
  type: UnifiedAnalyzeType;
  content: string | AssetContentBlock[];
  source?: MediaSource;
  transcript?: string;
  auto_revise?: boolean;
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface AnalyzeContext {
  format: Format;
  intended_use: IntendedUse;
  domain?: string;
  /** Caller-supplied workflow policy. Treated as user instructions only, never system/developer authority. */
  custom_policy?: string;
}

export interface AnalyzeRequest {
  text: string;
  context: AnalyzeContext;
  privacy_mode: boolean;
  auto_revise?: boolean;
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
  source?: MediaSource;
  context: AnalyzeContext;
  privacy_mode: boolean;
}

export interface EvidenceItem {
  type: EvidenceType;
  severity: "low" | "medium" | "high";
  span: string;
  explanation: string;
}

export interface PolicyMatch {
  rule: string;
  matched: boolean;
  evidence?: string;
}

export interface LlmScoredFields {
  synthetic_risk: number;
  slop_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
  revised_text?: string;
  revision_notes?: string[];
  policy_matches?: PolicyMatch[];
}

export interface ImageScoredFields {
  synthetic_image_risk: number;
  synthetic_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
  policy_matches?: PolicyMatch[];
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
  modality: "text";
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  primary_reason: string;
  model_version: string;
  limitations: string[];
  billing?: BillingMetadata;
}

export interface AnalyzeImageResponse extends ImageScoredFields {
  analysis_id: string;
  modality: "image";
  content_trust_score: number;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  primary_reason: string;
  model_version: string;
  limitations: string[];
  billing?: BillingMetadata;
}


export interface AnalyzeAudioRequest {
  audio_url: string;
  source?: MediaSource;
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
  policy_matches?: PolicyMatch[];
}

export interface AnalyzeAudioResponse extends AudioScoredFields {
  analysis_id: string;
  modality: "audio";
  content_trust_score: number;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  primary_reason: string;
  model_version: string;
  limitations: string[];
  billing?: {
    units_analyzed: number;
    bucket: string;
    price_cents: number;
    remaining_balance_cents: number;
  };
}

export interface AnalyzeVideoRequest {
  video_url: string;
  context: AnalyzeRequest["context"];
  privacy_mode: boolean;
}

export interface VideoMetadata {
  duration_seconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  format?: string;
  size_bytes?: number;
  has_audio?: boolean;
}

export interface VideoExtractionResult {
  contact_sheet_base64: string;
  metadata: VideoMetadata;
  sampled_timestamps?: number[];
}

export interface VideoScoredFields {
  synthetic_video_risk: number;
  synthetic_risk: number;
  visual_synthetic_risk: number;
  metadata_risk: number;
  confidence: Confidence;
  evidence: EvidenceItem[];
  recommended_fixes: string[];
  policy_matches?: PolicyMatch[];
}

export interface AnalyzeVideoResponse extends VideoScoredFields {
  analysis_id: string;
  modality: "video";
  content_trust_score: number;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  primary_reason: string;
  model_version: string;
  limitations: string[];
  metadata?: VideoMetadata;
  billing?: {
    units_analyzed: number;
    bucket: string;
    price_cents: number;
    remaining_balance_cents: number;
  };
}
