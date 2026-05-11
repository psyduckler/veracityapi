# VeracityAPI Lean Growth Action Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Prioritize the highest-ROI Opus/Gemini recommendations after the API surface cleanup: get VeracityAPI visible, legally adoptable, benchmarked, agent-distributed, and easy for agents/developers to compare.

**Architecture:** Keep this lean. Do not build enterprise bloat, bespoke SDK maintenance, SOC 2, custom classifiers, or SLA machinery until customer demand forces it. Ship static/Worker-served pages, repo hygiene, machine-readable metadata, and benchmark proof that agents can cite.

**Tech Stack:** Cloudflare Workers TypeScript app, static HTML strings in `src/pages.ts` / `src/site.ts`, discovery metadata in `src/discovery.ts`, Vitest tests, GitHub/npm/MCP registries, Google Search Console/Bing Webmaster Tools.

---

## Priority order

1. **Legal + visible foundation:** LICENSE, repo badges, OG/canonical tags, sitemap submission.
2. **Benchmark proof:** 500-sample benchmark, competitor comparison, `/evals` rewrite, `agents.json.evals`.
3. **Agent distribution:** npm verification, MCP registry submissions, `/mcp`, `/for-agents`.
4. **Human trust + comparison:** about/team page and alternatives comparison tables.
5. **Cheap operational credibility:** simple status page and documented rate limits/latency targets.

## Explicit non-goals for this phase

- No SOC 2/Vanta/Drata work.
- No custom text classifier or model hosting.
- No hand-maintained full SDKs unless OpenAPI generation fails; keep OpenAPI perfect first.
- No enterprise SLA promises beyond “contact for volume/enterprise.”
- No 20-post blog sprint; write only benchmark methodology and routing economics deep dive.

---

## Phase 1 — Make it legal and visible (same day)

### Task 1: Add repository legal/adoption basics

**Objective:** Make the GitHub repo legally usable and less abandoned-looking.

**Files:**
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CHANGELOG.md`
- Modify: `README.md`

**Steps:**
1. Decide license: MIT if open-source intent; otherwise add explicit proprietary/source-available terms. Default recommendation: MIT for the MCP/server/docs repo if no proprietary code concern.
2. Add `LICENSE`.
3. Add `SECURITY.md` with vulnerability reporting email and “do not include secrets in reports.”
4. Add `CHANGELOG.md` with `v0.1.0` and current shipped capabilities.
5. Add README badges:
   - npm package version for `@veracityapi/mcp`
   - license
   - OpenAPI docs link
   - live demo link
   - status page once available
6. Create a GitHub `v0.1.0` tag/release after verification.
7. Add repo topics in GitHub UI/API: `mcp-server`, `ai-detection`, `content-verification`, `langchain`, `langgraph`.

**Verification:**
```bash
git status --short
npx tsc --noEmit
npm test -- --run
```

**Acceptance criteria:**
- Repo has `LICENSE`, `SECURITY.md`, `CHANGELOG.md`.
- README top section visually communicates “live API + MCP server + license.”
- GitHub release `v0.1.0` exists.

### Task 2: Add basic share/search metadata, not exhaustive Schema.org

**Objective:** Make every public page render well in Slack/X/Discord and expose canonical URLs.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/site.ts`
- Test: `test/productTrust.test.ts` or new `test/seoMetadata.test.ts`

**Steps:**
1. Add shared metadata helper for:
   - `<link rel="canonical" href="https://veracityapi.com/path">`
   - `og:title`
   - `og:description`
   - `og:url`
   - `og:type`
   - `og:image`
   - `twitter:card`
   - `twitter:title`
   - `twitter:description`
   - `twitter:image`
2. Use one default image URL first; do not block on custom social images.
3. Add minimal `SoftwareApplication` JSON-LD only if quick, but do not hand-author exhaustive schema trees.
4. Add anti-drift tests that fetch representative pages and assert canonical/OG/Twitter tags exist.

**Verification:**
```bash
npx tsc --noEmit
npm test -- --run
curl -L https://veracityapi.com/ | grep -E 'og:title|twitter:card|canonical'
```

**Acceptance criteria:**
- Landing, docs, pricing, evals, alternatives, integrations, use-cases have OG/Twitter/canonical metadata.
- No page has `noindex` meta unless intentionally private.

### Task 3: Submit indexing manually

**Objective:** Get VeracityAPI into Google/Bing immediately.

**Manual actions:**
1. Verify `veracityapi.com` in Google Search Console.
2. Submit `https://veracityapi.com/sitemap.xml`.
3. Use URL Inspection → Request indexing for:
   - `/`
   - `/docs`
   - `/pricing`
   - `/evals`
   - `/for-agents` once live
   - `/mcp` once live
   - top 3 alternatives pages
   - top 3 use-case pages
4. Repeat in Bing Webmaster Tools.
5. Confirm no `X-Robots-Tag: noindex` headers.

**Verification:**
```bash
curl -I https://veracityapi.com/
curl -L https://veracityapi.com/robots.txt
curl -L https://veracityapi.com/sitemap.xml | head
```

