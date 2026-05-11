# VeracityAPI

Content, image, and audio trust scoring for agents. VeracityAPI scores English-calibrated text for generic/slop risk, weak provenance, and low specificity; image URLs for visible synthetic-image risk; and short HTTPS audio URLs for synthetic-audio workflow triage with transcript return.

VeracityAPI is **not** a binary AI detector. It does not prove whether content was written, generated, spoken, or edited by a human or a model. It answers the agent workflow question: should this text, image, or audio be allowed, revised, reviewed, or rejected before publishing, citing, training, or moderation?

## Live URLs

- Homepage + public demo: https://veracityapi.com
- Production API base: https://api.veracityapi.com
- Account / $1.50 free credit / credits / API keys: https://veracityapi.com/account
- Docs: https://veracityapi.com/docs
- How it works: https://veracityapi.com/how-it-works
- Evals/proof: https://veracityapi.com/evals
- Use cases: https://veracityapi.com/use-cases
- Examples/tool wrapper: https://veracityapi.com/examples
- Pricing: https://veracityapi.com/pricing
- Privacy: https://veracityapi.com/privacy
- OpenAPI: https://veracityapi.com/openapi.json
- Agent instructions: https://veracityapi.com/llms.txt
- Agent discovery manifest: https://veracityapi.com/.well-known/agents.json
- Sitemap: https://veracityapi.com/sitemap.xml

## Pricing

New accounts get $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise 1k-character text requests. No subscriptions. Buy credits when you need more. Every request debits your balance.

| Request size | Price |
| --- | ---: |
| Text analyze only | $0.005 per 1,000 characters, rounded up |
| Text Analyze + revise (`auto_revise:true`) | $0.010 per 1,000 characters, rounded up |
| Synchronous text batch | Sum of per-item 1k-character units |
| Image URL analysis | $0.02/image |
| Audio URL analysis | $0.01/request |
| >100k chars | chunk or contact us |

Public text, image, and audio demos are free, no-key, store_content=false, capped/rate limited, and include hosted demo fixtures. New accounts get $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise 1k-character text requests for authenticated testing; production API access is credit-based after that.

## Production endpoints

```text
GET /v1/balance
POST /v1/analyze              # unified text/image/audio endpoint
POST /v1/analyze-batch        # synchronous text batch
POST /v1/analyze-text         # legacy text endpoint
POST /v1/analyze-image        # legacy image endpoint
POST /v1/analyze-audio        # legacy audio endpoint
```

Public no-key demo endpoints:

```text
POST /demo/analyze
POST /demo/analyze-image
POST /demo/analyze-audio
GET /demo/influencer-beauty-tonic.jpg
GET /assets/demo-voice-message.mp3
```

Auth: send a bearer token in the `Authorization` header for `/v1/*` endpoints. Create an account, get $1.50 free credit, and create an API key at `/account`.

## Request

```bash
curl https://api.veracityapi.com/v1/analyze \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
    "auto_revise": true,
    "context": {
      "format": "article",
      "intended_use": "publish",
      "domain": "travel"
    },
    "store_content": false
  }'
```

## Image request

```bash
curl https://api.veracityapi.com/v1/analyze \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "content": "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    "context": {"format": "social_post", "intended_use": "publish", "domain": "influencer product post"},
    "store_content": false
  }'
```

Image analysis is API-key-only at launch, costs $0.02/image, stores no image bytes, and logs only the image URL hash plus hostname. Response fields include `content_trust_score`, `synthetic_image_risk`, `synthetic_risk` alias, `risk_level`, `recommended_action`, `confidence`, `evidence`, `recommended_fixes`, `limitations`, and billing.

## Audio request

```bash
curl https://api.veracityapi.com/v1/analyze \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "audio",
    "content": "https://veracityapi.com/assets/demo-voice-message.mp3",
    "transcript": "optional caller-provided transcript",
    "context": {"format": "social_post", "intended_use": "publish", "domain": "voice-message authenticity triage"},
    "store_content": false
  }'
```

