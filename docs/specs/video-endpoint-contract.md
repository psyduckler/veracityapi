# VeracityAPI Video Endpoint Contract (Private Beta)

## Goal

`POST /v1/analyze-video` provides video authenticity workflow-risk triage. It is not forensic proof, court-grade deepfake detection, identity verification, provenance proof, or truth verification.

## Request

```json
{
  "video_url": "https://cdn.example.com/clip.mp4",
  "context": { "format": "social_post", "intended_use": "moderate", "domain": "UGC video review" },
  "store_content": false
}
```

No `execution_mode` exists in the MVP. SDK helpers call the typed endpoint directly and force `store_content:false`.

## Limits

- Direct downloadable HTTPS video URLs only.
- Supported containers: MP4, WebM, QuickTime/MOV as the extractor can decode.
- Maximum duration: 30 seconds.
- Maximum download size: 25 MB.
- Synchronous private-beta target; callers should use a ~45s timeout.

## Processing

Cloudflare Worker orchestrates auth, validation, balance preflight, extractor call, Claude Haiku 4.5 vision scoring, billing, and privacy-safe logging. The external zero-idle extractor transiently downloads the video, runs ffprobe/ffmpeg, returns one 3x2 JPEG contact sheet plus sanitized metadata, and deletes temporary files.

## Response signals

MVP exposes only contact-sheet/metadata signals:

- `synthetic_video_risk`
- `visual_synthetic_risk`
- `metadata_risk`
- `confidence`
- `risk_level`
- `recommended_action`
- `primary_reason`
- `evidence[]`
- `recommended_fixes[]`
- `limitations[]`
- `billing.bucket = "video_v0"`
- `billing.price_cents = 5`

No `temporal_consistency_risk`, audio-synthetic score, transcript score, timeline, or frame-by-frame forensic analysis is exposed until that behavior exists.

## Billing

Successful analyses bill exactly $0.05 / 5 cents in bucket `video_v0`. Failed analyses do not bill. SDK JSDoc/docstrings must state: “Cost: $0.05 per API call.”

## Privacy

VeracityAPI stores no raw video, extracted frames, contact sheet, audio, base64 payload, or full submitted video URL by default. D1 logs keep URL hash/hostname, safe metadata, response JSON, latency, and billing rows.

## Messaging guardrails

Use: “video authenticity risk scoring,” “workflow-risk triage,” “sampled contact-sheet signals,” “not forensic proof.”

Avoid/banned unless explicitly negated: “proof,” “guaranteed deepfake detector,” “court-grade,” “identity verification,” “forensic evidence,” “temporal analysis.”
