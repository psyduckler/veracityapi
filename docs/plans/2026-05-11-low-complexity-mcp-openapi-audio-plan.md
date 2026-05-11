# VeracityAPI Low-Complexity OpenAPI + MCP Distribution Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Maximize VeracityAPI distribution across OpenAI, Claude Desktop, Cursor, Windsurf, Hermes, and MCP directories with the least engineering complexity. Treat the existing HTTP API as the source of truth, use OpenAPI for OpenAI, and use a thin MCP wrapper for MCP-native clients.

**Key correction:** OpenAI distribution is primarily **OpenAPI Actions**, not MCP. Claude Desktop, Cursor, Windsurf, Continue, Goose, Hermes, and MCP directories use **MCP**. Do not build one complex connector stack when two thin surfaces cover more ground.

**Audio status:** `POST /v1/analyze-audio` is now live, along with `GET /v1/balance`. The live audio endpoint fetches a capped HTTPS audio URL, sends inline audio bytes to Gemini for structured workflow triage, stores no audio bytes/base64/full URL, and accepts an optional caller-supplied transcript. MCP should expose this as a first-class `analyze_audio` tool from v0.

**Architecture:**
1. Existing VeracityAPI HTTP endpoints remain canonical.
2. `openapi.json` unlocks OpenAI Custom GPT / Actions distribution.
3. `@veracityapi/mcp` is a thin local stdio npm package that proxies MCP tool calls to the live HTTP API.
4. Hosted MCP is a later wrapper around the same tool definitions, authenticated with bearer headers first; OAuth only if a marketplace explicitly requires it.

**Tech Stack:** TypeScript, existing Cloudflare Worker, OpenAPI 3.x, `@modelcontextprotocol/sdk`, Zod, Node 20+, npm package `@veracityapi/mcp`.

---

## Product Positioning

**Name:** VeracityAPI

**MCP package:** `@veracityapi/mcp`

**Tagline:** Content trust scoring for agents before they publish, cite, train, or moderate content.

**Do say:**
- workflow risk signal
- content trust score
- specificity risk
- weak provenance signal
- visible synthetic-image artifact risk
- synthetic-audio workflow risk from directly analyzed HTTPS audio URLs plus optional caller transcript
- recommended action with evidence

**Do not say:**
- AI detector
- authorship proof
- truth detector
- guaranteed synthetic media detection
- voice clone proof
- speaker identity verification
- waveform forensics in v0 audio

---

# Phase 0 — API contract audit and audio endpoint readiness

## Task 0.1: Audit existing routes versus OpenAPI

**Objective:** Ensure OpenAPI and MCP only expose live, stable endpoints.

**Files:**
- Read: `src/index.ts`
- Read: `src/discovery.ts`
- Read: `src/validate.ts`
- Read: `src/types.ts`
- Read: `README.md`
- Read: `docs/plans/2026-05-10-ai-audio-detection-mvp.md`

**Check live status:**
- `POST /v1/analyze-text`
- `POST /v1/analyze-image`
- `POST /v1/analyze-audio`
- `GET /v1/balance`

**Decision rule:**
- If route is live and tested, expose in OpenAPI and MCP.
- If route is not live, do not expose it yet.
- For `check_balance`, prioritize implementation because it is high leverage for agents, but do not ship a broken tool.

**Verification:**
```bash
npm test
npx tsc --noEmit
```

## Task 0.2: Confirm live audio schema

**Objective:** Use the implemented `POST /v1/analyze-audio` contract exactly in OpenAPI and MCP.

**Endpoint:**
```http
POST /v1/analyze-audio
Authorization: Bearer ***
Content-Type: application/json
```

**Live request:**
```json
{
  "audio_url": "https://example.com/clip.mp3",
  "transcript": "Optional caller-provided transcript or context.",
  "context": {
    "format": "social_post",
    "intended_use": "moderate",
    "domain": "travel safety"
  },
  "store_content": false
}
```

**Live validation rules:**
- `audio_url`: required, valid HTTPS URL, max 2,000 chars
- supported returned content types: `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/x-wav`, `audio/mp4`, `audio/m4a`, `audio/webm`, `audio/ogg`, `application/ogg`
- fetched audio max: 4 MB
- private/localhost audio URLs are rejected
- `transcript`: optional, max 10,000 chars
- no `metadata` field in the live API contract
- `context`: same `format` / `intended_use` / `domain` shape as text/image
- `privacy_mode`: defaults true

