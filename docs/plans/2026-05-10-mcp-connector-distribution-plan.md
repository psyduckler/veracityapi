# VeracityAPI MCP + Connector Distribution Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ship the simplest useful VeracityAPI MCP server while creating the docs, metadata, auth shape, and hosted surface needed for Claude connector, OpenAI marketplace/action, Cursor/Hermes/Windsurf, and third-party MCP directories.

**Architecture:** Start with a local stdio npm package that wraps the existing VeracityAPI HTTP endpoints. Add a thin hosted Streamable HTTP MCP endpoint only after the package contract is stable. Keep VeracityAPI itself as the source of truth: MCP should be a distribution wrapper, not a second scoring implementation.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, Zod, Node 20+, existing Cloudflare Worker API, optional second Worker/route for hosted MCP, npm package `@veracityapi/mcp`.

---

## Product Positioning

**Name:** VeracityAPI MCP

**Tagline:** Content trust scoring for agents before they publish, cite, train, or moderate content.

**Do say:**
- workflow risk signal
- content trust score
- specificity risk
- weak provenance signal
- visible synthetic-image artifact risk
- recommended action with evidence

**Do not say:**
- AI detector
- authorship proof
- truth detector
- guaranteed synthetic media detection

## Minimum Viable Surface

### v0 stdio package tools

1. `analyze_text`
   - Calls `POST https://api.veracityapi.com/v1/analyze-text`
   - Requires `VERACITY_API_KEY`
   - Input: `text`, optional `context`, optional `privacy_mode`
   - Output: raw JSON plus an agent-friendly summary string

2. `analyze_image`
   - Calls `POST https://api.veracityapi.com/v1/analyze-image`
   - Requires `VERACITY_API_KEY`
   - Input: `image_url`, optional `context`, optional `privacy_mode`
   - Output: raw JSON plus an agent-friendly summary string

3. `check_balance`
   - Calls `GET https://api.veracityapi.com/v1/balance` if live endpoint exists
   - If the endpoint is not implemented yet, defer this tool rather than mock it

### Explicitly defer

- OAuth
- batch MCP tool unless `/v1/analyze-batch` is live and tested
- feedback endpoint
- custom Claude-specific API beyond MCP
- custom OpenAI connector app until marketplace requirements are verified
- storing user API keys inside VeracityAPI MCP service

---

# Phase 0 — Verify current API contract

### Task 0.1: Confirm live endpoints and OpenAPI match implementation

**Objective:** Avoid shipping MCP tools for routes that exist in OpenAPI but not in the Worker router.

**Files:**
- Read: `src/index.ts`
- Read: `src/discovery.ts`
- Read: `README.md`

**Steps:**
1. Compare `src/index.ts` routes to `src/discovery.ts` OpenAPI paths.
2. Verify whether these are live in `src/index.ts`:
   - `/v1/analyze-text`
   - `/v1/analyze-image`
   - `/v1/analyze-batch`
   - `/v1/balance`
3. If OpenAPI advertises a route that is not implemented, either implement it before MCP exposes it or mark it as future in docs.

**Verification:**
Run:
```bash
npm test
npx tsc --noEmit
```
Expected: all tests pass and TypeScript succeeds.

---

# Phase 1 — Local stdio MCP package

### Task 1.1: Add workspace/package layout

**Objective:** Create an isolated npm package so MCP distribution does not complicate the Cloudflare Worker build.

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/mcp/src/veracity-client.ts`
- Create: `packages/mcp/src/schemas.ts`
- Create: `packages/mcp/test/mcp.test.ts`
- Modify: root `package.json` only if adding workspace scripts is useful

**Package name:** `@veracityapi/mcp`

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "^5.9.3",
    "vitest": "^4.0.8"
  }
}
```

**Verification:**
Run:
```bash
cd packages/mcp
npm install
npm test
npx tsc --noEmit
```
Expected: package installs, placeholder tests pass, TypeScript succeeds.

### Task 1.2: Implement Veracity API client

**Objective:** Centralize fetch/auth/error handling for MCP tools.

**Files:**
- Modify: `packages/mcp/src/veracity-client.ts`
- Test: `packages/mcp/test/veracity-client.test.ts`

