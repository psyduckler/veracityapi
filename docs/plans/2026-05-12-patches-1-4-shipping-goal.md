# VeracityAPI Patches 1-4 Shipping Goal

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Complete and ship the four audit-remediation patch groups from the 2026-05-12 Phase A Y2K audit so the live VeracityAPI site is conversion-safe, trust-consistent, agent-discoverable, and mobile-accessible.

**Architecture:** Keep the current Cloudflare Worker + TypeScript + inline HTML/CSS architecture. Patch centrally where possible (`src/y2k.ts`, shared HTML helpers, discovery builders, route handlers), add regression tests for each production issue, deploy with Wrangler, then smoke the production domain with browser and curl checks.

**Tech Stack:** Cloudflare Worker, TypeScript, Vitest, Wrangler, production routes at `https://veracityapi.com` and `https://api.veracityapi.com`.

---

## Success Definition

Ship all four patch groups to production with:

- `npm test` passing.
- `npx tsc --noEmit` passing.
- `npm run deploy` succeeding.
- Production smoke checks passing for affected pages/routes.
- Final Slack report with commit SHA, Worker deploy/version ID, route smoke table, browser screenshots, and remaining follow-ups if any.

---

## Patch 1 — Conversion/Security Hotfix

**Objective:** Remove immediate conversion/security footguns on request access and account/API-key pages.

**Acceptance criteria:**

- `/request-access` no longer shows a success/received state on initial GET.
- Empty request-access form remains a form until successful POST.
- Account curl/API examples render valid copy-pasteable auth placeholders such as `Authorization: Bearer $VERACITY_API_KEY` or `Bearer API_KEY`; no malformed `Bearer ***` examples.
- Third-party analytics are disabled on secret-bearing pages: `/account`, auth routes, billing/checkout return pages, and any page that can display API keys or one-time tokens.
- Cookie banner no longer overlaps the homepage hero console, docs hero/search, or request-access form.
- Account page `strong`/important text has passing contrast against its background.

**Suggested files:**

- `src/index.ts`
- `src/account.ts`
- `src/pages.ts`
- `src/y2k.ts`
- shared HTML/analytics helper if present
- `test/account.test.ts`
- route/content tests covering request-access and analytics exclusion

**Verification:**

```bash
npm test
npx tsc --noEmit
curl -sS https://veracityapi.com/request-access?nocache=$(date +%s) | grep -v 'Request received'
curl -sS https://veracityapi.com/account?nocache=$(date +%s) | grep -E 'Bearer (\$VERACITY_API_KEY|API_KEY)'
curl -sS https://veracityapi.com/account?nocache=$(date +%s) | grep -viE 'googletagmanager|google-analytics|cloudflareinsights'
```

Browser QA: `/`, `/docs`, `/request-access`, `/account` desktop and mobile.

---

## Patch 2 — Product/Docs Trust Cleanup

**Objective:** Make public docs and policy examples safer, less overclaiming, and aligned with the actual VeracityAPI contract.

**Acceptance criteria:**

- Moderation high-risk examples route to `human_review` or `reject`, not `revise`.
- Privacy copy clearly states what is stored for text/image/audio, including response JSON/evidence/transcript behavior and `store_content:false` semantics.
- Replace absolute “proof” claims with “calibration evidence,” “routing evals,” or equivalent language.
- Image/audio examples use valid request bodies and production-supported enum values.
- Public docs distinguish workflow-risk signals from forensic proof, authorship proof, speaker identity, legal proof, or truth detection.

**Suggested files:**

- `src/pages.ts`
- `src/site.ts`
- `src/discovery.ts`
- docs/use-case data modules
- `test/productTrust.test.ts`
- `test/agentDistribution.test.ts`

**Verification:**

```bash
npm test
npx tsc --noEmit
curl -sS https://veracityapi.com/docs?nocache=$(date +%s) | grep -i 'human_review\|reject'
curl -sS https://veracityapi.com/docs?nocache=$(date +%s) | grep -i 'store_content:false\|no image bytes\|transcript'
curl -sS https://veracityapi.com/llms.txt?nocache=$(date +%s) | grep -i 'not.*proof'
```

---

