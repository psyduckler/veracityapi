# VeracityAPI External Benchmarks + Comparison Pages Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not publish comparison pages with benchmark numbers until the benchmark run is complete, frozen, and cited.

**Goal:** Ship a defensible benchmark program and high-intent comparison-page cluster that turns competitor-search traffic into API signups without making unsupported detector/forensic claims.

**Architecture:** Split this into two deliverables: a separate reproducible `veracity-bench` benchmark repo for adapters/corpus/metrics, and the existing Cloudflare Worker site for published pages, sitemap/discovery updates, blog launch wrapper, and lead capture. Build draft comparison pages behind honest placeholders, but publish/index them only after benchmark artifacts are frozen.

**Tech Stack:** TypeScript Cloudflare Worker + D1 for `veracityapi`; Python or TypeScript benchmark runner in separate `veracity-bench`; CSV/JSONL artifacts; Vitest/TypeScript checks; Wrangler deploy; live production smoke checks.

---

## Executive call: what I would change from Opus' plan

Opus' direction is right, but I would tighten scope and sequencing:

1. **Do not start with 1,500 multimodal samples.** Start with a publication-grade text benchmark first: 1,000 text samples plus a smaller, clearly labeled image/audio pilot. Multimodal competitor APIs and provenance/licensing will create drag. Text comparison pages are the immediate commercial wedge.
2. **Ship `/evals/2026-benchmark` only after a ToS/legal gate.** Some vendors restrict benchmark publication. The plan must include a vendor-claim matrix and fallback language before spending API money.
3. **Separate benchmark truth from marketing pages.** Bench repo owns raw outputs, metrics, prompts, thresholds, and reproducibility. Website consumes frozen JSON summaries only.
4. **Use `/vs/*` for buyer pages, keep `/alternatives/*` as existing SEO compatibility.** Add canonical `/vs/originality-ai`, `/vs/gptzero`, `/vs/hive`, `/vs/copyleaks`; keep current `/alternatives/*` pages linked or redirected only when safe.
5. **Blog stub belongs in this sprint.** Two launch posts are not optional if the benchmark is the narrative hook.
6. **Publish honest placeholders only internally.** Draft pages can exist locally, but production pages should either be noindex or not routed until numbers are frozen.

---

## Current repo facts from inspection

- Current Worker routes live in `src/index.ts` via `pageRoutes`.
- Current evals page is `evalsHtml()` in `src/pages.ts` and already states external comparator slots are planned.
- Sitemap source is `sitemapXml()` in `src/discovery.ts`.
- Existing distribution/alternative pages are in `src/distribution.ts` and `src/pages.ts`.
- Existing tests for evals, alternatives, sitemap, and discovery are primarily:
  - `test/productTrust.test.ts`
  - `test/agentDistribution.test.ts`
- The worktree currently has unrelated untracked files and the checked branch was `feat/video-analysis-mvp` during planning. Implementation must begin with an explicit branch/status check and must not accidentally commit unrelated untracked files.

---

## Scope and non-scope

### P0 launch scope

**Benchmark publication:**
- New `/evals/2026-benchmark` page.
- Frozen benchmark summary JSON imported into site code.
- Existing `/evals` links forward but remains v0.1 history.
- Public methodology, prompts, thresholds, model/vendor versions, date, and limitations.
- At least 2 named Veracity weaknesses.
- Benchmark repo public or ready-to-public with raw-response redaction and corpus licensing checks.

**Competitor pages:**
- `/vs/` index.
- `/vs/originality-ai`.
- `/vs/gptzero`.
- `/vs/hive`.
- `/vs/copyleaks`.
- Existing `/alternatives/*` pages link to or summarize the deeper `/vs/*` pages.
- Sitemap, `llms.txt`, `agents.json`, and internal nav/discovery updated.

**Launch wrapper:**
- `/blog` index.
- `/blog/benchmarking-ai-detectors-routing-f1`.
- `/blog/not-an-ai-detector-routing-linter`.
- Announcement drafts stored in `docs/launch/`.

### Explicitly out of scope for P0

