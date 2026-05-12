# VeracityAPI Y2K v3 — Architecture Review + Execution Plan

> **For Hermes / implementing agent:** This is a reviewed, implementation-ready version of Opus's v3 execution plan. Use `subagent-driven-development` if executing in parallel. Ship in two production deploys: **Phase C** first for risk/technical/coherence fixes, then pause for Bernard's explicit Phase A go/no-go.

**Goal:** Close the remaining legal/technical/coherence gaps from the current live redesign, then optionally move from "Y2K-flavored" to faithful `08-y2k-chrome.html` visual language.

**Architecture:** Preserve the current Cloudflare Worker + TypeScript + inline/static template architecture. Do not migrate to React/Vite/assets pipeline. Centralize shared HTML chrome in `src/y2k.ts`, route all marketing/distribution/use-case layouts through it, and add regression tests in `test/agentDistribution.test.ts` / `test/productTrust.test.ts` so future style/legal/API drift is caught.

**Current repo baseline:** `main` at `244966c` (`Ship Y2K Chrome site redesign`). Production Worker version from prior shipment: `269e7587-f3b7-4d34-ba1a-13a09bf27f2f`.

---

## Executive review of Opus v3

### What is correct

Opus is right on the critical gaps:

1. **Distribution pages still use the old dark theme.** Verified live for `/alternatives/gptzero-api`, `/alternatives/copyleaks-api`, `/alternatives/originality-ai-api`, `/alternatives/deepmedia`, `/ai-image-detection-api`, and `/integrations/mcp`: each still contains `--bg:#08090a`, `background:#0f1011`, `og.svg`, and the ✅ mark.
2. **OpenAPI still has deprecated `synthetic_risk` in response `required[]`.** Verified live: `AnalyzeTextResponse`, `AnalyzeImageResponse`, and `AnalyzeAudioResponse` all still require it.
3. **GPTZero framing is still too sharp.** Verified source contains `not student accusations`, `student accusations`, `GPTZero-style tools...`, and `Student discipline or employee surveillance` in `src/distribution.ts`.
4. **OG metadata still points to SVG on inner/distribution pages.** Homepage serves `/og.png`, but distribution/layout templates still use `/og.svg`.
5. **DMARC/CAA appear missing.** `dig _dmarc.veracityapi.com TXT +short` and `dig veracityapi.com CAA +short` returned empty.

### Flags for Bernard to review before execution

These do **not** block Phase C implementation, but they should be resolved before Phase A or pricing copy changes:

1. **Phase A go/no-go is a brand decision, not purely implementation.** Faithful Y2K (`#d8d6d2`, neon accents, VT323, layered shadows) is more distinctive but less enterprise-safe than the current cream palette. Recommendation: ship Phase C, then look at live screenshots before approving Phase A.
2. **Do not add `$99/mo Team tier` copy unless that product/pricing exists.** Opus's Copyleaks replacement says VeracityAPI is launching a `$99/mo Team tier`. Current live pricing is usage/prepaid with starter credit; inserting a Team tier creates drift. Recommendation: use neutral copy: `VeracityAPI is currently usage-based with starter credit and volume/procurement support by request.`
3. **Pricing FAQ: “UTF-8 codepoints” is imprecise.** The code bills `parsed.text.length` in JS (`src/billing.ts`), which counts UTF-16 code units, not UTF-8 bytes and not true Unicode code points. Recommendation: phrase as `JavaScript string length / characters submitted, including whitespace; rounded up per 1,000-character unit` unless we intentionally change billing semantics.
4. **Failed-request billing claim needs exactness.** Auth/validation/model-failure requests should not bill before debit; but successful provider calls that return a scored result do bill. Recommendation: FAQ says `Requests rejected before analysis (4xx) and provider/server failures (5xx) do not debit credits; successful analyzed responses debit even if the recommendation is reject/human_review.`
5. **Sandbox keys are roadmap unless implemented.** Do not imply real sandbox keys. Use `Use starter credit on a separate test account today; dedicated sandbox keys are on the roadmap.`
6. **Do not republish the removed support-call QA page as “Q3” without product approval.** Keep it 404/noindex unless Bernard explicitly wants a roadmap page.
7. **Google Search Console resubmit may not be possible from Hermes.** Bing IndexNow can be scripted if key route exists; Google Search Console likely requires UI/API access. Treat as manual unless credentials/tooling exists.
8. **Lighthouse/axe should be best-effort in local automation.** We can run Playwright/axe if dependencies are installed or install dev deps if acceptable; otherwise browser DevTools/Lighthouse scores are manual evidence. Do not block safety fixes on missing Lighthouse tooling.
9. **`wrangler deploy --env preview` is probably wrong for this repo.** `wrangler.toml` has no named preview env. Use `npx wrangler deploy --dry-run --outdir ...` for build preflight, then production deploy, unless a preview env is added deliberately.
10. **Template artifact path must be verified.** The referenced `~/Desktop/veracityapi-redesigns/08-y2k-chrome.html` was not found in the current Hermes file search under `/Users/psy/Desktop`; execution should locate it or use the uploaded plan's token/component specs as fallback.

