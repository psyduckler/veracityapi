# VeracityAPI Claude Code Plugin

Content verification tools for Claude Code using VeracityAPI MCP.

This plugin packages the public `@veracityapi/mcp` server with Claude Code skills and commands for pre-publish review, source triage, upload moderation, and batch QA workflows.

## What it adds

- MCP server: `veracityapi`
- Tools from `@veracityapi/mcp`:
  - `verify_content` when available as the primary smart tool for text, image, audio, URL, and base64 media inputs
  - `analyze_text`
  - `analyze_image`
  - `analyze_audio`
  - `analyze_batch`
  - `check_balance`
  - `get_balance`
- Skill: `veracity-content-verification`
- Commands:
  - `/veracityapi:check-text`
  - `/veracityapi:prepublish-review`
  - `/veracityapi:batch-triage`
  - `/veracityapi:check-balance`

## Prerequisites

1. Node.js and `npx` available on PATH.
2. A VeracityAPI key from <https://veracityapi.com/account>.
3. Set the key in your shell before launching Claude Code:

```bash
export VERACITY_API_KEY="vap_..."
claude
```

The plugin passes `VERACITY_API_KEY` to the local MCP subprocess. Do not paste API keys into prompts.

## Local test

From the repository root:

```bash
claude --plugin-dir ./packages/claude-plugin
```

Then run:

```txt
/plugin
/mcp
```

Confirm the `veracityapi` plugin is enabled and the VeracityAPI MCP server/tools are visible.

## Safety and positioning

Use VeracityAPI outputs as workflow-risk signals, not forensic proof of authorship, identity, or voice cloning. Route by deterministic `recommended_action` values: `allow`, `revise`, `human_review`, or `reject`.

Call `check_balance` before autonomous or high-volume jobs.

## Links

- Homepage: <https://veracityapi.com/integrations/claude>
- MCP docs: <https://veracityapi.com/integrations/mcp>
- npm package: <https://www.npmjs.com/package/@veracityapi/mcp>
- Privacy: <https://veracityapi.com/privacy>