## Patch 3 — SEO/Agent/Discovery Hygiene

**Objective:** Make machine-readable and indexable surfaces deterministic, canonical, and crawler-safe.

**Acceptance criteria:**

- `/openapi.json`, `/agents.json`, and `/.well-known/agents.json` do not emit dynamic request IDs inside the body.
- `/sitemap.xml` is deterministic across repeated requests; `lastmod` uses real content timestamps or is omitted.
- `www.veracityapi.com` redirects to apex instead of serving duplicate 200 content.
- `/trust` redirects to the canonical trust/methodology page or is intentionally served.
- `/trust-model` route and canonical agree, or the route redirects to `/methodology` consistently.
- `/alternatives` hub returns 200 if alternative detail pages are live.
- `/health` and `/account` include `noindex` behavior where appropriate.
- Favicon/content-type and missing font preload references are fixed.

**Suggested files:**

- `src/index.ts`
- `src/discovery.ts`
- `src/pages.ts`
- `src/y2k.ts`
- `wrangler.toml` if redirects/custom-domain logic needs route awareness
- discovery/route tests

**Verification:**

```bash
npm test
npx tsc --noEmit
for path in /openapi.json /agents.json /.well-known/agents.json /sitemap.xml; do curl -sS "https://veracityapi.com$path?nocache=$(date +%s)" > "/tmp$(echo $path | tr / _).1"; sleep 1; curl -sS "https://veracityapi.com$path?nocache=$(date +%s)" > "/tmp$(echo $path | tr / _).2"; diff "/tmp$(echo $path | tr / _).1" "/tmp$(echo $path | tr / _).2"; done
curl -I https://www.veracityapi.com/
curl -I https://veracityapi.com/trust
curl -I https://veracityapi.com/alternatives
```

---

## Patch 4 — Mobile/Accessibility Polish

**Objective:** Resolve the Lighthouse/WCAG and mobile usability issues that remain after Phase A.

**Acceptance criteria:**

- Pink `Agent-ready` stat-block text contrast passes WCAG AA (`>= 4.5:1`) or text/background colors are changed.
- Primary mobile nav/tabs/pills/docs links meet practical touch-target sizing.
- Code blocks have clear horizontal scroll and copy affordances on mobile.
- Above-fold chrome density is reduced only if visual QA shows conversion-critical content is crowded; preserve the distinctive Y2K chrome style.
- Lighthouse mobile accessibility remains at least 96 and no known contrast failures remain.

**Suggested files:**

- `src/y2k.ts`
- `src/site.ts`
- `src/pages.ts`
- `src/account.ts`
- CSS tests or content snapshots where practical

**Verification:**

```bash
npm test
npx tsc --noEmit
# Run Lighthouse mobile for / and /docs after deploy; target Accessibility >= 96, no contrast failure.
```

Browser QA: `/`, `/docs`, `/pricing`, `/account`, `/request-access` at mobile and desktop sizes.

---

## Shipping Sequence

1. Create branch: `fix/y2k-audit-patches-1-4`.
2. Implement Patch 1 with tests; commit `fix: harden conversion and account pages`.
3. Implement Patch 2 with tests; commit `docs: align trust and privacy copy`.
4. Implement Patch 3 with tests; commit `fix: stabilize discovery and canonical routes`.
5. Implement Patch 4 with browser QA; commit `fix: polish mobile accessibility`.
6. Run full local verification: `npm test && npx tsc --noEmit`.
7. Deploy: `npm run deploy`.
8. Smoke production affected routes and discovery files.
9. Capture browser screenshots for `/`, `/docs`, `/request-access`, `/account`.
10. Report commit SHA, deploy version, smoke results, screenshots, and any unresolved blockers.

---

## Rollback Plan

If production smoke fails after deploy:

1. Identify whether failure is visual/content-only or API/runtime.
2. If runtime/API affected, immediately redeploy the previous known-good Worker version via Wrangler/Cloudflare dashboard or revert commit and `npm run deploy`.
3. If visual-only but conversion/security is improved, keep deploy live only if CTAs/account/request-access work; otherwise revert.
4. Post rollback commit/version and failed smoke evidence in Slack.
