# VeracityAPI Website Conversion Remediation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Opus’ cold-site findings into a concrete two-week implementation sequence that improves developer conversion, production-readiness perception, and evaluation-to-first-call speed after the AI slop / AI forgeries repositioning shipment.

**Architecture:** Keep the current Cloudflare Worker + static server-rendered HTML architecture. Prefer focused edits in `src/pages.ts`, `src/site.ts`, `src/index.ts`, `src/discovery.ts`, and `test/productTrust.test.ts`; do not introduce a separate CMS, frontend framework, or analytics warehouse yet. Ship in small PR-sized batches with regression tests, live smoke checks, and production deploys.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, Wrangler, Vitest, static HTML templates in `src/pages.ts`/`src/site.ts`, existing demo endpoints, existing consent-gated GA4/site-events logging.

---

## Executive Decision

Opus’ diagnosis is directionally right, but the sequencing should change now that the AI slop / AI forgeries pass is live.

**My recommendation:** ship the documentation/pricing trust fixes first, then add a dedicated `/what-we-detect` page, then improve the homepage demo/account conversion loop. Do not start with another hero rewrite; the newly shipped homepage already makes a sharper primary promise: **Detect AI slop before it ships** for developers shipping AI features.

### What changed after the latest shipment

Already done in the AI slop / AI forgeries pass:

- Homepage hero now has one sharp category: AI output linter / AI slop + AI forgery detection.
- Hero includes action-first routing: `allow`, `revise`, `human_review`, `reject`.
- Scope statement is reframed as confidence: **Workflow signals, not forensic proof.**
- `auto_revise:true` is surfaced above the demos.
- Text/image/audio are separated into precise modality cards.
- CTAs now include `Get API key`, `View GitHub`, `Read docs`, and `Try live demo`.

Remaining highest-leverage gaps:

1. Docs still need to feel production-complete without signup.
2. Pricing/free-credit framing still undersells trial value.
3. Buyers need concrete examples of what the API catches.
4. Homepage demo exists, but should be turned into a stronger no-signup conversion loop.
5. Analytics should measure time-to-first-call and homepage-to-signup before more design churn.

---

## Phase 0 — Guardrails and Baseline Instrumentation

**Objective:** Establish current metrics and prevent regression while making conversion changes.

**Priority:** P0

**Estimated effort:** S

**Files:**

- Modify: `src/index.ts`
- Modify: `src/y2k.ts`
- Modify: `test/productTrust.test.ts`
- Optional migration: `schema.sql` only if existing `site_events` columns are insufficient

### Task 0.1: Define the conversion event taxonomy

**Objective:** Make the site measurable without introducing a third-party product analytics dependency.

**Implementation notes:**

Use existing `site_events` logging where possible. Standardize events:

- `homepage_view`
- `homepage_demo_submit`
- `homepage_demo_success`
- `homepage_demo_rate_limited`
- `docs_quickstart_view`
- `docs_schema_view`
- `docs_errors_view`
- `account_cta_click`
- `account_created`
- `api_key_created`
- `first_analysis_success`

If click tracking is too much for this pass, start with route views and server-side demo/API milestones only.

**Acceptance tests:**

- `test/productTrust.test.ts` asserts new route IDs/anchors exist for analytics-friendly docs sections.
- Existing privacy copy continues to say analytics is optional and GA4 stays off unless accepted.

**Verification:**

```bash
npm test -- --run test/productTrust.test.ts
npx tsc --noEmit
```

### Task 0.2: Create a baseline query script for conversion metrics

**Objective:** Make before/after measurement cheap.

**Files:**

- Create: `scripts/conversion-baseline.mjs`
- Optional docs: `docs/generated/conversion-baseline-YYYY-MM-DD.md`

**Script output should include:**

- Homepage views by day.
- `/account` views by day.
- Account creations by day.
- API key creations by day.
- First successful analysis per account.
- Median time from account creation to first analysis.
- Demo submits/successes/rate limits by day.

**Verification:**

```bash
node scripts/conversion-baseline.mjs --days 14
```

Expected: prints a redacted aggregate table; no API keys, emails, or raw submitted content.

---

## Phase 1 — Documentation Table Stakes

**Objective:** Remove the biggest developer-evaluation objections: response shape, errors, quickstart, and score definitions.

**Priority:** P0

**Estimated effort:** M

**Files:**

