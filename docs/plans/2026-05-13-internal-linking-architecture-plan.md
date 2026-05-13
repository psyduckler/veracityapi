# VeracityAPI Internal Linking Architecture Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn VeracityAPI’s current sitemap-heavy site into a deliberate internal-link graph where every important page has contextual inlinks from relevant hubs, related pages, and conversion surfaces — without creating spammy footer/nav bloat or unsupported benchmark claims.

**Architecture:** Add a small, typed internal-linking layer in the server-rendered Worker site. Keep global navigation focused, expand footer/hub coverage, then add contextual related-link modules for page families: homepage/core, docs, use cases, category SEO pages, integrations, alternatives, comparisons, and blog posts. Verify with automated link-graph tests against generated HTML and live smoke checks after deploy.

**Tech Stack:** Cloudflare Worker + TypeScript string-rendered pages, Vitest, existing sitemap/discovery generation, live crawl verification via curl/Python.

---

## Audit snapshot — 2026-05-13

Crawled live `https://veracityapi.com/sitemap.xml` and fetched every sitemap URL.

- Sitemap URLs crawled: **76**
- Status: **76/76 returned 200**
- Main problem: many URLs are in sitemap/discovery but not reachable via normal HTML links except global nav/footer or a single index page.
- Global nav currently links only: `/docs`, `/evals`, `/methodology`, `/for-agents`, `/pricing`, `/openapi.json`, `/account`.
- Footer currently links only: `/docs`, `/evals`, `/use-cases`, `/pricing`, `/about`, `/privacy`, `/terms`, `/security`, `/llms.txt`, `/sitemap.xml`.
- Global footer/nav make `/docs`, `/pricing`, `/evals`, `/account`, `/privacy`, `/terms`, `/security` strong, but leave most SEO/distribution pages weak.

### Pages with zero sitemap-page inlinks

These are live/indexable or discovery-listed pages that had **0 internal inlinks from sitemap pages** in the crawl, excluding global machine links where applicable:

- `/mcp`
- `/ai-detection-api`
- `/ai-content-detector-api`
- `/ai-written-content-detection`
- `/ai-generated-content-detection`
- `/ai-written-content-detector`
- `/ai-generated-text-detector`
- `/synthetic-media-detection-api`
- `/ai-image-detection-api`
- `/ai-audio-detection-api`
- `/alternatives/deepmedia`
- `/integrations/openai-actions`
- `/integrations/langgraph`
- `/vs`
- `/blog`
- `/examples`
- `/alternatives`

### Page-family inlink summary

| Family | Pages | Avg sitemap inlinks | Zero-inlink pages | Low-inlink pages `<=2` | Diagnosis |
|---|---:|---:|---:|---:|---|
| Home | 1 | 76.0 | 0 | 0 | Strong due logo/footer/home links. |
| Docs | 2 | 38.5 | 0 | 1 | `/docs` strong; `/docs/errors` only linked from docs. |
| Core | 21 | 33.33 | 5 | 11 | Global pages strong; newer hubs like `/vs`, `/blog`, `/examples`, `/mcp`, `/what-we-detect` weak. |
| Use cases | 29 | 1.31 | 0 | 28 | Mostly only linked from `/use-cases`; little cross-linking by modality/job. |
| Category SEO | 9 | 0.0 | 9 | 9 | Biggest SEO leak: all AI detector/category pages are orphaned from HTML graph. |
| Alternatives | 4 | 0.75 | 1 | 4 | Alternatives hub exists but itself is orphaned; DeepMedia page orphaned. |
| Integrations | 4 | 4.75 | 2 | 3 | Claude gets inlinks through `/mcp`; OpenAI Actions and LangGraph are orphaned. |
| Comparisons | 4 | 1.75 | 0 | 4 | `/vs/*` linked from `/vs` and some alternatives, but `/vs` itself is orphaned. |
| Blog posts | 2 | 1.0 | 0 | 2 | Posts only linked from `/blog`; `/blog` is orphaned. |

### Highest ROI diagnosis

