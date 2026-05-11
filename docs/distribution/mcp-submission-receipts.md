# MCP distribution submission receipts

Last updated: 2026-05-11

## Package verification

- Package source: `packages/mcp`
- Package name: `@veracityapi/mcp`
- Version: `0.1.0`
- Intended install: `npx -y @veracityapi/mcp`
- Local build/test/pack verification: pending final ship command in this branch
- NPM registry status before this shipment: `npm view @veracityapi/mcp` returned `404 Not Found`
- NPM publish blocker: local machine is not authenticated to npm (`npm whoami` returned `ENEEDAUTH`)

## Registry submission status

| Registry | Status | Receipt / URL | Notes |
| --- | --- | --- | --- |
| npm | Blocked | `npm whoami` → `ENEEDAUTH` | Needs npm login or automation token for `@veracityapi` scope before publish. |
| Smithery | Prepared | https://smithery.ai/ | Manual/account submission required; use `/mcp`, OpenAPI, repo URL, and package metadata. |
| Glama | Prepared | https://glama.ai/mcp/servers | Manual/account submission required. |
| PulseMCP | Prepared | https://www.pulsemcp.com/ | Manual/account submission required. |
| modelcontextprotocol.io | Prepared | https://modelcontextprotocol.io/ | Submit if/when public directory intake is available. |
| mcp.so | Prepared | https://mcp.so/ | Manual/account submission required. |

## Submission copy

**Name:** VeracityAPI MCP  
**Description:** Content verification tools for MCP-compatible agents. Analyze text, image URLs, audio URLs, and text batches; route workflows by `recommended_action`; preflight account balance before autonomous runs.  
**Homepage:** https://veracityapi.com/mcp  
**Docs:** https://veracityapi.com/docs  
**For agents:** https://veracityapi.com/for-agents  
**OpenAPI:** https://veracityapi.com/openapi.json  
**Repository:** https://github.com/psyduckler/veracityapi/tree/main/packages/mcp  
**Safety framing:** Workflow-risk scoring only; not forensic proof of authorship, truth, voice cloning, speaker identity, or legal determination.  
**Privacy:** Text can use `store_content:false`; image/audio calls store no raw media bytes, base64 payloads, or full media URLs by default.

## Next manual action

After npm login or token setup, run from `packages/mcp`:

```bash
npm test -- --run
npm run build
npm pack --dry-run
npm publish --access public
npm view @veracityapi/mcp name version dist-tags.latest --json
```

Then replace the `Prepared` rows above with actual receipt URLs/screenshots/IDs.
