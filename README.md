# VeracityAPI

Content trust scoring for agents. VeracityAPI scores English text for synthetic-content risk, AI slop risk, weak provenance/content-quality signals, evidence spans, and a recommended action.

VeracityAPI is a probabilistic risk layer, not a truth oracle and not proof of authorship.

## Live URLs

- Homepage + public demo: https://veracityapi.com
- Production API base: https://api.veracityapi.com
- OpenAPI: https://veracityapi.com/openapi.json
- Agent instructions: https://veracityapi.com/llms.txt
- Agent discovery manifest: https://veracityapi.com/.well-known/agents.json
- Sitemap: https://veracityapi.com/sitemap.xml

## MVP endpoint

```text
POST /v1/analyze-text
```

Auth: send a bearer token in the `Authorization` header. API access is private beta; the homepage has a no-key public demo.

## Request

```bash
curl https://api.veracityapi.com/v1/analyze-text \
  -H "Authorization: Bearer $VERACITYAPI_KEY" \
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
  "limitations": ["Probabilistic risk score, not proof of authorship.", "English-only at MVP."]
}
```

## Local development

```bash
npm install
npm test
npx tsc --noEmit
npx wrangler dev
```

## Limitations

- Probabilistic risk score, not proof of authorship or truth.
- English-only at MVP.
- Scores are only useful if evidence and recommended action are useful for the workflow.