---

## Phase C — Ship safety + correctness + visual coherence first

**Phase C objective:** Make the current live site safe, technically correct, and visually coherent without yet committing to the full faithful Y2K template.

**Deploy boundary:** Phase C gets its own commit(s), build preflight, production deploy, and smoke report.

### C0 — Snapshot current state and add regression tests first

**Files:**
- Modify: `test/agentDistribution.test.ts`
- Modify: `test/productTrust.test.ts` if better fit

**Tests to add before code changes:**

1. Distribution pages no longer use dark theme or ✅:
   - Routes: `/alternatives/gptzero-api`, `/alternatives/copyleaks-api`, `/alternatives/originality-ai-api`, `/alternatives/deepmedia`, `/ai-detection-api`, `/ai-content-detector-api`, `/synthetic-media-detection-api`, `/ai-image-detection-api`, `/ai-audio-detection-api`, `/integrations/openai-actions`, `/integrations/mcp`, `/integrations/claude`, `/integrations/langgraph`.
   - Assert HTML contains `--bg:#f6f1df` or equivalent shared Y2K token and does **not** contain `--bg:#08090a`, `background:#0f1011`, `✅`, or `/og.svg` in active OG/Twitter image tags.
2. Public text contains no risky student framing:
   - Assert `/alternatives/gptzero-api` source/HTML does not match `/student accusations|Student discipline|employee surveillance|GPTZero-style tools/i`.
3. OpenAPI response schemas do not require deprecated alias:
   - `synthetic_risk` not in `required[]` for `AnalyzeTextResponse`, `AnalyzeImageResponse`, `AnalyzeAudioResponse`.
4. Pricing FAQ coverage:
   - `/pricing` contains FAQ questions for characters, failed requests, sandbox/test keys, invoices, annual, VAT/sales tax, and refunds.
5. DNS record tests should **not** be unit tests; verify with shell at deploy time.

**Command:**
```bash
npm test -- test/agentDistribution.test.ts
```
Expected initial result: failures on the new assertions.

### C1 — DNS records: DMARC + CAA

**No repo files unless adding docs.**

Add in Cloudflare DNS:

```txt
_dmarc.veracityapi.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@veracityapi.com; pct=100; aspf=r; adkim=r"
veracityapi.com CAA 0 issue "pki.goog"
veracityapi.com CAA 0 issuewild ";"
veracityapi.com CAA 0 iodef "mailto:security@veracityapi.com"
```

**Verify:**
```bash
dig _dmarc.veracityapi.com TXT +short
dig veracityapi.com CAA +short
```

**Flag:** Hermes may not have DNS API access. If no Cloudflare DNS tooling exists, Bernard/Cloudflare dashboard action required.

### C2 — Rewrite risky GPTZero alternative copy

**File:** `src/distribution.ts`

**Change:** Replace GPTZero page `description`, `lead`, `avoid`, and first section with neutral factual scope. Do not mention students, discipline, surveillance, or “GPTZero-style”.

**Recommended copy:**

```ts
description: "A GPTZero API alternative for teams that need deterministic routing actions, evidence spans, and workflow-safe content decisions.",
lead: "GPTZero offers a general-purpose AI text detection API. VeracityAPI is built for a narrower job: returning a deterministic routing action — allow, revise, human_review, or reject — plus evidence spans so agent and content pipelines can branch without threshold tuning.",
avoid: ["Claims that a model definitely wrote text", "Forensic disputes", "High-stakes decisions without independent review"],
sections: [
  { title: "Different jobs to be done", body: "Choose GPTZero when you need broad AI-text detection coverage and your team will interpret a probability. Choose VeracityAPI when your code needs an action it can safely route on." },
  ...
]
```

Add a reusable alternative disclaimer block (see C4) to this page.

**Verify:**
```bash
curl -s https://localhost-or-preview/alternatives/gptzero-api | grep -Ei "student|surveillance|GPTZero-style" && exit 1 || echo OK
```