Audio analysis costs $0.01/request under billing bucket `audio_v0`. It accepts small HTTPS MP3/WAV/M4A/WebM/OGG URLs, sends capped bytes to Gemini for strict synthetic-audio workflow triage with transcript return, stores no audio bytes/base64/full URLs, and returns `synthetic_audio_risk`, `workflow_risk`, `synthetic_risk` alias, `content_trust_score`, `risk_level`, `recommended_action`, `evidence`, `recommended_fixes`, `limitations`, and billing. It is not proof of AI generation, voice cloning, speaker identity, or forensic determination.

## Response shape

```json
{
  "analysis_id": "ana_...",
  "content_trust_score": 0.22,
  "specificity_risk": 0.78,
  "provenance_weakness": 0.78,
  "synthetic_texture_risk": 0.72,
  "synthetic_risk": 0.72,
  "slop_risk": 0.78,
  "risk_level": "high",
  "recommended_action": "revise",
  "confidence": "medium",
  "evidence": [
    { "type": "generic_phrasing", "severity": "high", "span": "...", "explanation": "..." }
  ],
  "recommended_fixes": ["..."],
  "revised_text": "A safer, more specific replacement appears here when auto_revise=true and recommended_action=revise.",
  "revision_notes": ["Added concrete details and provenance cues without inventing unsupported facts."],
  "model_version": "v0.1",
  "limitations": [
    "Scores are probabilistic workflow risk signals, not proof of AI authorship or truth.",
    "v0.1 uses an LLM-backed structured scoring pass; treat synthetic_risk as texture risk, not ground-truth authorship detection.",
    "English-calibrated at MVP; non-English content should be treated as experimental."
  ]
}
```

Evidence `type` is a strict enum for deterministic agent branching; unknown model output is normalized to `other`.

`synthetic_risk` is retained for compatibility. New integrations should prefer `content_trust_score`, `specificity_risk`, `provenance_weakness`, and `synthetic_texture_risk`.

For images, `synthetic_image_risk` is the canonical visible-artifact risk field and `synthetic_risk` is an alias for SDK consistency. v0.1 image scoring is a vision-LLM workflow signal, not proof of AI authorship and not EXIF/C2PA/provenance verification. For audio, `synthetic_audio_risk` is the canonical strict synthetic-audio triage signal and `workflow_risk` is the publication/provenance-review signal.

## Current threshold policy

`risk_level = max(synthetic_risk, slop_risk)`

- `< 0.40` → `low`
- `< 0.70` → `medium`
- `>= 0.70` → `high`

Action matrix:

| intended_use | low | medium | high |
| --- | --- | --- | --- |
| publish | allow | revise | human_review |
| train | allow | human_review | reject |
| cite | allow | human_review | reject |
| moderate | allow | allow | revise |
| other | allow | revise | human_review |

## Distribution surface

- `/docs` gives human-readable auth, schema, TypeScript/Python, and agent-tool integration examples.
- `/how-it-works` documents model/scoring method, thresholds, limitations, and roadmap.
- `/evals` shows early dogfooding proof and states the next labeled calibration target.
- `/use-cases` gives 10 agent business-function pages with policies, request templates, KPIs, and caveats.
- `/examples` provides a lightweight tool-wrapper example and points to the use-case library.
- `/pricing` describes the $1.50 signup credit plus credit-based, no-subscription billing.
- `/account` handles email login, credit purchase, and API key management.
- `site_events` stores lightweight page/demo/access-request analytics.

## Local development

```bash
npm install
npm test
npx tsc --noEmit
npx wrangler dev
```

## Limitations

- Workflow risk score, not proof of authorship or truth.
- v0.1 uses an LLM-backed structured scoring pass; not a custom fine-tuned classifier yet.
- English-calibrated at MVP; non-English scoring is experimental.
- Scores are only useful if evidence and recommended action are useful for the workflow.