- Enterprise procurement pages beyond existing privacy/security/subprocessors.
- Full raw corpus publication for licensed third-party text.
- Courtroom/forensic claims.
- Claims that Veracity outperforms all competitors unless benchmark numbers prove it.
- Reality Defender and Sapling pages unless ToS + benchmark access are already clean.
- Paid ad landing pages.

---

## Decisions needed before paid benchmark run

1. **Budget approval:** allocate up to `$500` one-time for vendor API runs and sample generation.
2. **Vendor ToS approval:** for each vendor, mark `publish_allowed`, `publish_restricted`, or `unknown`. Do not run/publish restricted benchmarks under vendor names.
3. **Credential location:** store vendor keys in local secret files or platform secret manager; never in repo, prompts, Slack, docs, or memory.
4. **Corpus publication policy:** publish sample IDs, labels, provenance, source URLs, and hashes; publish raw text only where licensing allows.
5. **Benchmark repo location:** recommended `/Users/psy/projects/veracity-bench`, separate GitHub repo `psyduckler/veracity-bench`.

---

## Milestones

### Milestone 0 — Preflight and branch hygiene

**Acceptance criteria:** implementation starts from clean, intentional Git scope; unrelated untracked files are not committed.

Steps:
1. Run `git status --short && git branch --show-current` in `/Users/psy/projects/veracityapi`.
2. Create a dedicated branch such as `feat/benchmarks-comparison-pages` from the desired base branch.
3. If current branch is not the intended base, stop and switch intentionally.
4. Create or verify separate benchmark repo path `/Users/psy/projects/veracity-bench`.
5. Add `.gitignore` coverage for `.env`, `.keys`, raw vendor outputs if private, and any corpus cache.

---

## Workstream A — Benchmark repo and reproducible metrics

### Task A1: Create benchmark repo skeleton

**Objective:** Establish a separate reproducibility surface that can later be made public.

**Files:**
- Create: `/Users/psy/projects/veracity-bench/README.md`
- Create: `/Users/psy/projects/veracity-bench/pyproject.toml` or `package.json`
- Create: `/Users/psy/projects/veracity-bench/.gitignore`
- Create: `/Users/psy/projects/veracity-bench/src/veracity_bench/` or `/src/`
- Create: `/Users/psy/projects/veracity-bench/data/README.md`
- Create: `/Users/psy/projects/veracity-bench/results/README.md`

**Implementation notes:**
Use Python if corpus/metrics work is easier with `pandas`, `scikit-learn`, and `pydantic`; use TypeScript only if adapter reuse with the API SDK matters more. My recommendation: Python benchmark runner, because metrics/corpus handling is simpler.

**Verification:**
- `python -m pytest` or `npm test` passes with one placeholder test.
- README explains no secrets and no unlicensed raw text are committed.

### Task A2: Define canonical sample schema

**Objective:** Prevent benchmark slop by making provenance and labels mandatory.

**Files:**
- Create: `schemas/sample.schema.json`
- Create: `src/veracity_bench/schema.py`
- Create: `tests/test_schema.py`

**Required fields:**
```json
{
  "sample_id": "txt_publish_generic_0001",
  "modality": "text|image|audio",
  "domain": "publishing|ecommerce_review|rag_source|social_caption|customer_support|marketplace_listing|kdp_chapter|media_ugc",
  "content_ref": "local_path_or_url_or_hash_ref",
  "raw_content_allowed_public": false,
  "source_url": "https://...",
  "source_license": "public_domain|cc_by|owned|generated|linked_only|unknown",
  "creation_method": "human_firsthand|human_dry_factual|llm_generic|llm_polished|mixed_adversarial|reject_tier|real_photo|diffusion|inpainted|authentic_voice|synthetic_voice",
  "authorship_label": "human|synthetic|mixed|unknown",
  "expected_binary_flag": true,
  "expected_routing_action": "allow|revise|human_review|reject",
  "label_rationale": "short human-readable rationale",
  "provenance_notes": "why this sample is allowed in the corpus"
}
```

**Verification:**
- Schema rejects samples missing `source`, `creation_method`, or `expected_routing_action`.
- Schema rejects samples with `source_license: unknown` unless `raw_content_allowed_public=false`.

### Task A3: Implement adapter contract