### C3 — Fix Copyleaks procurement comparison without inventing a Team tier

**File:** `src/distribution.ts`

**Change:** Replace any procurement line that implies Copyleaks lacks self-serve. Do **not** add `$99/mo Team tier` unless Bernard approves a pricing/product change.

**Recommended row/body:**

```txt
Procurement: Copyleaks offers self-serve and enterprise procurement paths. VeracityAPI is currently usage-based with starter credit and volume/procurement support by request.
```

**Verify:**
```bash
rg -i "enterprise-oriented procurement options|\$99/mo Team" src test
```
Expected: no matches unless explicitly approved.

### C4 — Add dated comparison disclaimers to all retained alternative pages

**File:** `src/distribution.ts`

Create helper:

```ts
function comparisonDisclaimer(): string {
  return `<section class="card comparison-disclaimer"><p><strong>Last updated: 2026-05-12.</strong> Comparison reflects publicly available information as of this date. Trademarks belong to their owners.</p></section>`;
}
```

Append it only for retained `/alternatives/*` pages:
- `/alternatives/gptzero-api`
- `/alternatives/copyleaks-api`
- `/alternatives/originality-ai-api`
- `/alternatives/deepmedia`

**Verify:** each retained alternative page contains `Last updated: 2026-05-12`.

### C5 — OpenAPI required[] fix

**File:** `src/discovery.ts`

Remove `synthetic_risk` from `required` on:
- `AnalyzeTextResponse`
- `AnalyzeImageResponse`
- `AnalyzeAudioResponse`

Keep the property present and, where already marked, deprecated/backcompat.

**Verify:**
```bash
npm test -- test/agentDistribution.test.ts
curl -A 'HermesSmoke/1.0' -sS https://preview/openapi.json | python3 -c '...assert synthetic_risk not required...'
```

### C6 — Make `/og.png` the active OG/Twitter image everywhere

**Files:**
- `src/pages.ts`
- `src/distribution.ts`
- `src/site.ts` if needed
- `src/index.ts` and `src/ogPng.ts` already serve the current PNG route

**Change:** Replace page metadata active image references:

```html
<meta property="og:image" content="https://veracityapi.com/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta name="twitter:image" content="https://veracityapi.com/og.png" />
```

Keep `/og.svg` route as legacy fallback but do not use it in active meta tags.

**Verify:** `curl -s https://veracityapi.com/alternatives/gptzero-api | grep -E 'og.png|og.svg'` shows active `og.png`, no active `og.svg`.

### C7 — Propagate shared design system to distribution pages

**Files:**
- Modify: `src/distribution.ts`
- Use: `src/y2k.ts`

**Current issue:** `src/distribution.ts` has its own old dark layout and CSS.

**Architecture:**
1. Import shared helpers:
   ```ts
   import { canonicalFooter, canonicalNav, cookieConsentScript, navScript, y2kCss } from "./y2k";
   ```
2. Replace `distributionPageHtml()` outer shell with the same head/nav/footer structure used by `src/pages.ts`.
3. Delete/stop using the old `css()` function in `src/distribution.ts`.
4. Use body class `loud` or `restrained` consistently. Recommendation for Phase C: `restrained` for alternatives and `loud` for category/integration SEO pages only if visually appropriate. Avoid Phase A-only chrome vocabulary here until Phase A.
5. Keep all long-form distribution content intact except C2-C4.

**Verify:** live/source for all retained alternatives, SEO pages, and integrations no longer contains `--bg:#08090a`, `background:#0f1011`, or `✅`.

### C8 — Align extension/account auth pages or explicitly exclude them

**File:** `src/extensionAuth.ts`

`src/extensionAuth.ts` still uses `--bg:#08090a`. This is not in Opus's route list, but it is a user-facing page. Decide:

- **Recommended Phase C:** update extension connect page to shared light/Y2K tokens or a minimal mode, because users connecting the Chrome extension should not see old dark theme.
- If not updated, document it as intentionally excluded from Phase C because it is an auth utility surface.

### C9 — Pricing FAQ block

**File:** `src/pages.ts` (`pricingHtml()`)

Add a `<section class="card faq">` with `<details>` questions:

1. What counts as a character?
   - `Text billing uses the JavaScript string length of submitted text, including whitespace, rounded up to the nearest 1,000-character unit.`
2. Do failed requests bill?
   - `Requests rejected before analysis (4xx) and provider/server failures (5xx) do not debit credits. Successful analyzed responses debit credits even if the recommended action is human_review or reject.`