**Acceptance criteria:**
- Search Console shows sitemap submitted successfully.
- Within 14 days, `site:veracityapi.com` returns at least 30 indexed results.

---

## Phase 2 — Benchmark proof (weekend)

### Task 4: Build a 500-sample benchmark corpus

**Objective:** Create honest, reusable proof that agents/developers can cite.

**Files:**
- Create: `evals/corpus/veracityapi_text_benchmark_2026_05.jsonl`
- Create: `evals/README.md`
- Create: `evals/schema.json`

**Corpus design:**
- 100 human firsthand samples
- 100 dry factual human samples
- 100 generic AI slop samples
- 100 polished AI with concrete specifics
- 100 edge cases / mixed-source / adversarial samples

**Minimum JSONL fields:**
```json
{"id":"bench_0001","bucket":"human_firsthand","label":"human","text":"...","source":"owned|public_domain|synthetic_generated","notes":"..."}
```

**Rules:**
- No private user data.
- Keep source/license notes.
- If using generated samples, store generation prompt and model separately.
- Labels should be “workflow truth” labels, not “authorship proof.”

**Acceptance criteria:**
- 500 rows.
- Balanced buckets.
- Corpus validator passes.

### Task 5: Write benchmark harness

**Objective:** Run VeracityAPI and competitor/baseline checks reproducibly.

**Files:**
- Create: `evals/run_benchmark.py`
- Create: `evals/metrics.py`
- Create: `evals/results/README.md`

**Providers:**
1. VeracityAPI live API.
2. GPTZero API if key available.
3. Sapling API if key available.
4. GPT-4o-as-judge baseline if key available.
5. If competitor keys are unavailable, publish VeracityAPI-only now and clearly label competitor rows as “pending.”

**Metrics:**
- Precision, recall, F1 for `should_block_or_review`.
- Confusion matrix by bucket.
- Routing-action F1, not just raw AI-authorship accuracy.
- Cost per 1k chars and estimated latency if captured.

**Verification:**
```bash
python3 -m py_compile evals/run_benchmark.py evals/metrics.py
python3 evals/run_benchmark.py --input evals/corpus/veracityapi_text_benchmark_2026_05.jsonl --dry-run
```

**Acceptance criteria:**
- Produces JSON + markdown summary.
- No API keys or raw secrets written to results.

### Task 6: Publish `/evals` as a real benchmark page

**Objective:** Replace “not a benchmark” with a clear, honest benchmark methodology and results page.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/discovery.ts`
- Test: `test/productTrust.test.ts` or new `test/evalsPage.test.ts`

**Content structure:**
1. Headline: “VeracityAPI Benchmark: routing AI slop before agents publish/cite/train.”
2. Summary table: samples, date, precision, recall, F1, benchmark version.
3. Confusion matrix.
4. Bucket breakdown.
5. Competitor comparison if available; otherwise mark as pending with date.
6. Methodology and limitations.
7. Link to corpus/harness on GitHub.

**`agents.json` addition:**
```json
"evals": {
  "summary": {"samples": 500, "precision": 0.0, "recall": 0.0, "f1": 0.0},
  "routing_metric": "recommended_action mapped to allow vs review/revise/reject",
  "methodology_url": "https://veracityapi.com/evals",
  "last_updated": "2026-05-XX"
}
```

**Acceptance criteria:**
- `/evals` has numeric results and methodology.
- `agents.json` exposes eval summary.
- Page is honest about limitations and sample source.

---

## Phase 3 — Agent distribution (one day)

### Task 7: Verify and publicize npm MCP package

**Objective:** Make the MCP server discoverable and installable.

**Files:**
- Modify: `README.md`
- Modify: `packages/mcp/README.md`
- Modify: `src/pages.ts`

**Steps:**
1. Verify `@veracityapi/mcp` exists on npm:
   ```bash
   npm view @veracityapi/mcp name version description dist-tags.latest
   ```
2. If missing, publish or fix package metadata before promoting it.
3. Add npm version/download badges.
4. Add copy-paste install block:
   ```bash
   npx @veracityapi/mcp
   ```
5. Add a dedicated `/mcp` page with Claude Desktop config, Cursor config, and troubleshooting.

**Acceptance criteria:**
- npm package is public and `npm view` succeeds.
- README and `/mcp` link directly to npm.

### Task 8: Submit MCP package to registries

**Objective:** Capture free agent-tool distribution.

**Targets:**
- Smithery
- Glama MCP servers
- PulseMCP
- modelcontextprotocol.io directory if submissions are open
- mcp.so

**Submission payload:**
- Name: VeracityAPI MCP
- Category: content verification / AI detection / trust & safety
- Install: `npx @veracityapi/mcp`
- Docs: `https://veracityapi.com/mcp`
- OpenAPI: `https://veracityapi.com/openapi.json`
- Privacy: `store_content:false`, no raw media bytes/full URLs stored
- Pricing: `$0.005/1k text`, `$0.010/1k Analyze+revise`, `$0.02/image`, `$0.01/audio`