**Implementation requirements:**
- Read config from environment:
  - `VERACITY_API_KEY` required for paid endpoints
  - `VERACITY_API_BASE_URL` optional, default `https://api.veracityapi.com`
- Add `Authorization: Bearer ${apiKey}`
- Add `Content-Type: application/json`
- Use clear MCP-safe error messages:
  - 400 bad request: include API message
  - 401 unauthorized: say API key missing/invalid
  - 402 insufficient balance: include required/balance/top-up URL if returned
  - 429 rate limited: include retry hint
  - 503 model unavailable: include retry hint
- Never log or return the API key

**Verification:**
Mock `fetch` and test 200/401/402/503 handling.

### Task 1.3: Define MCP tool schemas

**Objective:** Keep tool inputs simple and marketplace-readable.

**Files:**
- Modify: `packages/mcp/src/schemas.ts`
- Test: `packages/mcp/test/schemas.test.ts`

**Schemas:**
- `AnalyzeTextInput`
  - `text: string`, min 20, max 100000
  - `context.format?: enum article|social_post|product_review|caption|other`
  - `context.intended_use?: enum publish|train|cite|moderate|other`
  - `context.domain?: string`, max 100
  - `privacy_mode?: boolean`, default true
- `AnalyzeImageInput`
  - `image_url: string`, valid HTTPS URL
  - same optional context
  - `privacy_mode?: boolean`, default true

**Verification:**
Test valid/invalid text length, context enum, non-HTTPS image URL, default privacy mode.

### Task 1.4: Implement `analyze_text` MCP tool

**Objective:** Expose the core text scoring workflow.

**Files:**
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/src/veracity-client.ts`
- Test: `packages/mcp/test/mcp-tools.test.ts`

**Tool description:**
> Analyze text for content trust, specificity risk, weak provenance, slop risk, evidence, and recommended workflow action. VeracityAPI is not an AI-authorship detector or truth detector.

**Output format:**
Return MCP content with:
1. short text summary for the agent
2. JSON result object

**Summary template:**
```text
VeracityAPI result: {risk_level} risk, recommended_action={recommended_action}, content_trust_score={content_trust_score}.
Top evidence: {first 3 evidence explanations}.
Recommended fixes: {first 3 fixes}.
Limitations: workflow risk signal, not proof of authorship or truth.
```

**Verification:**
Mock a high-risk API response and assert the MCP result includes both summary and raw JSON.

### Task 1.5: Implement `analyze_image` MCP tool

**Objective:** Expose image URL scoring while preserving the no-image-bytes-stored promise.

**Files:**
- Modify: `packages/mcp/src/index.ts`
- Test: `packages/mcp/test/mcp-tools.test.ts`

**Tool description:**
> Analyze an HTTPS image URL for visible synthetic-image artifact risk, content trust score, evidence, and recommended workflow action. VeracityAPI does not inspect EXIF/C2PA in v0.1 and does not prove authorship.

**Verification:**
Mock image response and assert the summary mentions visible-artifact risk and limitations.

### Task 1.6: Add local smoke test script

**Objective:** Make manual QA easy before publishing.

**Files:**
- Create: `packages/mcp/scripts/smoke.mjs`
- Modify: `packages/mcp/package.json`

**Scripts:**
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "smoke": "tsx scripts/smoke.mjs"
  }
}
```

**Verification:**
Run with a real key:
```bash
cd packages/mcp
VERACITY_API_KEY=... npm run smoke
```
Expected: one text analysis succeeds and prints an `analysis_id`.

---

# Phase 2 — Docs and install paths

### Task 2.1: Add MCP docs page content

**Objective:** Create a public page that marketplace reviewers and users can understand.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/index.ts`
- Modify: `src/discovery.ts` if adding links to llms/agents metadata

**Route:** `/mcp`

**Page sections:**
1. What VeracityAPI MCP does
2. What it does not do
3. Claude Desktop config
4. Cursor/Windsurf/Hermes generic MCP config
5. Environment variables
6. Tool list and inputs
7. Pricing/free credit note
8. Privacy/security notes
9. Marketplace/listing contact

**Claude Desktop config example:**
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

**Hermes config example:**
```yaml
mcp_servers:
  veracityapi:
    command: "npx"
    args: ["-y", "@veracityapi/mcp"]
    env:
      VERACITY_API_KEY: "vapi_your_key_here"