**Objective:** Give every vendor the same measurable output shape.

**Files:**
- Create: `src/veracity_bench/adapters/base.py`
- Create: `src/veracity_bench/adapters/veracity.py`
- Create: `src/veracity_bench/adapters/gpt4o_judge.py`
- Create: `tests/test_adapters_contract.py`

**Adapter output:**
```json
{
  "sample_id": "...",
  "vendor": "veracity|gptzero|sapling|originality|hive|copyleaks|gpt4o_judge",
  "raw_response_ref": "results/raw/vendor/sample_id.json",
  "normalized_score": 0.0,
  "binary_label": "flag|pass",
  "routed_action": "allow|revise|human_review|reject",
  "latency_ms": 1234,
  "cost_usd": 0.005,
  "model_or_api_version": "...",
  "run_id": "2026-05-benchmark-v1"
}
```

**Routing mapping for competitor probabilities:**
- `< 0.20` → `allow`
- `0.20–0.50` → `revise`
- `0.50–0.85` → `human_review`
- `>= 0.85` → `reject`

**Verification:**
- Unit tests cover threshold boundaries.
- Adapter contract test can run against fake responses with no network.

### Task A4: Vendor ToS and claim matrix gate

**Objective:** Avoid publishing a benchmark that violates vendor terms or creates legal risk.

**Files:**
- Create: `docs/vendor-claim-matrix.md`
- Create: `data/vendors.json`

**Required matrix columns:**
- Vendor
- API/docs URL
- Pricing URL
- Benchmark/publication ToS status
- Allowed claims
- Disallowed/uncertain claims
- Last checked date
- Evidence link
- Decision: `include_named`, `include_anonymized`, `exclude`

**Verification:**
- No vendor adapter can be marked `publishable=true` without a filled matrix row.
- Plan includes fallback labels such as `Commercial detector A` if named publication is not allowed.

### Task A5: Build text corpus v1

**Objective:** Build the commercial-ICP corpus that supports the first benchmark publication.

**Target:** 1,000 text samples:
- 200 firsthand human writing.
- 200 dry factual human.
- 200 generic LLM output.
- 200 polished/specific LLM output.
- 150 mixed/adversarial.
- 50 reject-tier hallucinated/fabricated/false-provenance samples.

**Important adjustment:** prioritize domains aligned with Veracity ICP: publishing, product reviews, RAG/source pages, social captions, marketplace listings, customer support, KDP/manuscript excerpts. Avoid academic essays except as a small negative-control slice.

**Files:**
- Create: `data/text/corpus_index.jsonl`
- Create: `data/text/raw/README.md`
- Create: `scripts/build_text_corpus.py`
- Create: `scripts/validate_corpus.py`

**Verification:**
- `scripts/validate_corpus.py` reports exactly 1,000 text samples and balanced slice counts.
- No sample with missing provenance enters the corpus.
- Raw text publication status is explicit per sample.

### Task A6: Build image/audio pilot corpus

**Objective:** Support multimodal credibility without blocking the text/comparison launch on slow media provenance.

**Target P0 pilot:**
- 120 images: 40 real/provenanced, 40 generated, 40 mixed/edited.
- 80 audio: 40 authentic/provenanced, 40 synthetic.

**P1 expansion target:** the Opus 300 image / 200 audio corpus after the text benchmark and first comparison pages are live.

**Verification:**
- Media index has URLs or local references, source license/provenance, and no private media leakage.
- Image/audio benchmark pages label this as a pilot unless/until expanded.

### Task A7: Implement and dry-run adapters

**Objective:** Validate cost, latency, response parsing, and normalized-score mapping before the full paid run.

**Adapters P0:**
- VeracityAPI.
- GPTZero.
- Originality.ai.
- Copyleaks.
- GPT-4o judge.
- Hive if ToS/access supports media benchmark.

**Adapters P1:**
- Sapling.
- Reality Defender.

**Verification:**
- Dry run on 10 samples per modality/vendor.
- Cost projection generated before full run.
- Raw responses saved once with run IDs.

### Task A8: Execute frozen benchmark run

**Objective:** Produce immutable run artifacts for publication.

