# Changelog

All notable VeracityAPI changes are documented here.

## v0.1.0 — 2026-05-11

Initial public beta foundation.

### Added

- Unified `POST /v1/analyze` endpoint for `type: text | image | audio`.
- Legacy typed endpoints kept live for compatibility: `/v1/analyze-text`, `/v1/analyze-image`, `/v1/analyze-audio`, `/v1/analyze-batch`, `/v1/balance`.
- Flat usage pricing:
  - Text Analyze only: `$0.005 / 1k characters`, rounded up.
  - Text Analyze + revise: `$0.010 / 1k characters`, rounded up.
  - Image URL analysis: `$0.02/image`.
  - Audio URL workflow triage: `$0.01/request`.
- `auto_revise:true` for text requests, returning `revised_text` only when the recommended action is `revise`.
- Explicit `store_content:false` privacy field, with legacy `privacy_mode` compatibility.
- Gemini-powered audio URL analysis with generated transcript return and optional caller transcript context.
- Strict evidence type enums for deterministic agent branching.
- Agent-readable discovery: OpenAPI, `llms.txt`, `agents.json`, sitemap, robots, and IndexNow key route.
- MCP package source under `packages/mcp` for Claude Desktop/Cursor-style local MCP clients.
- Public pages for docs, pricing, privacy, examples, use cases, category/alternative/integration pages, and evals.
- Legal/trust foundation: MIT license, security policy, changelog, README badges, repository topics, and v0.1.0 release process.

### Changed

- Product positioning now emphasizes “Content Verification API for AI Agents” and workflow routing rather than forensic AI-authorship proof.
- Public copy and examples use the unified `{ type, content }` request shape where possible.
- Media privacy copy now states raw media bytes, base64 payloads, and full media URLs are not stored by default.

### Known limitations

- v0.1 scores are probabilistic workflow-risk signals, not proof of authorship, truth, identity, voice cloning, or forensic generation.
- Text scoring is English-calibrated first.
- Image scoring uses visible-artifact assessment only and does not inspect EXIF/C2PA metadata in v0.1.
- Audio scoring is async/post-upload workflow triage and can be affected by compression, noise, short clips, and edits.
