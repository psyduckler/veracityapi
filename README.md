# VeracityAPI

Content trust and specificity scoring for agents. VeracityAPI scores English-calibrated text for generic/slop risk, weak provenance, low specificity, evidence spans, and a recommended workflow action.

VeracityAPI is **not** a binary AI detector. It does not prove whether content was written by a human or a model. It answers the agent workflow question: should this text be allowed, revised, reviewed, or rejected before publishing, citing, training, or moderation?

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

New accounts get $1.50 in free credits. No subscriptions. Buy credits when you need more. Every request debits your balance.

| Request size | Price |
| --- | ---: |
| ≤4k chars | $0.01 |
| ≤20k chars | $0.03 |
| ≤50k chars | $0.06 |
| ≤100k chars | $0.12 |
| >100k chars | chunk or contact us |

Public demo is free, no-key, privacy_mode=true, capped at 4,000 characters, and rate limited. New accounts get $1.50 in free API credits for authenticated testing; production API access is credit-based after that.

## MVP endpoint

```text
POST /v1/analyze-text
```

Auth: send a bearer token in the `Authorization` header. Create an account, get $1.50 in free credits, and create an API key at `/account`.

## Request

```bash
curl https://api.veracityapi.com/v1/analyze-text \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
    "context": {
      "format": "article",
      "intended_use": "publish",
      "domain": "travel"
    },
    "privacy_mode": true
  }'
```

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
  "recommended_action": "human_review",
  "confidence": "medium",
  "evidence": [
    { "type": "generic_phrasing", "severity": "high", "span": "...", "explanation": "..." }
  ],
  "recommended_fixes": ["..."],
  "model_version": "v0.1",
  "limitations": [
    "Scores are probabilistic workflow risk signals, not proof of AI authorship or truth.",
    "v0.1 uses an LLM-backed structured scoring pass; treat synthetic_risk as texture risk, not ground-truth authorship detection.",
    "English-calibrated at MVP; non-English content should be treated as experimental."
  ]
}
```

`synthetic_risk` is retained for compatibility. New integrations should prefer `content_trust_score`, `specificity_risk`, `provenance_weakness`, and `synthetic_texture_risk`.

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