1. **Category SEO pages are functionally orphaned.** `/ai-*` and `/synthetic-media-detection-api` pages are in sitemap but not linked from homepage, docs, use cases, or footer.
2. **New comparison/blog hubs are orphaned.** `/vs` and `/blog` are live but not linked from nav/footer/core pages.
3. **Use-case pages are too flat.** `/use-cases` links to all pages, but individual use-case pages do not link to sibling/parent category pages, relevant docs, pricing, integrations, or modality pages.
4. **Developer conversion path is under-linked.** `/examples`, `/mcp`, `/integrations/openai-actions`, `/integrations/langgraph`, `/docs/errors`, and `/what-we-detect` should be reached contextually from docs, for-agents, homepage, and integration pages.
5. **Footer is too shallow for a 76-page site.** Footer should become a structured mini-sitemap with product/docs/use-case/distribution/trust columns, not one dot-separated line.
6. **Need automated graph guardrails.** Current tests verify sitemap/discovery presence but not internal reachability or minimum inlink coverage.

---

## Target internal-link architecture

### Global nav — keep focused, add only one dropdown-equivalent cluster if simple

Do **not** add every SEO page to nav. Recommended primary nav:

- Docs → `/docs`
- Use cases → `/use-cases`
- Evals → `/evals`
- Comparisons → `/vs`
- Pricing → `/pricing`
- Account CTA → `/account`

Move `/methodology` and `/for-agents` into footer and contextual cards unless there is room. If keeping current nav labels is preferred, at minimum add `/use-cases` and `/vs`; add `/blog` only in footer.

### Footer — structured mini-sitemap

Replace single-line footer links in `src/y2k.ts` with columns:

1. Product
   - `/` — AI output linter
   - `/what-we-detect` — What we detect
   - `/how-it-works` — How it works
   - `/methodology` — Methodology
   - `/pricing` — Pricing
2. Developers
   - `/docs` — Docs
   - `/docs/errors` — Error handling
   - `/examples` — Examples
   - `/openapi.json` — OpenAPI
   - `/mcp` — MCP
   - `/integrations/openai-actions` — OpenAI Actions
   - `/integrations/langgraph` — LangGraph
3. Use cases
   - `/use-cases` — Use cases
   - `/use-cases/publishing-pipeline-quality-gate` — Pre-publish QA
   - `/use-cases/training-data-curation` — Training-data hygiene
   - `/use-cases/audio-phone-snippet-triage` — Audio UGC triage
   - `/use-cases/image-social-media-authenticity-check` — Image authenticity
4. Compare
   - `/alternatives` — Alternatives
   - `/vs` — Comparisons
   - `/vs/gptzero` — GPTZero vs VeracityAPI
   - `/vs/originality-ai` — Originality.ai vs VeracityAPI
   - `/vs/copyleaks` — Copyleaks vs VeracityAPI
   - `/evals/2026-benchmark` — Benchmark status
5. Trust
   - `/evals` — Evals
   - `/status` — Status
   - `/changelog` — Changelog
   - `/privacy` — Privacy
   - `/security` — Security
   - `/subprocessors` — Subprocessors
   - `/terms` — Terms
   - `/blog` — Blog

### Hub pages

Create or strengthen these hub relationships:

- Homepage should link to:
  - `/what-we-detect`, `/docs/errors`, `/examples`, `/mcp`, `/vs`, `/blog`
  - three category pages: `/ai-detection-api`, `/ai-image-detection-api`, `/ai-audio-detection-api`
- `/docs` should link to:
  - `/what-we-detect`, `/examples`, `/mcp`, `/integrations/openai-actions`, `/integrations/langgraph`, `/docs/errors`, `/pricing`, `/for-agents`
- `/for-agents` should link to:
  - `/examples`, `/mcp`, `/integrations/claude`, `/integrations/openai-actions`, `/integrations/langgraph`, `/use-cases`, `/what-we-detect`, `/vs`
- `/what-we-detect` should link to modality pages:
  - Text: `/ai-detection-api`, `/ai-content-detector-api`, `/ai-written-content-detector`, `/ai-generated-text-detector`
  - Image: `/synthetic-media-detection-api`, `/ai-image-detection-api`
  - Audio: `/ai-audio-detection-api`
- `/use-cases` should group by job/modality and link out to related category pages and docs.
- Every `/use-cases/:slug` page should include a related-link block with:
  - parent `/use-cases`
  - relevant category page by modality/job
  - relevant integration/example/docs page
  - 2 sibling use cases
- Every category SEO page should include:
  - relevant `/what-we-detect` anchor/context
  - 3 related use cases
  - docs/examples/pricing links
  - related category siblings
- `/alternatives` and `/vs` should cross-link to each other.
- `/alternatives/deepmedia` should link to `/vs/hive`, and `/vs/hive` should link back to `/alternatives/deepmedia` where safe.
- Blog posts should include related links to benchmark/comparison/docs/category pages and link to `/blog`.

---

## Implementation plan