**Files:**
- Create: `results/2026-05/run_manifest.json`
- Create: `results/2026-05/normalized_results.jsonl`
- Create: `results/2026-05/metrics.json`
- Create: `results/2026-05/confusion_matrices/*.csv`
- Create: `results/2026-05/weaknesses.md`

**Rules:**
- Never overwrite raw results for a sample/vendor/run.
- Re-runs get a new `run_id`.
- Publish model versions and run dates.

**Verification:**
- Metrics include binary F1, AUROC where probability scores exist, routing macro-F1, p50/p95 latency, estimated/actual cost, and false-positive rate on dry-factual-human.
- Veracity weaknesses are named explicitly.

---

## Workstream B — Website benchmark publication

### Task B1: Add frozen benchmark data module

**Objective:** Keep website pages deterministic and testable.

**Files:**
- Create: `/Users/psy/projects/veracityapi/src/benchmark2026.ts`
- Test: `test/productTrust.test.ts`

**Data shape:**
```ts
export const BENCHMARK_2026 = {
  runId: "2026-05-benchmark-v1",
  publishedAt: "2026-05-XX",
  textSampleCount: 1000,
  imageSampleCount: 120,
  audioSampleCount: 80,
  vendors: [...],
  metrics: {...},
  weaknesses: [...],
  methodologyUrl: "https://github.com/psyduckler/veracity-bench"
} as const;
```

**Verification:**
- Tests assert page copy uses values from this module, not hardcoded random numbers.

### Task B2: Add `/evals/2026-benchmark`

**Objective:** Publish the defensible benchmark page without overwriting existing `/evals` history.

**Files:**
- Modify: `src/pages.ts` — add `benchmark2026Html()`.
- Modify: `src/index.ts` — route `/evals/2026-benchmark`.
- Modify: `src/discovery.ts` — add to sitemap/llms/agents if relevant.
- Test: `test/productTrust.test.ts`.

**Page sections:**
1. Hero: benchmark date, run ID, no-forensic disclaimer.
2. Corpus stats.
3. Metric A: binary flag-for-attention results.
4. Metric B: routing macro-F1 results with caveat.
5. False-positive slice: dry factual human.
6. Latency/cost table.
7. Per-vendor confusion matrices.
8. Where Veracity loses.
9. Reproducibility kit.
10. Submit an adversarial sample CTA.
11. Versioning/re-run policy.

**Verification:**
- Page contains `Where Veracity loses`.
- Page contains `competitors were not designed for routing` caveat.
- Page links to the benchmark repo and existing `/evals`.
- `HEAD` and `GET` return 200.

### Task B3: Update existing `/evals`

**Objective:** Pay the current public IOU while preserving v0.1 context.

**Files:**
- Modify: `src/pages.ts` `evalsHtml()`.
- Modify: tests that expect current scaffold.

**Acceptance criteria:**
- Existing v0.1 seed benchmark remains visible.
- External comparator placeholder is replaced with a forward link if benchmark is published, or a clear status block if not.
- No stale `not run without keys` language remains after publication.

---

## Workstream C — Comparison pages

### Task C1: Define comparison page data model

**Objective:** Avoid four giant copy-pasted pages and keep claims reviewable.

**Files:**
- Create: `src/comparisons.ts`
- Test: `test/comparisonPages.test.ts`

**Data fields:**
```ts
{
  slug: "originality-ai",
  competitorName: "Originality.ai",
  titleQualifier: "Publishing, SEO, and agent routing",
  lastUpdated: "2026-05-XX",
  competitorHomepage: "https://...",
  competitorDocs: "https://...",
  competitorPricing: "https://...",
  bestForCompetitor: ["...", "..."],
  bestForVeracity: ["...", "..."],
  modalityCoverage: {...},
  outputDesign: {...},
  pricingExamples: [...],
  migrationNotes: [...],
  faqs: [...],
  benchmarkVendorKey: "originality"
}
```

**Verification:**
- Every competitor has external source URLs.
- Every competitor has at least two sincere `bestForCompetitor` points.
- No page can render without `lastUpdated`.

### Task C2: Add `/vs/` index and renderer

**Objective:** Create the comparison hub and reusable page template.

