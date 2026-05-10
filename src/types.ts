export type Format = "article" | "social_post" | "product_review" | "caption" | "other";
export type IntendedUse = "publish" | "train" | "cite" | "moderate" | "other";
export type RiskLevel = "low" | "medium" | "high";
export type RecommendedAction = "allow" | "revise" | "human_review" | "reject";
export type Confidence = "low" | "medium" | "high";

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;
  API_KEYS: string;
  MODEL_VERSION?: string;
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

export interface AnalyzeResponse extends LlmScoredFields {
  analysis_id: string;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  model_version: string;
  limitations: string[];
}