**Response requirements:**
- `analysis_id` prefix: `aud_`
- `content_trust_score`
- `synthetic_audio_risk`
- `workflow_risk`
- `synthetic_risk` alias
- `risk_level`
- `recommended_action`
- `confidence`
- `evidence`
- `recommended_fixes`
- `model_version`
- `limitations`
- `billing.bucket = audio_v0`
- `billing.price_cents = 1`

**Privacy rule:** VeracityAPI fetches audio bytes transiently for Gemini analysis but does not store audio bytes, base64, or the full URL. Logs should store only URL hash + hostname plus response/billing metadata.

---

# Phase 1 — OpenAI win via OpenAPI, no MCP needed

## Task 1.1: Harden OpenAPI for OpenAI Actions

**Objective:** Make `https://veracityapi.com/openapi.json` import cleanly into Custom GPT Actions and future OpenAI marketplace surfaces.

**Files:**
- Modify: `src/discovery.ts`

**Endpoints to expose if live:**
- `analyzeText` → `POST /v1/analyze-text`
- `analyzeImage` → `POST /v1/analyze-image`
- `analyzeAudio` → `POST /v1/analyze-audio`
- `getBalance` → `GET /v1/balance`

**Requirements:**
- Unique, stable `operationId` for every operation.
- Simple JSON schemas; avoid importer-hostile OpenAPI features.
- HTTP bearer auth scheme.
- Descriptions state workflow risk, not proof.
- Audio schema explicitly says direct HTTPS audio analysis, 4 MB fetch cap, no audio-byte/base64/full-URL storage, and no proof/identity claims.

**Verification:**
```bash
npm test
npx tsc --noEmit
curl -s https://veracityapi.com/openapi.json | jq '.paths | keys'
```
Then manually import into a Custom GPT Action and make one test call with a test API key.

## Task 1.2: Add OpenAI setup documentation

**Objective:** Let users and reviewers wire VeracityAPI into OpenAI without custom code.

**Files:**
- Create or update: `docs/marketplace/openai-custom-gpt-setup.md`
- Link from: `/docs`, `/examples`, or `/mcp`/integration page

**Instructions:**
- Import `https://veracityapi.com/openapi.json`
- Authentication: API Key → Bearer
- User pastes VeracityAPI API key
- Example system instruction:
  > Use VeracityAPI before publishing, citing, training on, or moderating user-provided text, image URLs, or short HTTPS audio URLs. Treat output as workflow risk only, not proof of authorship, truth, AI generation, voice cloning, or speaker identity.

**Verification:** Manual Custom GPT smoke test for text, image, and audio if audio endpoint is live.

---

# Phase 2 — Local MCP package for Claude Desktop, Cursor, Windsurf, Hermes

## Task 2.1: Create `@veracityapi/mcp` package

