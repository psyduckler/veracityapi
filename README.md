# VeracityAPI

Content trust scoring for agents. VeracityAPI scores English text for synthetic-content risk, AI slop risk, evidence, and a recommended action.

MVP endpoint:

```text
POST /v1/analyze-text
```

## Local development

```bash
npm install
npm test
npx wrangler dev
```

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

## Limitations

- Probabilistic risk score, not proof of authorship.
- English-only at MVP.
- Scores are only useful if evidence and recommended action are useful for the workflow.
