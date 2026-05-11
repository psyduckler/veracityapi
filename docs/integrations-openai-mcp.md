# OpenAI Actions + MCP distribution

VeracityAPI ships through two thin distribution surfaces:

1. **OpenAI Custom GPT Actions** via the live OpenAPI spec.
2. **MCP clients** via the local stdio package `@veracityapi/mcp`.

The HTTP API remains the source of truth. Do not duplicate scoring, billing, validation, audio fetching, or privacy logic in wrappers.

## OpenAI Custom GPT Action

### Import URL

```text
https://veracityapi.com/openapi.json
```

### Auth

Use API key / bearer auth.

```text
Authorization: Bearer vap_...
```

### Recommended actions exposed

Use these operation IDs from the OpenAPI spec:

- `analyzeText` → `POST https://api.veracityapi.com/v1/analyze`
- `analyzeImage` → `POST https://api.veracityapi.com/v1/analyze`
- `analyzeAudio` → `POST https://api.veracityapi.com/v1/analyze`
- `getBalance` → `GET https://api.veracityapi.com/v1/balance`

`analyzeBatch` is available in the spec, but initial Custom GPT instructions should prefer single-item calls unless the GPT is explicitly doing batch QA.

### GPT instructions

```text
Use VeracityAPI for content trust workflow triage before publishing, citing, training on, or moderating text, image URLs, or short audio URLs.

Always call getBalance before running multi-item or looped analyses.

For text, call analyzeText with text, context, and store_content=false unless the user explicitly asks otherwise.
For images, call analyzeImage only with HTTPS image URLs.
For audio, call analyzeAudio only with short HTTPS audio URLs. You may pass an optional caller transcript; VeracityAPI returns a Gemini-generated transcript if the user provides one, but VeracityAPI analyzes the audio directly.

Interpret results as probabilistic workflow risk signals with evidence and recommended action. Do not describe VeracityAPI as an AI detector, truth detector, authorship proof system, voice-clone proof system, speaker identity verifier, or forensic determination tool.

When reporting results, include risk_level, recommended_action, confidence, top evidence, recommended fixes, limitations, and remaining balance if returned.
```

### OpenAI listing copy

**Name:** VeracityAPI Content Trust

**Short description:** Score text, image URLs, and short audio URLs for workflow risk, evidence, and recommended review actions.

**Long description:** VeracityAPI helps agents triage content before publishing, citing, training, or moderation. It scores text for specificity/slop/provenance risk, image URLs for visible synthetic-image artifact risk, and short audio URLs for synthetic-audio workflow risk. Results include evidence, recommended fixes, a deterministic workflow action, limitations, and billing metadata. Scores are probabilistic workflow risk signals, not proof of authorship, truth, AI generation, voice cloning, or speaker identity.

## MCP package

Package: `@veracityapi/mcp`

Run:

```bash
VERACITY_API_KEY=vap_... npx -y @veracityapi/mcp
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "veracityapi": {
      "command": "npx",
      "args": ["-y", "@veracityapi/mcp"],
      "env": {
        "VERACITY_API_KEY": "vap_..."
      }
    }
  }
}
```

Tools:

- `analyze_text`
- `analyze_image`
- `analyze_audio`
- `check_balance`

## Directory copy for MCP listings

**Title:** VeracityAPI MCP

**Description:** MCP tools for VeracityAPI content trust scoring. Analyze text, HTTPS image URLs, and short HTTPS audio URLs for workflow risk, evidence, recommended fixes, and review actions. Includes account balance checks for autonomous agents. Thin wrapper over VeracityAPI's live HTTP API; no local scoring or media processing.

**Categories:** content safety, trust & safety, media analysis, agent tools, API wrapper

**Install:**

```bash
VERACITY_API_KEY=vap_... npx -y @veracityapi/mcp
```

## Privacy / safety positioning

Use this language consistently:

- Workflow risk signal
- Content trust score
- Evidence and recommended action
- No raw audio bytes/base64/full URL storage
- No image bytes stored
- `store_content=false` by default

Avoid these claims:

- AI detector
- Truth detector
- Authorship proof
- Synthetic media proof
- Voice-clone proof
- Speaker identity verification
- Forensic determination
