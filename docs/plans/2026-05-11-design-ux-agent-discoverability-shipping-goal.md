# Goal: ship Claude-like trust/docs UX + agent discoverability upgrades

Ship a production website refresh that makes VeracityAPI feel warmer, more trustworthy, more editorial, and easier for humans and agents to evaluate.

## Scope checklist

1. Hero trust strip + proof/evals CTA on homepage.
2. Docs sidebar + right table-of-contents + in-page search.
3. Copy buttons + language tabs for code examples.
4. Add `/llms-full.txt` and link it from discovery surfaces.
5. Fix heading order on homepage/docs content.
6. Improve homepage LCP by removing render-blocking external font dependency and simplifying above-fold rendering.
7. Warm Claude-like palette/typography refresh across homepage and docs pages.
8. Add methodology/trust-model page and route.
9. Reduce nav density while preserving discovery links in footer/docs.
10. Add schema.org enhancements for WebAPI, WebSite, Organization, BreadcrumbList, FAQ/TechArticle pages, and discovery links.

## Done criteria

- `npm test` passes.
- `npm run deploy` succeeds.
- Production smoke checks return 200 for `/`, `/docs`, `/methodology`, `/trust-model`, `/llms.txt`, `/llms-full.txt`, `/agents.json`, `/openapi.json`, `/sitemap.xml`, `/robots.txt`.
- Lighthouse spot checks run for homepage and docs after deploy.
- Final report includes commit SHA, deploy version, smoke results, Lighthouse scores, and any known follow-ups.