**Files:**
- Modify/Create: `src/pages.ts` or new `src/comparisonPages.ts`.
- Modify: `src/index.ts` route handling for `/vs` and `/vs/:slug`.
- Modify: `src/discovery.ts` sitemap.
- Test: `test/comparisonPages.test.ts` and `test/agentDistribution.test.ts`.

**Template sections:**
- Honest lede.
- At-a-glance table.
- When to choose competitor.
- When to choose Veracity.
- Modality coverage.
- Output design: probability vs routing action.
- Developer experience with code samples.
- Pricing examples.
- Privacy/retention.
- Benchmark results block.
- Migration guide.
- FAQ schema.
- CTA.

**Verification:**
- `/vs` lists all launch pages.
- All `/vs/*` pages self-canonicalize.
- FAQ JSON-LD is present and valid JSON.
- Pages link to `/evals/2026-benchmark`.

### Task C3: Draft and review four launch pages

**Objective:** Create accurate high-intent content without waiting on benchmark numbers.

**Pages:**
- `/vs/originality-ai` — publishing/SEO/content ops angle.
- `/vs/gptzero` — biggest brand and detector-vs-routing angle.
- `/vs/hive` — multimodal moderation angle.
- `/vs/copyleaks` — enterprise/procurement/content-integrity angle.

**Review gate:**
Before publishing, run an accuracy review where every competitor claim is backed by its docs/pricing page or changed to softer language.

**Verification:**
- Each page is 2,000–2,800 words after rendering.
- Every factual competitor claim has a source URL in the data model or footnotes.
- Each page has a sincere `when to choose competitor` section.

### Task C4: Connect existing alternatives pages

**Objective:** Preserve existing SEO pages while adding deeper comparison routes.

**Files:**
- Modify: `src/distribution.ts` and/or `src/pages.ts` alternative hub.
- Test: existing alternatives tests.

**Acceptance criteria:**
- `/alternatives/gptzero-api`, `/alternatives/originality-ai-api`, and `/alternatives/copyleaks-api` link to `/vs/gptzero`, `/vs/originality-ai`, and `/vs/copyleaks`.
- Existing sitemap expectations still pass.
- No redirects unless intentional; preserving existing URLs is safer.

---

## Workstream D — Blog launch wrapper

### Task D1: Add blog data model and routes

**Objective:** Give the benchmark launch a narrative wrapper and reusable publishing surface.

**Files:**
- Create: `src/blog.ts`
- Modify: `src/index.ts` routes `/blog` and `/blog/:slug`.
- Modify: `src/discovery.ts` sitemap.
- Test: `test/blog.test.ts`.

**Posts P0:**
1. `/blog/benchmarking-ai-detectors-routing-f1` — methodology/story post.
2. `/blog/not-an-ai-detector-routing-linter` — positioning post.

**Verification:**
- Blog index 200.
- Both posts 200.
- Posts include canonical, OG tags, Article JSON-LD, and links to `/evals/2026-benchmark`.

### Task D2: Create launch collateral

**Objective:** Make distribution ready the same day pages ship.

**Files:**
- Create: `docs/launch/2026-benchmark-hn-show.md`
- Create: `docs/launch/2026-benchmark-linkedin.md`
- Create: `docs/launch/2026-benchmark-x-thread.md`

**Acceptance criteria:**
- HN post is factual, non-salesy, and links to methodology.
- LinkedIn post emphasizes transparent benchmark + workflow-routing distinction.
- X thread has benchmark hook, honest caveat, and CTA.

---

## Workstream E — Lead capture and sample submission

### Task E1: Add adversarial sample submission form

**Objective:** Turn benchmark criticism into data flywheel.

**Files:**
- Modify: `schema.sql` — add `adversarial_samples` or reuse `access_requests` only if schema already supports it cleanly.
- Modify: `src/index.ts` — `POST /submit-sample`.
- Modify: `src/pages.ts` — form block on `/evals/2026-benchmark`.
- Test: new route validation test.

**Fields:**
- Email.
- Sample type.
- Public URL or pasted snippet.
- Why Veracity mis-routed it.
- Permission checkbox for benchmark inclusion.