3. Can I get a sandbox key?
   - `Today, use starter credit on a separate test account. Dedicated sandbox keys are on the roadmap.`
4. Do invoices include backup statements?
   - `For larger/procurement accounts, we can provide monthly usage line items. Self-serve prepaid credit history is visible in the account console.`
5. Annual pricing?
   - `Month-to-month / prepaid today; contact us for annual commitments or volume needs.`
6. VAT / sales tax?
   - `Prices are listed before applicable taxes. Taxes may be collected based on billing location and payment provider rules.`
7. Refunds?
   - `Unused prepaid credit refundable within 30 days on request, subject to abuse/fraud review.`

**Verify:** pricing tests assert each FAQ topic exists.

### C10 — Phase C verification and deploy

**Commands:**

```bash
npm test
npx tsc --noEmit
npx wrangler deploy --dry-run --outdir /tmp/veracityapi-phase-c-build
npx wrangler deployments list --name veracityapi | tail -25  # capture rollback version
npx wrangler deploy
```

**Production smoke routes:**

```bash
for p in / /docs /methodology /trust-model /for-agents /mcp /pricing /evals /account /use-cases /use-cases/publishing-pipeline-quality-gate /alternatives/gptzero-api /alternatives/copyleaks-api /alternatives/originality-ai-api /alternatives/deepmedia /ai-detection-api /ai-image-detection-api /integrations/mcp /llms.txt /agents.json /openapi.json /sitemap.xml /robots.txt /.well-known/security.txt /about /security; do
  curl -A 'HermesSmoke/1.0' -s -o /dev/null -w "%{http_code} %{content_type} %{url_effective}\n" "https://veracityapi.com$p"
done
```

**Intentional 404 smoke:**
```bash
for p in /alternatives/reality-defender /alternatives/resemble-detect /use-cases/audio-customer-support-call-qa; do
  curl -A 'HermesSmoke/1.0' -s -o /dev/null -w "%{http_code} %{content_type} %{url_effective}\n" "https://veracityapi.com$p" -H 'Accept: text/html'
done
```
Expected: `404 text/html`.

**Browser QA:**
- `/alternatives/gptzero-api`
- `/ai-image-detection-api`
- `/integrations/mcp`
- `/use-cases/publishing-pipeline-quality-gate`
- `/pricing`

**Phase C completion report:** commit SHA, Worker version ID, previous version ID, DNS record status, smoke table, tests/typecheck status, screenshots if available.

---

## Phase A — Faithful Y2K template pass, gated by Bernard approval

**Phase A objective:** Move from current enterprise-friendly cream/Y2K flavor to full `08-y2k-chrome.html` fidelity.

**Do not start Phase A until:**
1. Phase C is live and smoked.
2. Bernard approves the more distinctive/neon brand direction after seeing Phase C screenshots.
3. The actual `08-y2k-chrome.html` source is located or copied into `design/redesign-source/08-y2k-chrome.html`.

### A0 — Import source template and protect with tests

**Files:**
- Create: `design/redesign-source/08-y2k-chrome.html` if source exists
- Modify: tests for token/class presence

**Test acceptance markers:**
- `btn-chrome`, `btn-pink`, `btn-cyan`
- `marquee`, `marquee-track`
- `demo-window`, `window-bar`
- `hero-banner`
- `verdict-row`
- `stamp-tag`
- `chrome-1`, `chrome-2`
- `page--loud`, `page--restrained`, `page--minimal`

### A1 — Token and font migration in `src/y2k.ts`

Update `y2kCss()` tokens:

```css
--bg:#d8d6d2;
--bg-2:#e5e2dd;
--paper:#f0ede7;
--ink:#0a0a0a;
--text:#1a1a1a;
--muted:#5a564f;
--line:#0a0a0a;
--hot-pink:#ff2d8a;
--hot-pink-dark:#d0186c;
--cyber-cyan:#00d4ff;
--acid-green:#b8ff00;
--warning-amber:#ffaa00;
--chrome-1:#f4f4f2;
--chrome-2:#d4d2cc;
--chrome-3:#8c8a85;
```

Keep temporary aliases `--panel`, `--hot`, `--cyan`, `--green` until all references are migrated.

Add font loading in shared head templates:
- `Space Grotesk`
- `Departure Mono` if available via source/self-hosting; otherwise use a fallback and flag that Google Fonts may not supply it reliably.
- `VT323`

**Implementation note:** Self-hosting is preferable, but do not invent font files. If local font files are unavailable, use Google Fonts for Phase A and schedule self-hosting as perf follow-up.