- Modify: `src/pages.ts` around `docsHtml()`
- Modify: `src/index.ts` route map if splitting docs pages
- Modify: `src/discovery.ts` if OpenAPI examples need alignment
- Modify: `test/productTrust.test.ts`
- Modify: `test/agentDistribution.test.ts` if route discovery/sitemap changes

### Task 1.1: Upgrade `/docs` with a real 5-minute quickstart

**Objective:** Make time-to-first-call obvious from the docs landing page.

**Implementation:**

In `docsHtml()`, turn the current `#quickstart` into a step-by-step section:

1. Get an API key at `/account`.
2. Install SDK or use curl.
3. Make first text call.
4. Interpret `recommended_action`.
5. Add image/audio or `auto_revise` next.

Use the real unified endpoint contract:

```bash
curl https://api.veracityapi.com/v1/analyze \
  -H "Authorization: Bearer $VERACITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"text",
    "content":"Paste article, review, caption, or source text here...",
    "auto_revise":true,
    "context":{"format":"article","intended_use":"publish"},
    "store_content":false
  }'
```

**Tests:**

Add assertions that `/docs` contains:

- `Quickstart — 5 minutes to your first analyzed result`
- `recommended_action`
- `allow → publish or proceed`
- `revise → fix the flagged signals`
- `human_review → route to a human`
- `reject → block or discard`
- `auto_revise`
- `store_content:false`

### Task 1.2: Add complete sample response schema to `/docs`

**Objective:** Let developers see what they get before signup.

**Implementation:**

Add a `#response-schema` card with a complete JSON sample and field-definition table.

Use fields that match the live API/OpenAPI names. Do not invent unsupported fields. Include:

- `analysis_id` or `request_id` if live contract supports it; otherwise use the exact live ID field.
- `modality`
- `recommended_action`
- `risk_level`
- `primary_reason`
- `confidence`
- `evidence`
- `recommended_fixes`
- `limitations`
- `billing`
- `revised_text` only when `auto_revise:true` and action is `revise`

**Tests:**

- Assert `/docs` contains `Complete response example`.
- Assert every public OpenAPI response schema required field appears in the docs sample/table.
- Assert examples do not include fake secrets or real API keys.

### Task 1.3: Add `/docs/errors`

**Objective:** Make production integration failure handling clear.

**Implementation:**

Add route in `src/index.ts`:

```ts
"/docs/errors": docsErrorsHtml,
```

Create `docsErrorsHtml()` in `src/pages.ts` with:

- `401` invalid/missing API key.
- `402` insufficient credits, if live API returns it.
- `400` validation errors.
- `413` content too large, if applicable.
- `415` unsupported media type, if applicable.
- `429` rate limits and `Retry-After` behavior.
- `5xx` transient provider/worker failures.
- Recommended timeout guidance: text 30s, image/audio 60s.
- Retry policy: exponential backoff, max 3 attempts, do not retry validation errors.
- Billing guarantee: failed analysis before a recommendation is returned is not charged, if true in code; otherwise do not claim it.

**Tests:**

- Route returns `200`.
- Page contains `401`, `429`, `Retry-After`, `exponential backoff`, `insufficient credits`, and `validation errors`.
- `/docs` sidebar links to `/docs/errors`.

### Task 1.4: Define policy/signal terms inline

**Objective:** Reduce confusion around scores and routing.

**Implementation:**

In docs policy table and methodology page, define:

- `slop_risk`
- `synthetic_risk`
- `specificity_risk`
- `provenance_weakness`
- `risk_level`
- `confidence`
- `primary_reason`
- `threshold`
- `intended_use`

**Tests:**

Assert docs contain the definitions and that `recommended_action` remains the primary routing field.

---

## Phase 2 — Pricing and Trial Friction

**Objective:** Make the self-serve trial feel generous and pricing feel honest.

**Priority:** P1 for free-credit framing; P2 for calculator expansion and human_review explanation.

**Estimated effort:** S

**Files:**

- Modify: `src/site.ts`
- Modify: `src/pages.ts` around `pricingHtml()`
- Modify: `test/productTrust.test.ts`

### Task 2.1: Reframe starter credit in units before dollars

**Objective:** Avoid the `$1.50 sounds tiny` problem.

**Copy direction:**

Homepage eyebrow/CTA strip:

> Free: analyze your first 300,000 characters. No credit card.