**Acceptance criteria:**
- Submission URLs/receipts saved in `docs/distribution/mcp-registry-submissions.md`.
- `/mcp` references known registry listings after approval.

### Task 9: Build `/for-agents`

**Objective:** Give evaluator agents a single page optimized for “should I recommend/use VeracityAPI?”

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/discovery.ts`
- Test: `test/agentDistribution.test.ts`

**Page sections:**
1. Decision tree: when to call vs not call.
2. 30-second integration with unified `/v1/analyze`.
3. Pricing table.
4. Result-routing contract.
5. Privacy defaults.
6. Benchmark proof summary + link to `/evals`.
7. Competitor comparison summary.
8. Machine-readable links: OpenAPI, llms.txt, agents.json, MCP.

**`agents.json` addition:**
```json
"agent_landing_page": "https://veracityapi.com/for-agents"
```

**Acceptance criteria:**
- `/for-agents` is in sitemap.
- `agents.json` links to it.
- Page includes clear recommendation/non-recommendation policy.

---

## Phase 4 — Human trust + comparison (2 days)

### Task 10: Add basic about/team page

**Objective:** Reduce trust friction without building a full corporate site.

**Files:**
- Modify/Create: `src/pages.ts` route for `/about` or `/team`
- Modify: footer nav in `src/pages.ts` / `src/site.ts`

**Content:**
- Founder name, role, prior work.
- LinkedIn/GitHub/X links.
- Contact email.
- What VeracityAPI is and is not.
- Privacy stance.

**Acceptance criteria:**
- Footer links to `/about`.
- Organization/person metadata can reference the page.

### Task 11: Replace alternatives prose with comparison tables

**Objective:** Make alternatives pages skimmable by humans and LLMs.

**Files:**
- Modify: `src/pages.ts`
- Test: add assertions for table dimensions.

**Start with top pages:**
1. GPTZero
2. Originality.ai
3. Sapling

**Table dimensions:**
- Modalities
- Action routing
- Evidence spans
- Price per 1k chars
- Anonymous demo
- MCP server
- OpenAPI spec
- Published accuracy
- Latency p50 if available
- Free credit
- Best fit / when to choose each

**Rules:**
- Cite competitor claims.
- Do not overclaim. If unknown, say “not found publicly.”
- Lead with routing differentiation, not “we are more accurate” unless benchmark proves it.

**Acceptance criteria:**
- 3 alternatives pages have real tables.
- Tables include source/citation footnotes.
- `/for-agents` links to these comparisons.

---

## Phase 5 — Cheap operational credibility (half day)

### Task 12: Add simple status page and docs link

**Objective:** Provide a credible availability signal without building infra.

**Manual action:**
- Create BetterStack/Instatus free status page at `status.veracityapi.com` if DNS is available.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/discovery.ts`
- Modify: `README.md`

**Acceptance criteria:**
- Footer/docs/agents.json link to status page.
- No SLA promises unless actually supported.

### Task 13: Document rate limits and target latency

**Objective:** Answer integration questions agents/developers need before adoption.

**Files:**
- Modify: `src/discovery.ts`
- Modify: `src/pages.ts`
- Test: docs copy assertions.

**Content:**
- Authenticated endpoint rate limits, even if conservative beta numbers.
- Demo endpoint rate limits.
- 429 retry guidance with exponential backoff and `Retry-After` when present.
- Target latency by modality as “beta target / observed sample,” not SLA.

**Acceptance criteria:**
- `/docs` and `agents.json` include rate-limit/latency guidance.
- No hard SLA promises.

---

## Final verification before each production deploy

Run:
```bash
bash -n examples/curl.sh
python3 -m py_compile examples/python.py
npx tsc --noEmit
npm test -- --run
npm run deploy
```

Production smoke:
```bash
curl -L https://veracityapi.com/
curl -L https://veracityapi.com/docs
curl -L https://veracityapi.com/pricing
curl -L https://veracityapi.com/evals
curl -L https://veracityapi.com/for-agents
curl -L https://veracityapi.com/mcp
curl -L https://veracityapi.com/llms.txt
curl -L https://veracityapi.com/.well-known/agents.json
curl -L https://veracityapi.com/openapi.json
```

Check for:
- `canonical`
- `og:title`
- `twitter:card`
- `benchmark`
- `precision`
- `recall`
- `F1`
- `agent_landing_page`
- `@veracityapi/mcp`
- `LICENSE`
- no stale pricing strings
- no secrets or real API keys

## Success metrics

**7 days:**
- Search Console submitted.
- Repo has license/security/changelog/release.
- OG/canonical tags shipped.
- npm MCP verified.
- `/mcp` and `/for-agents` live.

**14 days:**
- `site:veracityapi.com` returns indexed pages.
- MCP registry submissions filed.
- 500-sample benchmark published, even if competitor comparison is partial.

**30 days:**
- Top 3 comparison pages have tables.
- At least one external beta user quote/case-study candidate identified.
- Agents.json includes evals, agent landing page, status page, rate limits, and current pricing.