### A2 — Background + hero fidelity

Implement:
- dithered radial-dot body background
- `.hero-banner` (`SYSTEM ONLINE · v0.1 · ALL CHANNELS NOMINAL`)
- `.hero-h1` layered text shadow
- `.stamp` on `slop`
- `.hero-stamps` replacing the current truststrip on homepage

**A11y guard:** layered shadows only on the loud homepage. Disable in `page--restrained` and `page--minimal`.

### A3 — Marquee and reduced motion

Implement `.marquee` / `.marquee-track` after hero. Keep `@media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } }`.

### A4 — Demo window chrome without breaking JS IDs

Refactor homepage text/image/audio demo wrappers to use:
- `.demo-window`
- `.window-bar`
- `.window-controls`
- `.window-title`
- `.demo-tabs`
- `.window-body`

Preserve all existing element IDs and JS bindings.

Add result strip + verdict/score classes, but avoid overclaiming latency (`340ms`) unless it is label/mock/sample. Prefer `Response received` and dynamically fill latency later if needed.

### A5 — Feature/code/pricing/CTA/footer fidelity

Implement the remaining template vocabulary:
- `.feat-card` colored top borders
- `.code-window` with cyan + pink shadow stack
- `.price-card.featured` hot-pink card only if pricing markup has a true card tier; otherwise adapt to the current usage-pricing cards without adding a fake Team tier
- `.cta` diagonal stripe overlay
- 5-column shared footer, but remove links to non-existent pages (`/customers`, `/contact`, `/blog`, `/dpa`) unless those routes are added. Safer footer columns:
  - product: Demo, Pricing, Changelog, Status
  - developers: Docs, OpenAPI, llms.txt, agents.json
  - workflows: Use cases, For agents, MCP, Evals
  - company: About, Security, Privacy, Terms
  - machine: Sitemap, robots.txt, agents.json, OpenAPI

### A6 — Route mode mapping

Use body classes exactly:
- `page--loud`: `/`, `/use-cases`, `/for-agents`, `/mcp`, `/evals`, `/alternatives/*`, `/ai-*-detection-api`, `/integrations/*`, `/use-cases/*`
- `page--restrained`: `/docs`, `/pricing`, `/account`, `/changelog`, `/status`, `/methodology`, `/trust-model`
- `page--minimal`: `/privacy`, `/terms`, `/security`, `/subprocessors`, `/about`

Current code uses bare `loud`/`restrained`/`minimal`; migrate to `page--*` or support both aliases during transition.

### A7 — Accessibility/perf/browser QA

**Run after visual work:**
- `npm test`
- `npx tsc --noEmit`
- browser visual QA desktop and mobile
- cookie consent browser check: before consent no GA script; after accept GA loads
- route content smoke
- Lighthouse/axe if tooling available; otherwise document manual/browser limitation

**Contrast rule:** neon accents should be decorative or used on dark backgrounds. Body/card text stays ink/muted on paper.

### A8 — Phase A deploy

Same deploy process as C10. Capture rollback version before deployment and report new Worker version after deployment.

---

## Suggested execution order

1. **Phase C tests first** — encode the known failures.
2. **C2-C7 code fixes** — GPTZero/Copyleaks/disclaimers/OpenAPI/OG/distribution layout.
3. **C8-C9 polish** — extension auth decision + pricing FAQ.
4. **Phase C deploy/smoke/report.**
5. **Pause for Bernard approval** with screenshots and a short recommendation: stop at Phase C or proceed to faithful Y2K.
6. **Phase A only if approved.**

---

## Final report format

```md
## VeracityAPI Y2K v3 — Phase C shipped

- Commit: <sha>
- Worker version: <version-id>
- Previous rollback version: <version-id>
- Production: https://veracityapi.com

### Fixed
- [✓] DMARC/CAA: <verified/manual status>
- [✓] GPTZero alternative neutralized
- [✓] Copyleaks comparison corrected without fake pricing tier
- [✓] dated alternative disclaimers
- [✓] synthetic_risk removed from OpenAPI required[]
- [✓] og.png active across templates
- [✓] ✅ logo removed from distribution pages
- [✓] old dark theme removed from alternatives/SEO/integrations
- [✓] pricing FAQ added

### Verification
- npm test: <pass>
- tsc: <pass>
- smoke routes: <counts>
- intentional 404s: <pass>
- no student framing: <pass>
- no old theme tokens: <pass>
- browser QA: <screenshots/notes>

### Phase A recommendation
- Proceed / pause, with rationale.
```