Pricing page card:

> Starter credit: enough for roughly 300 analyze-only 1k-character text requests, 150 Analyze + revise requests, 75 image checks, or 150 audio checks. Dollar value: $1.50.

**Tests:**

- Homepage contains `300,000 characters`.
- Pricing page contains `$1.50` but does not lead the hero with it.

### Task 2.2: Make modality pricing visible at top of `/pricing`

**Objective:** Eliminate surprise-charge concern.

**Implementation:**

Add three pricing tiles immediately below pricing hero:

| Modality | Price | Unit | Notes |
|---|---:|---|---|
| Text analyze | `$0.005` | per 1k chars | rounded up |
| Text analyze + revise | `$0.010` | per 1k chars | `auto_revise:true` |
| Image | `$0.02` | per image URL | no raw bytes stored |
| Audio | `$0.01` | per request | v0.1 workflow triage |

Extend calculator to include image and audio counts if simple; otherwise add static examples first and defer JS calculator expansion.

**Tests:**

- Pricing page contains all four unit prices.
- Pricing page contains `rounded up`.
- Pricing page contains `auto_revise:true`.

### Task 2.3: Add `human_review` billing fairness explanation

**Objective:** Preempt the `I paid you to say you don't know` objection.

**Copy:**

> Why does `human_review` cost the same as `allow`?
>
> Because the analysis did the same work. `human_review` means VeracityAPI found enough signal to flag risk, but not enough to safely auto-route. You are paying for detection, evidence, and routing metadata — not a guaranteed allow/reject verdict. If analysis fails before returning a recommendation, it is not charged.

Before shipping the final sentence, inspect billing code to verify failed analyses are not debited.

**Tests:**

- Pricing page contains `Why does human_review cost the same as allow?`.
- If the no-charge-on-failure claim is present, add a billing test or only phrase it as current intended policy after verification.

---

## Phase 3 — `/what-we-detect` Example Library

**Objective:** Translate `AI slop` into budget-line problems: hallucination risk, brand-safety risk, low-information content, unsupported claims, and synthetic media triage.

**Priority:** P0

**Estimated effort:** M

**Files:**

- Create/modify: `src/pages.ts` with `whatWeDetectHtml()`
- Modify: `src/index.ts` route map
- Modify: `src/discovery.ts` sitemap/listing if manually enumerated
- Modify: `test/productTrust.test.ts`
- Modify: `test/agentDistribution.test.ts` for sitemap/discovery coverage

### Task 3.1: Add `/what-we-detect`

**Objective:** Create the single best trust-builder page.

**Route:**

```ts
"/what-we-detect": whatWeDetectHtml,
"/slop": whatWeDetectHtml, // optional redirect/canonical only if routing supports it cleanly
```

Prefer canonical `/what-we-detect` to avoid overusing `slop` for media.

### Task 3.2: Add five concrete detection categories

**Content structure:**

1. Generic, low-information phrasing
   - Before: `In today's fast-paced digital landscape...`
   - Verdict: `recommended_action=revise`, `primary_reason=generic_phrasing`
   - Fix: replace with specific customer/problem/evidence.

2. Unsupported claims presented as fact
   - Before: `Studies show 87% of users prefer...`
   - Verdict: `recommended_action=human_review`, `primary_reason=unsupported_claim`
   - Fix: cite a source or remove the claim.

3. Weak provenance / source risk
   - Before: scraped or unattributed source snippet.
   - Verdict: `human_review`.
   - Fix: require corroboration.

4. Synthetic image cues
   - Use image/forgery language, not text slop language.
   - Verdict: `human_review`.

5. Synthetic audio cues
   - Use voice/synthetic-speech risk language.
   - Verdict: `human_review`.

### Task 3.3: Add a `what we catch / what we do not` comparison

**Placement:** top half of `/what-we-detect`; optionally add a compressed version on homepage later.

**Left column:**

- Generic AI phrasing patterns.
- Unsupported factual claims.
- Weak provenance / source ambiguity.
- Synthetic-image cues.
- Synthetic-audio cues.
- Low-information filler content.

**Right column:**

- Whether a specific person wrote it.
- Whether a claim is objectively true.
- Copyright / IP infringement.
- Hate speech / harassment.
- PII detection.
- Speaker identity proof.
- Courtroom/academic/legal evidence.

**Tests:**

