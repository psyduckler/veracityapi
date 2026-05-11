# Anthropic Claude plugin submission

Use this file as the reviewer-facing source of truth for the VeracityAPI Claude Code plugin wrapper.

## Plugin links

- Plugin repository: <https://github.com/psyduckler/veracityapi/tree/main/packages/claude-plugin>
- Plugin homepage: <https://veracityapi.com/integrations/claude>
- MCP docs: <https://veracityapi.com/integrations/mcp>
- npm MCP package: <https://www.npmjs.com/package/@veracityapi/mcp>
- Privacy policy: <https://veracityapi.com/privacy>

## Plugin details

- Name: `VeracityAPI`
- Package/plugin identifier: `veracityapi`
- License: MIT
- Submitter email: `bernard@tabiji.ai`
- Supported platforms: Claude.ai custom connectors and Claude Code.

## Description

VeracityAPI gives Claude content verification tools for text, image, audio, and batch workflows. It helps agents triage AI-generated, manipulated, risky, or low-trust content before publishing, citing, moderating, accepting uploads, or using content as training data. Results include deterministic risk signals, evidence, and recommended_action routing such as allow, revise, human_review, or reject.

## Claude Code plugin contents

The plugin wrapper lives at `packages/claude-plugin` and includes:

- `.claude-plugin/plugin.json`: Anthropic plugin manifest.
- `.mcp.json`: MCP server config for `npx -y @veracityapi/mcp` using `VERACITY_API_KEY` from the user's environment.
- `skills/veracity-content-verification/SKILL.md`: operating policy for safe content-verification workflows.
- `commands/`: slash-command prompts for text checks, pre-publish review, batch triage, and balance checks.

## Example use cases

1. Pre-publish QA for articles, captions, social posts, landing pages, product pages, or campaign copy.
2. Upload/moderation triage for screenshots, generated images, voice clips, podcasts, and call recordings.
3. RAG/source trust checks before Claude cites, stores, or trains on content.
4. Batch triage for snippets, claims, comments, listings, and search results.
5. Agent safety gates before publishing, citing, moderating, or handing content to another agent.
6. Balance preflight before autonomous or high-volume verification jobs.

## Safety notes

Use VeracityAPI outputs as workflow-risk signals, not forensic proof of authorship, manipulation, speaker identity, or voice cloning. The plugin instructs Claude to route by deterministic `recommended_action` values and call `check_balance` before autonomous/batch jobs.