```

**Verification:**
Run:
```bash
npm test
npx tsc --noEmit
npx wrangler dev
```
Then open `/mcp` locally.

### Task 2.2: Add package README

**Objective:** Make npm and directories self-serve.

**Files:**
- Create: `packages/mcp/README.md`

**Must include:**
- install/run
- supported clients
- env vars
- all tools
- pricing
- privacy
- limitations
- troubleshooting
- contact

**Verification:**
Dry-run npm package:
```bash
cd packages/mcp
npm pack --dry-run
```
Expected: package includes built files, README, license, package metadata.

### Task 2.3: Add marketplace listing assets

**Objective:** Keep copy consistent across Claude, OpenAI, MCP directories, and GitHub/npm.

**Files:**
- Create: `docs/marketplace/veracityapi-mcp-listing.md`
- Create: `docs/marketplace/veracityapi-openai-action.md`
- Create: `docs/marketplace/security-privacy.md`

**Assets:**
- 80-char tagline
- 250-char summary
- 1000-char description
- categories
- tool descriptions
- screenshots/checklist placeholders
- privacy statements
- support email

**Verification:**
Review copy against positioning rules: no authorship-proof or truth-detector claims.

---

# Phase 3 — Publish stdio package

### Task 3.1: Prepare npm publish

**Objective:** Publish a stable local MCP package.

**Files:**
- Modify: `packages/mcp/package.json`

**Package fields:**
- `name: @veracityapi/mcp`
- `version: 0.1.0`
- `description: Content trust scoring tools for MCP-compatible agents`
- `bin: { "veracityapi-mcp": "dist/index.js" }`
- `files: ["dist", "README.md"]`
- `repository`, `homepage`, `bugs`

**Verification:**
Run:
```bash
cd packages/mcp
npm run build
npm pack --dry-run
node dist/index.js --help || true
```

### Task 3.2: Publish npm package

**Objective:** Make install path real for Claude Desktop and other clients.

**Command:**
```bash
cd packages/mcp
npm publish --access public
```

**Verification:**
On a clean temp directory:
```bash
npx -y @veracityapi/mcp
```
Expected: MCP server starts without crashing. Missing key should only fail when paid tools are called, not at process start if possible.

---

# Phase 4 — OpenAI-compatible action path

### Task 4.1: Harden OpenAPI for Actions/marketplace ingestion

**Objective:** Make existing `https://veracityapi.com/openapi.json` friendly to OpenAI Custom GPT Actions and other OpenAPI importers.

**Files:**
- Modify: `src/discovery.ts`

**Requirements:**
- Unique operationIds:
  - `analyzeText`
  - `analyzeImage`
  - `analyzeBatch` only if live
  - `getBalance` only if live
- Avoid unsupported OpenAPI 3.1 constructs if importer rejects them; keep schemas simple.
- Make auth scheme clear: HTTP bearer.
- Add concise descriptions that say workflow risk, not authorship proof.

**Verification:**
Run:
```bash
npm test
npx tsc --noEmit
curl -s https://veracityapi.com/openapi.json | jq '.paths | keys'
```
Then import into a Custom GPT Action manually and make one test call with a test API key.

### Task 4.2: Create OpenAI Action instruction doc

**Objective:** Give OpenAI users an immediate integration path even before formal marketplace listing.

**Files:**
- Create: `docs/marketplace/openai-custom-gpt-setup.md`
- Link from `/mcp` or `/examples`

**Content:**
- Import OpenAPI URL
- Set auth to bearer API key
- Example system instructions:
  > Use VeracityAPI before publishing, citing, training on, or moderating user-provided text/images. Treat output as workflow risk only, not proof of authorship or truth.
- Example prompts

**Verification:**
Manual Custom GPT smoke test.

---

# Phase 5 — Hosted MCP endpoint, only after stdio adoption

### Task 5.1: Decide route and deployment model

**Objective:** Support future remote connector/marketplace flows without blocking v0.

**Preferred route:** `https://mcp.veracityapi.com/mcp`

**Options:**
1. Same Cloudflare Worker with route branching.
2. Separate Worker `veracityapi-mcp` to isolate dependencies and lifecycle.

**Recommendation:** Separate Worker if MCP SDK/server runtime conflicts with the existing Worker; same repo is fine.

