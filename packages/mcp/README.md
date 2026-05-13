# @veracityapi/mcp

MCP server for VeracityAPI content trust scoring.

It exposes VeracityAPI's live HTTP API as thin MCP tools for Claude Desktop, Cursor, Windsurf, Continue, Goose, Hermes, and other MCP-compatible agents. The server does **not** implement scoring locally; VeracityAPI remains the source of truth for validation, billing, privacy handling, and scoring.

## Tools

- `analyze_text` → `POST /v1/analyze` with `type: "text"`
  - Scores text for content trust, specificity/slop risk, weak provenance, evidence, recommended fixes, and workflow action.
- `analyze_image` → `POST /v1/analyze` with `type: "image"`
  - Scores an HTTPS image URL for visible synthetic-image artifact risk and workflow action.
- `analyze_audio` → `POST /v1/analyze` with `type: "audio"`
  - Scores a short HTTPS audio URL for synthetic-audio workflow triage with transcript return.
  - Optional caller transcript/context can be supplied.
  - The MCP server does not download, transcode, or store audio.
- `check_balance` → `GET /v1/balance`
  - Returns account credit balance and recent usage windows.

VeracityAPI results are workflow risk signals. They are not proof of authorship, truth, AI generation, voice cloning, speaker identity, or forensic determination.

## Install / run

```bash
VERACITY_API_KEY=vap_... npx -y @veracityapi/mcp
```

Optional:

```bash
VERACITY_API_BASE_URL=https://api.veracityapi.com
```

## Claude Desktop config

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

## Cursor / Windsurf / Continue / Goose

Use the same stdio command:

```bash
npx -y @veracityapi/mcp
```

with environment:

```bash
VERACITY_API_KEY=vap_...
```

## Tool examples

### analyze_text

```json
{
  "text": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
  "context": { "format": "article", "intended_use": "publish", "domain": "travel safety" },
  "store_content": false
}
```

### analyze_image

```json
{
  "image_url": "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
  "context": { "format": "social_post", "intended_use": "publish", "domain": "influencer product post" },
  "store_content": false
}
```

### analyze_audio

```json
{
  "audio_url": "https://veracityapi.com/assets/demo-voice-message.mp3",
  "transcript": "Optional caller-supplied transcript or context.",
  "context": { "format": "social_post", "intended_use": "moderate", "domain": "voice-message authenticity triage" },
  "store_content": false
}
```

## Privacy notes

- Text: when `store_content=false`, raw text is not stored in D1 analysis logs.
- Image/audio media storage: the MCP client sends `store_content=false`; VeracityAPI stores no media bytes, base64 payloads, or full media URLs, only URL hash plus hostname.
- Image: VeracityAPI stores no image bytes and logs only URL hash + hostname.
- Audio: VeracityAPI fetches capped HTTPS audio transiently, stores no audio bytes/base64/full URL, and logs only URL hash + hostname.
- Local MCP server only proxies JSON to VeracityAPI and returns JSON responses to the calling agent.

## Errors

The MCP server maps VeracityAPI HTTP errors into readable tool errors:

- `401` missing/invalid API key
- `402` insufficient balance
- `429` rate limited
- `503` model unavailable

Run `check_balance` before autonomous loops.


Text auto-revise: set `auto_revise: true` on text requests to bill Analyze + revise at $0.010 / 1k characters and receive `revised_text` when `recommended_action` is `revise`. Evidence `type` values are strict enums for deterministic agent branching.


### Video private beta

The MCP server exposes `analyze_video` and routes `.mp4`, `.mov`, `.m4v`, and `.webm` URLs to video rather than audio. Video calls use `/v1/analyze-video`, force no raw video storage, are capped at 30 seconds / 25 MB, and cost $0.05 per successful API call.
