from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict, Union

Format = Literal["article", "social_post", "product_review", "caption", "other"]
IntendedUse = Literal["publish", "train", "cite", "moderate", "other"]
RiskLevel = Literal["low", "medium", "high"]
RecommendedAction = Literal["allow", "revise", "human_review", "reject"]
Confidence = Literal["low", "medium", "high"]


class Context(TypedDict, total=False):
    format: Format
    intended_use: IntendedUse
    domain: str
    custom_policy: str


class UrlMediaSource(TypedDict):
    kind: Literal["url"]
    url: str


class Base64MediaSource(TypedDict):
    kind: Literal["base64"]
    media_type: str
    data: str


MediaSource = Union[UrlMediaSource, Base64MediaSource]


class AnalyzeRequest(TypedDict, total=False):
    type: Literal["text", "image", "audio", "asset"]
    content: Any
    source: MediaSource
    transcript: str
    auto_revise: bool
    context: Context
    store_content: bool


class EvidenceItem(TypedDict, total=False):
    type: str
    severity: Literal["low", "medium", "high"]
    span: str
    explanation: str


class BillingMetadata(TypedDict, total=False):
    chars_analyzed: int
    units_analyzed: int
    billable_units: int
    unit_chars: int
    unit_price_cents: int
    bucket: str
    price_cents: int
    remaining_balance_cents: int


class AnalyzeResponse(TypedDict, total=False):
    analysis_id: str
    modality: Literal["text", "image", "audio", "asset"]
    content_trust_score: float
    risk_level: RiskLevel
    recommended_action: RecommendedAction
    confidence: Confidence
    primary_reason: str
    evidence: List[EvidenceItem]
    recommended_fixes: List[str]
    limitations: List[str]
    model_version: str
    revised_text: str
    revision_notes: List[str]
    transcript: str
    synthetic_risk: float
    specificity_risk: float
    provenance_weakness: float
    billing: BillingMetadata


class AnalyzeBatchRequest(TypedDict, total=False):
    items: List[Dict[str, str]]
    context: Context
    store_content: bool