**Safety:**
- Do not store secrets or regulated personal data instructions.
- Hash IP; validate length; rate-limit if existing primitives exist.

**Verification:**
- Synthetic submission stores a D1 row.
- Invalid email/content returns 400.
- Production smoke submits and deletes a test row if needed.

---

## Publishing gates

### Gate 1: Legal/ToS gate

Do not run or publish named vendor benchmarks unless `docs/vendor-claim-matrix.md` says publication is allowed or safe enough with cited terms.

### Gate 2: Corpus gate

Do not publish `/evals/2026-benchmark` unless corpus validation passes and raw-content publication policy is explicit.

### Gate 3: Metrics gate

Do not publish comparison pages with benchmark numbers unless metrics are frozen and reproducible from committed artifacts.

### Gate 4: Honesty gate

Every benchmark page must include:
- `Where Veracity loses`.
- Binary metric and routing metric.
- Caveat that routing F1 is Veracity's workflow metric and not a claim that competitors are bad detectors.
- Non-forensic disclaimer.

### Gate 5: Site deploy gate

Before deploy:
```bash
npm test -- --run
npx tsc --noEmit
npx wrangler deploy --dry-run
```

After deploy:
- Smoke `GET` and `HEAD` for `/evals`, `/evals/2026-benchmark`, `/vs`, four `/vs/*` pages, `/blog`, both posts, `/sitemap.xml`, `/llms.txt`, `/agents.json`.
- Verify all new sitemap URLs return 200.
- Browser visual QA `/evals/2026-benchmark` and `/vs/originality-ai`.

---

## Suggested timeline

### Week 0 / Day 0: Decisions and hygiene
- Confirm budget.
- Confirm benchmark repo path.
- Confirm publication policy.
- Create implementation branch.

### Week 1: Benchmark foundation
- Repo skeleton.
- Sample schema.
- Adapter contract.
- ToS matrix.
- Veracity + GPT-4o judge + one vendor dry-run.

### Week 2: Corpus and page foundations
- Text corpus v1 assembled.
- Media pilot assembled if not blocking.
- `/vs` renderer built with placeholder/noindex or not routed publicly.
- Originality.ai page drafted as tone reference.
- Blog framework added.

### Week 3: Full run and draft cluster
- Full text benchmark run.
- Media pilot run where vendor support is clean.
- Metrics computed.
- GPTZero/Hive/Copyleaks pages drafted.
- Accuracy review across competitor claims.

### Week 4: Publish and distribute
- `/evals/2026-benchmark` published.
- Existing `/evals` updated.
- `/vs` pages published/indexed.
- Blog posts published.
- Sitemap/discovery updated.
- Announcements posted.

---

## Verification checklist for final ship

- [ ] Benchmark repo has no secrets.
- [ ] Corpus validator passes.
- [ ] Metrics script regenerates `metrics.json` from normalized results.
- [ ] Vendor claim matrix completed.
- [ ] `/evals/2026-benchmark` live and links to repo/methodology.
- [ ] Existing `/evals` links forward and preserves v0.1.
- [ ] `/vs` index live.
- [ ] `/vs/originality-ai` live.
- [ ] `/vs/gptzero` live.
- [ ] `/vs/hive` live.
- [ ] `/vs/copyleaks` live.
- [ ] Existing `/alternatives/*` pages link to deeper comparisons.
- [ ] `/blog` and two posts live.
- [ ] New URLs in sitemap.
- [ ] `llms.txt`/`agents.json` updated.
- [ ] `npm test -- --run` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx wrangler deploy --dry-run` passes.
- [ ] Production deploy complete with Worker Version ID recorded.
- [ ] Production smoke 200s recorded.
- [ ] Browser visual QA screenshot captured.
- [ ] Commit(s) pushed to GitHub.

---

## Rollout messaging

Primary positioning:

> We benchmarked AI detectors against the workflow question production teams actually need: should this content ship, be revised, go to human review, or be rejected?

Required caveat:

> This is not forensic authorship proof. Competitors were not designed for VeracityAPI's routing-action metric, so we report binary flagging metrics alongside routing F1.

Conversion CTA:

> Try VeracityAPI when you need action + evidence in your agent pipeline, not a naked detector probability.