**Verification:**
Confirm Cloudflare Workers support chosen MCP HTTP transport implementation cleanly before coding.

### Task 5.2: Implement hosted Streamable HTTP MCP

**Objective:** Expose the same tools over remote MCP for connector directories that prefer hosted endpoints.

**Files:**
- Create: `packages/mcp-worker/` or `src/mcp.ts`, depending on route decision
- Modify: `wrangler.toml` or add new `wrangler.mcp.toml`

**Auth model v0:**
- Client passes VeracityAPI key in `Authorization: Bearer ...`
- Server forwards it to VeracityAPI endpoints
- Do not store API keys

**Verification:**
Connect with an MCP HTTP client and call `analyze_text`.

### Task 5.3: Add remote MCP docs

**Objective:** Make hosted setup marketplace-ready.

**Files:**
- Modify: `/mcp` page
- Modify: `docs/marketplace/veracityapi-mcp-listing.md`

**Content:**
- hosted URL
- auth header instructions
- privacy/security
- tool list
- uptime/support expectations

---

# Phase 6 — Directory and marketplace submissions

### Task 6.1: Submit to MCP directories and developer ecosystems

**Objective:** Get discoverability without waiting for big platform review cycles.

**Targets:**
- npm search/discovery via `@veracityapi/mcp`
- GitHub README if repo is public or package subdir is mirrored
- MCP server directories/catalogs
- Cursor/Windsurf/Continue/Goose docs/community lists where allowed
- Hermes examples/docs if useful

**Required assets:**
- npm package URL
- `/mcp` docs URL
- security/privacy URL
- support email
- tool screenshots/examples

### Task 6.2: Claude connector submission path

**Objective:** Be ready for Anthropic connector/MCP directory requirements.

**Likely required:**
- public docs page
- package or hosted MCP URL
- privacy/security statement
- stable tool descriptions
- test account/API key or demo credit flow
- support contact

**Plan:**
1. Ship stdio first: immediate Claude Desktop support.
2. Add hosted MCP if Claude connector listing requires remote endpoint.
3. Submit listing with `docs/marketplace/veracityapi-mcp-listing.md` copy.

**Unknown:** exact Anthropic listing/review process can change. Verify current submission docs immediately before applying.

### Task 6.3: OpenAI marketplace/action submission path

**Objective:** Support OpenAI distribution without forcing MCP to be the only path.

**Primary path:** OpenAPI Action using `https://veracityapi.com/openapi.json`.

**Likely required:**
- OpenAPI schema imports cleanly
- auth configured as bearer API key
- privacy policy
- support contact
- examples
- maybe OAuth if formal marketplace connector requires account linking

**Plan:**
1. Harden OpenAPI now.
2. Publish Custom GPT setup doc.
3. If OpenAI requires OAuth for public marketplace connector, add OAuth later as a separate phase.

**Unknown:** exact OpenAI marketplace/connector review requirements can change. Verify before implementing OAuth.

---

# Acceptance Criteria

## v0 ship criteria

- `npx -y @veracityapi/mcp` starts an MCP stdio server.
- Claude Desktop config can call `analyze_text` with a real VeracityAPI key.
- `analyze_text` returns summary + raw JSON.
- `analyze_image` returns summary + raw JSON.
- API key never appears in logs/errors.
- `/mcp` docs page is live.
- npm README is complete.
- OpenAPI still passes TypeScript/tests.

## marketplace readiness criteria

- public docs: `/mcp`
- public OpenAPI: `/openapi.json`
- public privacy/security: `/privacy` plus `docs/marketplace/security-privacy.md` content adapted to site
- listing copy prepared
- screenshots/examples prepared
- test API key/credit flow available
- hosted MCP endpoint planned or implemented if required

---

# Recommended Execution Order

1. Phase 0 route audit.
2. Phase 1 stdio MCP package.
3. Phase 2 docs/listing assets.
4. Phase 3 npm publish.
5. Phase 4 OpenAI Action hardening.
6. Submit to MCP directories and Claude Desktop docs immediately.
7. Only then build Phase 5 hosted MCP if a marketplace requires it or users ask for remote connect.

This keeps the first useful version under one day while not painting us into a corner for Claude/OpenAI marketplace distribution.