**Objective:** Build a thin stdio MCP proxy to the live HTTP API.

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/mcp/src/veracity-client.ts`
- Create: `packages/mcp/src/schemas.ts`
- Create: `packages/mcp/src/summaries.ts`
- Create: `packages/mcp/test/*.test.ts`

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "<pin before publish>",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "^5.9.3",
    "vitest": "^4.0.8"
  }
}
```

**Package fields:**
```json
{
  "name": "@veracityapi/mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": { "veracityapi-mcp": "dist/index.js" },
  "files": ["dist", "README.md"]
}
```

**Verification:**
```bash
cd packages/mcp
npm install
npm test
npx tsc --noEmit
```

## Task 2.2: Implement shared Veracity API client

**Objective:** Centralize auth, fetch, error handling, and secret safety.

**Config:**
- `VERACITY_API_KEY`: required when tools call paid endpoints
- `VERACITY_API_BASE_URL`: optional, default `https://api.veracityapi.com`

**Requirements:**
- Add `Authorization: Bearer ${apiKey}`.
- Add `Content-Type: application/json`.
- Handle 400/401/402/429/503 clearly.
- For 402, include top-up URL if returned.
- Never print, log, or return the API key.
- Missing API key should fail at tool-call time, not process startup, so `npx -y @veracityapi/mcp` can initialize cleanly.

**Verification:** Mock fetch tests for success and common errors.

## Task 2.3: Add MCP tools

**Objective:** Expose high-bang tools only.

**Tools:**

### `analyze_text`
Calls `POST /v1/analyze-text`.

Input:
```json
{
  "text": "string",
  "context": {
    "format": "article|social_post|product_review|caption|other",
    "intended_use": "publish|train|cite|moderate|other",
    "domain": "optional string"
  },
  "store_content": false
}
```

### `analyze_image`
Calls `POST /v1/analyze-image`.

Input:
```json
{
  "image_url": "https://example.com/image.jpg",
  "context": { "format": "article", "intended_use": "publish", "domain": "news" },
  "store_content": false
}
```

### `analyze_audio`
Calls `POST /v1/analyze-audio`.

Input:
```json
{
  "audio_url": "https://example.com/clip.mp3",
  "transcript": "Optional caller-provided transcript or context, max 10000 chars.",
  "context": { "format": "social_post", "intended_use": "moderate", "domain": "travel safety" },
  "store_content": false
}
```

Schema notes:
- `audio_url` must be HTTPS and max 2,000 chars.
- API fetches supported audio up to 4 MB and rejects private/localhost URLs.
- Do not include a `metadata` field unless the API later adds it.

Tool description must state: VeracityAPI directly analyzes a short HTTPS audio URL with Gemini; stores no audio bytes/base64/full URL; not proof of AI audio, voice cloning, speaker identity, or truth.

### `check_balance`
Calls live `GET /v1/balance`.

Returned summary should include balance in dollars/cents, recent usage, and the top-up URL `https://veracityapi.com/account`. If an analysis call returns 402, summarize the same top-up instruction.

**Output format for all analysis tools:**
- Text summary optimized for agents.
- Raw JSON result for programmatic use.

**Verification:** Mock API responses and assert summaries + raw JSON are returned.

## Task 2.4: Add package README and client configs

**Objective:** Make setup copy/pasteable.

**Files:**
- Create: `packages/mcp/README.md`

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "veracityapi": {
      "command": "npx",
      "args": ["-y", "@veracityapi/mcp"],
      "env": {
        "VERACITY_API_KEY": "vapi_your_key_here"
      }
    }
  }
}
```

**Hermes config:**
```yaml
mcp_servers:
  veracityapi:
    command: "npx"
    args: ["-y", "@veracityapi/mcp"]
    env:
      VERACITY_API_KEY: "vapi_your_key_here"
```

**Verification:**
```bash
cd packages/mcp
npm run build
npm pack --dry-run
npx -y .
```

## Task 2.5: Publish npm package

**Objective:** Unlock local MCP clients and MCP directories.

**Command:**
```bash
cd packages/mcp
npm publish --access public
```

**Verification:**
```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
npx -y @veracityapi/mcp
```
Expected: MCP server starts. Tool calls require a valid API key.

---

# Phase 3 — Canonical integration docs and listings

## Task 3.1: Add canonical integrations page

**Objective:** One public page that covers OpenAI via OpenAPI and MCP clients via `@veracityapi/mcp`.

**Route recommendation:** `/integrations` or `/mcp`

**Sections:**
1. OpenAI Custom GPT Actions: use OpenAPI, not MCP.
2. Claude Desktop / Cursor / Windsurf / Hermes: use local MCP package.
3. Tools: `analyze_text`, `analyze_image`, `analyze_audio`, `check_balance` if live.
4. Auth: bearer API key.
5. Pricing/free credit.
6. Privacy/security.
7. Limitations by modality.
8. Marketplace/listing contact.

**Verification:** Local page render and TypeScript pass.

## Task 3.2: Create single listings doc

**Objective:** Avoid copy drift across marketplace submissions.

**File:**
- Create: `docs/marketplace/listings.md`

**Sections:**
- OpenAI Custom GPT / Actions
- Claude Desktop MCP
- Cursor/Windsurf/Continue/Goose MCP
- MCP directories: Glama, Smithery, GitHub lists
- Future hosted MCP connector

Each section includes:
- tagline <= 80 chars
- summary <= 250 chars
- description <= 1000 chars
- categories
- tool descriptions
- privacy statement
- support/contact
- screenshots checklist

---

# Phase 4 — Directory submissions after v0 ship

## Task 4.1: Submit OpenAI path

**Objective:** Get OpenAI coverage with no new connector server.

**Path:** Publish/share a Custom GPT configured with `https://veracityapi.com/openapi.json`, API-key bearer auth, and VeracityAPI instructions.

**Reality check:** OpenAI public marketplace/connector requirements can change. Do not build OAuth unless API-key auth blocks the actual target distribution surface.

## Task 4.2: Submit MCP package paths

**Targets:**
- npm package page
- Glama
- Smithery
- GitHub MCP directories
- Cursor/Windsurf/Continue/Goose community docs where allowed
- Claude Desktop setup docs/page

**Required:** npm URL, docs URL, privacy URL, support email, screenshots/examples.

---

# Phase 5 — Hosted MCP only when it unlocks a real listing

## Task 5.1: Hosted MCP spike

**Objective:** Verify the lowest-complexity hosted MCP transport before committing.

**Preferred low-complexity auth:** Bearer API key header supplied by the user/client.

**Transport candidates:**
- Current MCP Streamable HTTP if supported by target clients.
- SSE only if a target directory/client explicitly requires SSE.

**Cloudflare route candidate:**
```text
https://api.veracityapi.com/mcp
```
or
```text
https://mcp.veracityapi.com/mcp
```

**Spike:** Build hello-world hosted MCP on Cloudflare Worker and verify `initialize` + trivial tool call.

## Task 5.2: Implement hosted MCP wrapper

**Objective:** Expose the same tools remotely.

**Tools:** same as local MCP:
- `analyze_text`
- `analyze_image`
- `analyze_audio`
- `check_balance` if live

**Auth:**
- Accept `Authorization: Bearer <VeracityAPI API key>`.
- Forward to existing API.
- Do not store API keys.

## Task 5.3: OAuth only if forced

**Rule:** Do not build OAuth until a target marketplace explicitly rejects bearer/API-key configuration.

If forced, scope OAuth as its own milestone:
- auth-code + PKCE
- scopes: `analyze:text`, `analyze:image`, `analyze:audio`, `balance:read`
- account-link UI
- token issue/refresh
- reviewer test account

---

# v0 Ship Gate

- `POST /v1/analyze-text`, `POST /v1/analyze-image`, and `POST /v1/analyze-audio` are live and documented, or MCP/OpenAPI only expose the live subset.
- `GET /v1/balance` is live and `check_balance` ships in MCP.
- OpenAPI imports into a Custom GPT Action.
- `npx -y @veracityapi/mcp` starts an MCP stdio server.
- Claude Desktop can call text/image/audio tools with a real key.
- Cursor/Windsurf/Hermes config examples are documented.
- API key never appears in logs/errors.
- Audio copy states direct HTTPS audio analysis, transient Gemini processing, no stored audio bytes/base64/full URL, and no voice/speaker/forensic proof.
- npm README and canonical integrations page are live.

# Recommended Execution Order

1. Audit route/OpenAPI parity for the now-live text/image/audio/balance endpoints.
2. Fix any OpenAPI drift for live audio/balance details.
3. Harden OpenAPI for text/image/audio/balance.
4. Build local `@veracityapi/mcp` with text/image/audio/balance tools.
5. Publish docs and npm package.
6. Submit OpenAI Action + MCP directory listings.
7. Build hosted MCP only when it unlocks a concrete Claude/enterprise/directory listing.

# Bottom Line

Gemini's strategic correction is right: OpenAI wants OpenAPI; MCP is for Claude Desktop/Cursor/Windsurf/Hermes-style clients. The lowest-complexity plan is not a universal connector. It is a clean HTTP API plus two thin wrappers: OpenAPI and MCP.

The only modification is that v0 must include `analyze_audio` alongside text/image/balance using the live direct-audio URL contract: HTTPS audio URL, optional caller transcript; VeracityAPI returns a Gemini-generated transcript, 4 MB cap, supported audio content types, no stored audio bytes/base64/full URL.