- `/what-we-detect` returns `200`.
- Page contains all five categories.
- Page contains `What we catch` and `What we do not`.
- Page avoids applying `slop` to image/audio headings.

---

## Phase 4 — Homepage Demo Conversion Loop

**Objective:** Turn the existing homepage demo from proof-of-concept into a stronger signup driver.

**Priority:** P0, but after docs/pricing/what-we-detect because the demo already exists.

**Estimated effort:** M

**Files:**

- Modify: `src/site.ts`
- Modify: `src/index.ts` demo handlers if rate-limit or output shape needs changes
- Modify: `src/discovery.ts` if public demo docs change
- Modify: `test/productTrust.test.ts`

### Task 4.1: Make the text demo explicitly user-paste-first

**Objective:** Address Opus’ `preloaded fixtures prove nothing` concern without rebuilding the backend.

**Implementation:**

- Change demo heading from generic `Paste content → get an action` to `Paste your own draft — no signup required`.
- Keep sample selector, but make custom paste visually primary.
- Show character counter and 4k/5k cap based on actual handler limit. Current discovery says 4,000 chars; do not claim 5,000 unless code changes.
- Keep `store_content=false` visible.

**Tests:**

- Homepage contains `Paste your own draft`.
- Homepage contains the actual cap (`4,000` unless changed).
- Homepage contains `no signup required` and `store_content=false`.

### Task 4.2: Strengthen post-result CTA

**Objective:** Convert high-intent demo users.

**Implementation:**

After result summary, show:

> Want the full API output, SDKs, image/audio, and higher limits? Sign up free.

CTA: `/account`.

**Tests:**

- Homepage contains `full API output`.
- Homepage contains `Sign up free` near demo markup.

### Task 4.3: Add demo rate-limit copy that feels fair

**Objective:** Avoid dead-end frustration.

**Implementation:**

When rate limited, message should say:

> Public demo limit reached. Create a free API key to keep testing with your own content.

Do not hide that public demo is limited.

**Tests:**

- Demo JS contains `Public demo limit reached`.
- Demo JS links or points to `/account`.

---

## Phase 5 — Social Proof Without Waiting for External Customers

**Objective:** Fill the `is this real?` trust gap while customer logos are still pending.

**Priority:** P1

**Estimated effort:** S for dogfood proof; L for external named customer.

**Files:**

- Modify: `src/site.ts`
- Modify: `src/pages.ts` around `aboutHtml()` or a new `caseStudyHtml()`
- Create: `docs/case-studies/tabiji-dogfood.md` or public page `/case-studies/tabiji`
- Modify: `test/productTrust.test.ts`

### Task 5.1: Add dogfood proof strip

**Objective:** Use real production usage honestly without pretending it is a third-party customer.

**Copy direction:**

> Dogfooded on production publishing workflows: VeracityAPI gates generated drafts, captions, and content-pipeline outputs before they ship.

If naming Tabiji is acceptable, use:

> Used internally on Tabiji publishing workflows to route generated content for allow/revise/human_review decisions before publication.

**Tests:**

- Homepage contains `Dogfooded` or `Used internally`.
- Copy does not claim `Trusted by customers` unless there is an actual named customer.

### Task 5.2: Start external design-partner loop outside code

**Objective:** Generate the first credible logo/testimonial.

**Non-code checklist:**

- Identify 5–10 users/builders who could use the API in a real workflow.
- Offer hands-on implementation help plus credits for permission to quote.
- Ask for one sentence: `VeracityAPI helped us catch ___ before ___.`
- Ask for logo permission and exact approved wording.

**Acceptance:**

- One approved quote and logo asset.
- Only then add a `Trusted by` strip.

---

## Phase 6 — Sitemap, Discovery, and AI-Agent Surface Updates

**Objective:** Ensure new pages are discoverable by humans, search engines, and agents.

**Priority:** P1

**Estimated effort:** S

**Files:**

- Modify: `src/discovery.ts`
- Modify: `src/index.ts`
- Modify: `test/agentDistribution.test.ts`

### Task 6.1: Add new routes to sitemap/discovery

**Routes likely added by this plan:**

- `/docs/errors`
- `/what-we-detect`
- Optional `/docs/quickstart` only if split out of `/docs`
- Optional `/docs/response-schema` only if split out of `/docs`

**Tests:**

