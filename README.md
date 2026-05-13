# VeracityAPI

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com/) [![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-blue.svg)](https://veracityapi.com/openapi.json) [![MCP](https://img.shields.io/badge/MCP-ready-purple.svg)](https://veracityapi.com/mcp) [![Status](https://img.shields.io/badge/status-live-10b981.svg)](https://veracityapi.com/status)

**Content trust infrastructure for AI products that ship.** VeracityAPI analyzes text, image URLs, and audio URLs, then returns the one field your workflow can route on: `recommended_action`.

```ts
switch (result.recommended_action) {
  case "allow": publish(); break;
  case "revise": requestRevision(result.evidence, result.recommended_fixes); break;
  case "human_review": queueForReview(result); break;
  case "reject": quarantine(); break;
}
```

VeracityAPI is **not** a binary AI detector and not forensic proof of authorship, identity, truth, voice cloning, or media provenance. It is a privacy-first workflow gate for teams and agents deciding whether content is safe enough to publish, cite, train on, moderate, or accept.

## Why builders use it

- **Action-first contract:** `allow`, `revise`, `human_review`, or `reject` instead of a naked probability score.
- **One endpoint:** `POST /v1/analyze` for `type: "text" | "image" | "audio"`.
- **Evidence-backed routing:** strict-ish enums, evidence spans/categories, recommended fixes, confidence, risk level, and limitations.
- **Agent-ready by default:** OpenAPI, `/llms.txt`, `/.well-known/agents.json`, local/remote MCP, examples for LangGraph/Vercel/OpenAI Actions.
- **Privacy defaults:** `store_content=false`; image/audio/video bytes, base64 payloads, frames/contact sheets, and full media URLs are not stored.
- **Usage-based pricing:** start free, then pay per request/unit; Team plan available for business usage.

## 30-second quickstart

```bash
export VERACITY_API_KEY="vapi_your_key_here"

curl https://api.veracityapi.com/v1/analyze \
  -H "Authorization: Bearer $VERACITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
    "auto_revise": true,
    "context": {
      "format": "article",
      "intended_use": "publish",
      "domain": "travel safety"
    },
    "store_content": false
  }'
```

Minimal response shape:

```json
{
  "analysis_id": "ana_...",
  "content_trust_score": 0.22,
  "risk_level": "high",
  "recommended_action": "human_review",
  "confidence": "medium",
  "primary_reason": "unsupported_generic_claims",
  "evidence": [
    { "type": "generic_phrasing", "severity": "high", "span": "...", "explanation": "..." }
  ],
  "recommended_fixes": ["Add concrete places, mechanisms, sources, or firsthand details."],
  "limitations": ["Workflow risk signal, not proof of AI authorship or truth."]
}
```

## TypeScript SDK

```bash
npm install @veracityapi/sdk
```

```ts
import { VeracityAPI } from "@veracityapi/sdk";

const veracity = new VeracityAPI({ apiKey: process.env.VERACITY_API_KEY });

const result = await veracity.analyzeText({
  text: draft,
  auto_revise: true,
  context: { format: "article", intended_use: "publish", domain: "content QA" },
});

if (result.recommended_action === "human_review") {
  await createReviewTicket(result.evidence);
}
```

## Python SDK

```bash
pip install veracityapi
```

```py
from veracityapi import VeracityAPI

client = VeracityAPI()  # reads VERACITY_API_KEY

result = client.analyze_text(
    draft,
    auto_revise=True,
    context={"format": "article", "intended_use": "publish", "domain": "content QA"},
)

if result["recommended_action"] == "human_review":
    create_review_ticket(result["evidence"])
```

## MCP for Claude Desktop, Cursor, and agents

Local stdio server:

```json
{
  "mcpServers": {
    "veracityapi": {
      "command": "npx",
      "args": ["-y", "@veracityapi/mcp"],
      "env": { "VERACITY_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

Hosted remote MCP is live at `https://api.veracityapi.com/mcp` for clients that support Streamable HTTP JSON-RPC with bearer auth. Tools include `verify_content`, `analyze_text`, `analyze_image`, `analyze_audio`, `analyze_batch`, and `check_balance`.

## Pricing

| Plan / usage | Price | Best for |
| --- | ---: | --- |
| Free starter credit | $1.50 included | First API key and smoke tests |
| Text analyze-only | $0.005 / 1k chars | QA, source triage, moderation |
| Text analyze + revise | $0.010 / 1k chars | Agent rewrite loops |
| Image URL analysis | $0.02 / image | Async UGC/image review |
| Audio URL analysis | $0.01 / request | Beta audio workflow triage |
| Enterprise | Contact sales | Volume, SLA, custom review workflow |

Usage-based API billing is self-serve for builders; contact sales for volume, procurement, or custom workflow needs.

## Privacy guarantees

- `store_content=false` is the default/public-demo behavior.
- Raw text is not retained unless explicitly opted in for text debugging/evals.
- Image/audio requests store no raw media bytes, no base64 payloads, and no full media URLs.
- Media logs keep metadata such as hostname and URL hash.
- LLM/provider failures are refunded in the usage ledger when billing has already debited.

## Current eval proof

Seed text benchmark v0.1 contains **500 labeled text samples** across firsthand human writing, dry factual human writing, generic AI slop, polished AI-with-specifics, and edge/adversarial mixed cases.

| Metric | Result |
| --- | ---: |
| Routing-action agreement | 88.0% |
| Macro F1 | 0.871 |
| Corpus | `data/evals/veracityapi_seed_corpus_500.jsonl` |
| Results | `data/evals/veracityapi_seed_results_v0_1.json` |

This proves early routing-action calibration, not forensic authorship detection. Image/audio evals and external comparator runs are still pending.

## Production endpoints

```text
GET  /v1/balance
POST /v1/analyze        # unified text/image/audio endpoint; video routes to private-beta video triage
POST /v1/analyze-video  # private-beta video authenticity risk
POST /v1/analyze-batch  # synchronous text batch
POST /v1/analyze-text   # legacy text endpoint
POST /v1/analyze-image  # legacy image endpoint
POST /v1/analyze-audio  # legacy audio endpoint
```

Public no-key demo endpoints:

```text
POST /demo/analyze
POST /demo/analyze-image
POST /demo/analyze-audio
GET  /demo/influencer-beauty-tonic.jpg
GET  /assets/demo-voice-message.mp3
```

## Live surfaces

- Site/demo: https://veracityapi.com
- API base: https://api.veracityapi.com
- Docs: https://veracityapi.com/docs
- Pricing: https://veracityapi.com/pricing
- Status: https://veracityapi.com/status
- Changelog: https://veracityapi.com/changelog
- Evals: https://veracityapi.com/evals
- MCP: https://veracityapi.com/mcp
- For agents: https://veracityapi.com/for-agents
- OpenAPI: https://veracityapi.com/openapi.json
- llms.txt: https://veracityapi.com/llms.txt
- agents.json: https://veracityapi.com/.well-known/agents.json

## Local development

```bash
npm install
npm test
npx tsc --noEmit
npx wrangler dev
```

## Limitations

- Workflow risk score, not proof of authorship, truth, provenance, or identity.
- v0.1 uses LLM-backed structured scoring, not a custom fine-tuned classifier.
- English-calibrated first; non-English scoring remains experimental.
- Image/audio are beta workflow-triage endpoints and not EXIF/C2PA/speaker-identity verification.
