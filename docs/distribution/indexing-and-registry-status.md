# Indexing and registry status

Last updated: 2026-05-11

## Sitemap

- Public sitemap: https://veracityapi.com/sitemap.xml
- Production smoke: passed for `/`, `/for-agents`, `/mcp`, `/evals`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/.well-known/agents.json`, and `/openapi.json` after deploy `65328265-d9bb-4b0e-8f31-351d50f85a32`.

## Automated indexing attempts

- Google sitemap ping: attempted `https://www.google.com/ping?sitemap=https://veracityapi.com/sitemap.xml`; response `404` with message that sitemap ping is deprecated.
- Bing sitemap ping: attempted `https://www.bing.com/ping?sitemap=https://veracityapi.com/sitemap.xml`; response `410`.
- IndexNow: attempted submit for `https://veracityapi.com/sitemap.xml`; response `202 Accepted`.

## Manual blockers

- Google Search Console sitemap submission requires authenticated browser/account access for the property.
- Bing Webmaster Tools sitemap submission requires authenticated browser/account access for the property.
- Indexing cannot be verified immediately; search engines may take days to crawl and surface new pages.

## GitHub visibility

- Repository topics added via `gh`: `agents`, `ai`, `ai-safety`, `ai-detection`, `cloudflare-workers`, `content-moderation`, `content-trust`, `content-verification`, `mcp`, `openapi`, `synthetic-content`, `veracityapi`.
- Release/tag created: `v0.1.0`.
