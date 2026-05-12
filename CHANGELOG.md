# VeracityAPI Changelog

Public product updates for VeracityAPI. Dates are UTC-ish and backfilled from the current v0.1 launch work.

## 2026-05-11

- Shipped installable SDK packages: `@veracityapi/sdk` for TypeScript and `veracityapi` for Python.
- Updated homepage, docs, examples, and README around SDK-first integration paths.
- Repositioned homepage around content trust infrastructure for AI products while keeping agent-native proof points.
- Simplified pricing around self-serve prepaid credits and custom-volume contact paths.
- Added public `/status` and `/changelog` surfaces to reduce ghost-project perception.
- Promoted MCP as a primary agent-distribution path with local npm and hosted remote MCP details.
- Reworked README into a developer landing page with curl, TypeScript, Python, MCP, pricing, privacy, and eval proof.

## 2026-05-10

- Published seed text eval artifacts: 500 samples, 88.0% routing-action agreement, macro F1 0.871.
- Added transparent eval caveats: routing-action quality, not forensic authorship proof.
- Added unified `POST /v1/analyze` support across text, image URLs, and audio URLs.

## 2026-05-09

- Added hosted remote MCP endpoint at `https://api.veracityapi.com/mcp` for compatible MCP clients.
- Published `@veracityapi/mcp` local MCP package for Claude Desktop/Cursor-style tool use.
- Added balance preflight tools so autonomous agents can check spend before loops.

## 2026-05-08

- Added audio URL workflow triage under billing bucket `audio_v0` with transcript return.
- Added privacy-safe audio logging: URL hash/hostname only, no raw audio bytes, no base64, no full URL storage.
- Added stricter audio limitations copy: not voice-clone proof, speaker identity, or forensic determination.

## 2026-05-07

- Added image URL analysis with `synthetic_image_risk`, evidence, limitations, and action routing.
- Added public image demo fixture and image-specific privacy docs.
- Added visible-artifact caveats for screenshots, compression, missing provenance, and lack of EXIF/C2PA verification.

## 2026-05-06

- Added `GET /v1/balance` for API-key accounts and autonomous preflight checks.
- Added credit ledger refund handling for LLM/provider failures after debit.
- Added account self-serve flow for login, credits, and API key creation.

## 2026-05-05

- Added `/llms.txt`, `/.well-known/agents.json`, `/openapi.json`, sitemap, and robots metadata.
- Added `/for-agents` with routing policy templates and when-not-to-call guidance.
- Added examples for LangGraph, Vercel AI SDK, OpenAI Actions, and tool-wrapper usage.

## 2026-05-04

- Added action-first response contract: `allow`, `revise`, `human_review`, and `reject`.
- Added derived trust fields: `content_trust_score`, `specificity_risk`, `provenance_weakness`, and `synthetic_texture_risk`.
- Added privacy defaults centered on `store_content=false`.