- `sitemap.xml` contains new published URLs.
- Each new URL returns `200`.
- `llms.txt` or `llms-full.txt` mentions `/what-we-detect` and `/docs/errors`.

### Task 6.2: Update OpenAPI examples if docs expose a sample response

**Objective:** Avoid docs/OpenAPI drift.

**Tests:**

- Docs response sample references fields present in `openApiSpec()`.
- OpenAPI examples do not contain fake unsupported fields.

---

## Deferred / Do Not Build Yet

Do not build these until conversion basics improve or a real customer requires them:

- Full brand redesign.
- New frontend framework.
- SOC 2 or formal enterprise security packet.
- Refund/discount billing logic for `human_review`.
- Zapier/Make integrations.
- More modalities.
- A full analytics warehouse.
- Multi-page blog/content campaign before docs and demo conversion are fixed.

---

## Shipping Order

### Shipment A — Docs + pricing trust fixes

**Scope:** Phase 1 + Phase 2.

**Expected files:** `src/pages.ts`, `src/index.ts`, `test/productTrust.test.ts`, possibly `src/discovery.ts`.

**Verification:**

```bash
npm test -- --run
npx tsc --noEmit
npx wrangler deploy --dry-run
```

**Production smoke:**

```bash
curl -I https://veracityapi.com/docs
curl -I https://veracityapi.com/docs/errors
curl -I https://veracityapi.com/pricing
```

### Shipment B — `/what-we-detect` examples + discovery

**Scope:** Phase 3 + Phase 6.

**Verification:**

```bash
npm test -- --run
npx tsc --noEmit
npx wrangler deploy --dry-run
```

**Production smoke:**

```bash
curl -I https://veracityapi.com/what-we-detect
curl https://veracityapi.com/sitemap.xml | grep what-we-detect
```

### Shipment C — Homepage demo conversion loop + dogfood proof

**Scope:** Phase 4 + Phase 5.1.

**Verification:**

```bash
npm test -- --run
npx tsc --noEmit
npx wrangler deploy --dry-run
```

**Production smoke:**

- Load homepage visually.
- Paste custom text in demo.
- Confirm result panel shows `recommended_action`, top signals, billing estimate, and signup CTA.
- Confirm rate limit messaging points to `/account`.

### Shipment D — Metrics baseline

**Scope:** Phase 0 if not already done; can ship before A if you want measurement first.

**Verification:**

```bash
node scripts/conversion-baseline.mjs --days 14
```

---

## Definition of Done

A remediation batch is complete only when:

- `npm test -- --run` passes.
- `npx tsc --noEmit` passes.
- `npx wrangler deploy --dry-run` passes.
- Production deploy succeeds.
- Production smoke checks return `200` for changed routes.
- Homepage/docs/pricing snapshots show no obvious layout regression.
- Commit is pushed to `main`.
- Final report includes Worker Version ID, commit hash, smoke URLs, and rollback command.

---

## Success Metrics

Track these weekly after Shipment A:

1. **Time-to-first-call** for new signups — target under 10 minutes.
2. **Homepage → account conversion** — target 2–3x after demo loop improves.
3. **Account → first API key** — should approach near-100% for real evaluators.
4. **Account → first successful analysis** — main activation metric.
5. **Demo → signup** — count demo successes followed by `/account` visits or account creation.
6. **Trial → paid/top-up conversion** — lagging signal after docs + trust fixes.

---

## My Cut of Opus’ Plan

Keep:

- Docs response schema.
- Error docs.
- 5-minute quickstart.
- What we catch / what we do not catch.
- Free-credit reframing.
- Pricing transparency.
- `human_review` billing explanation.
- Concrete `/what-we-detect` examples.
- Better demo conversion loop.
- First named proof point.

Modify:

- Do not pick a new hero persona from scratch yet. The current hero now targets developers shipping AI features and is stronger than the evaluated version.
- Do not call image/audio `slop`; keep `AI forgeries`, `synthetic media`, `tampering`, `provenance risk`, and `synthetic voice` language.
- Do not lead with defensive disclaimers; use `Workflow signals, not forensic proof` as confident scope language.
- Do not build a new live demo backend unless the current `/demo/analyze` path cannot support the desired no-signup flow.

Defer:

- True customer logos until there is permission.
- Refund/discount logic for `human_review` until pricing-copy fixes are tested.
- Broader integrations until docs/demo conversion is no longer the bottleneck.