### Task 1: Add a typed internal-link registry

**Objective:** Centralize page groups and related-link rules so we do not hand-maintain random links across giant HTML strings.

**Files:**
- Create: `src/internalLinks.ts`
- Test: `test/internalLinks.test.ts`

### Task 2: Upgrade global nav and footer

**Objective:** Fix the biggest graph gap without changing page-specific body copy.

**Files:**
- Modify: `src/y2k.ts`
- Test: `test/internalLinks.test.ts`

### Task 3: Add homepage contextual link modules

**Objective:** Make the homepage pass authority to the most important SEO and conversion pages.

**Files:**
- Modify: `src/site.ts`
- Test: `test/internalLinks.test.ts` or `test/productTrust.test.ts`

### Task 4: Add related-link block to `layout()` pages

**Objective:** Give core pages, blog posts, comparison pages, docs pages, and generated page renderers a reusable related-link slot.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/internalLinks.ts`
- Test: `test/internalLinks.test.ts`

### Task 5: Add related links to use-case pages

**Objective:** Turn 29 flat use-case leaves into topical clusters.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/internalLinks.ts`
- Test: `test/internalLinks.test.ts`

### Task 6: Add links to category/distribution pages

**Objective:** Fix orphaned category SEO pages and make them useful entrances into the product.

**Files:**
- Modify: `src/distribution.ts`
- Modify: `src/internalLinks.ts`
- Test: `test/agentDistribution.test.ts`
- Test: `test/internalLinks.test.ts`

### Task 7: Add automated internal-link graph tests

**Objective:** Prevent future orphan pages as sitemap grows.

**Files:**
- Create/modify: `test/internalLinks.test.ts`

### Task 8: Run verification and deploy

**Objective:** Ship safely with live evidence.

**Commands:**

```bash
cd /Users/psy/projects/veracityapi
git diff --check
npm test -- --run test/internalLinks.test.ts test/productTrust.test.ts test/agentDistribution.test.ts test/benchmarkComparisonPages.test.ts
npm test -- --run
npx tsc --noEmit
npx wrangler deploy --dry-run
npx wrangler deploy
```

**Live smoke crawl:**

After deploy, crawl production sitemap again and report:

- sitemap URL count
- status counts
- zero-inlink page count, target `0`
- category SEO min/avg inbound link count
- use-case min/avg inbound link count
- key pages and status

**Visual QA:** homepage, `/what-we-detect`, `/use-cases/publishing-pipeline-quality-gate`, `/ai-detection-api`, `/vs`.

---

## Priority order

### P0 — must ship first

1. Structured footer links.
2. Add `/use-cases` and `/vs` to nav or highly visible footer.
3. Homepage contextual links to category/docs/examples/comparison/blog hubs.
4. Internal-link graph regression test.

### P1 — topical clusters

1. Related links for `/what-we-detect` and docs pages.
2. Related links for use-case pages by modality/job.
3. Related links for category SEO pages.

### P2 — polish

1. Blog related links and next/previous posts.
2. Alternatives/comparison cross-links.
3. Better anchor text variance.
4. BreadcrumbList schema if simple.

---

## Guardrails

- Do not index `/vs/*` benchmark/comparison pages until benchmark artifacts are frozen; keep `X-Robots-Tag: noindex, follow` for those routes.
- Do not create fake benchmark or competitor claims.
- Do not link to unpublished alternatives: `/alternatives/reality-defender`, `/alternatives/resemble-detect`.
- Do not bloat primary nav beyond what fits mobile.
- Prefer contextual cards over giant keyword-stuffed link lists.
- Preserve current modality wording:
  - Text: AI slop / slop signals / shippability.
  - Image/audio: AI forgeries / synthetic media / tampering / provenance risk.
- Keep the boundary visible: workflow signals, not forensic proof.

---

## Success metrics

Before implementation:

- Zero-inlink sitemap pages: **17**
- Category SEO avg inlinks: **0.0**
- Use-case avg inlinks: **1.31**
- `/vs` inlinks: **0**
- `/blog` inlinks: **0**
- `/what-we-detect` inlinks: **1**

After implementation target:

- Zero-inlink sitemap pages: **0**
- Category SEO pages: **>=3** inlinks each
- Use-case pages: **>=2** inlinks each, ideally **>=3** for top money use cases
- `/vs`: **>=5** inlinks
- `/blog`: **>=3** inlinks
- `/what-we-detect`: **>=5** inlinks
- All sitemap URLs still return 200
- No new broken internal links
