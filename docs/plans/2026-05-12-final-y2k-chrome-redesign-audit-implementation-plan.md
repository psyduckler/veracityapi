# VeracityAPI Final Y2K Chrome Redesign + Audit Implementation Plan

> **For Hermes / implementing agent:** Use `subagent-driven-development` to execute this plan task-by-task. This document supersedes `2026-05-12-live-site-redesign-template-adaptation.md` and `2026-05-12-y2k-redesign-implementation-plan-v2.md`.

**Goal:** Ship the selected Y2K Chrome redesign to `https://veracityapi.com` while closing the P0/P1 audit issues, security gaps, content-risk decisions, and product ambiguities identified by Opus/Gemini.

**Architecture:** Keep the existing Cloudflare Worker + TypeScript + inline HTML/CSS architecture. Do **not** migrate to React, Vite, Astro, Next, or Cloudflare Pages. Extract shared tokens/components from the Y2K template, then restyle existing Worker-rendered pages.

**Tech Stack:** Cloudflare Worker, TypeScript, inline HTML/CSS/JS templates, Vitest, Wrangler, D1, Stripe, OpenAPI JSON, machine-readable discovery routes.

**Repo:** `/Users/psy/projects/veracityapi`

**Current baseline at planning time:** commit `6c339fb`. Important files discovered:
- Router + response helpers: `src/index.ts`
- Homepage: `src/site.ts`
- Inner/use-case/category pages: `src/pages.ts`
- Distribution/alternative/integration pages: `src/distribution.ts`
- Account UI: `src/account.ts`
- Discovery/OpenAPI/llms/sitemap/agents: `src/discovery.ts`
- Tests: `test/*.test.ts`

**Design source of truth:** `~/Desktop/veracityapi-redesigns/08-y2k-chrome.html`. Copy it into repo before implementation starts.

---

## 0. Executive Decisions — Resolved

These are final. Do not ask again during implementation.

1. **Hero copy:** Use aggressive Y2K voice: **“Detect AI slop before it ships.”**
2. **Vaporware risk:** Unpublish `/use-cases/audio-customer-support-call-qa` entirely. It should 404 and be removed from sitemap/discovery surfaces.
3. **Alternatives pages:**
   - Unpublish `/alternatives/reality-defender` and `/alternatives/resemble-detect` entirely. They should 404 and be removed from sitemap/discovery surfaces.
   - Rewrite `/alternatives/gptzero-api` and `/alternatives/copyleaks-api` to be strictly factual and non-accusatory.
4. **Customer leaks:** Remove all public specific references to `Tabiji`. Generalize to **“a customer with 200-page content pipelines”** or equivalent anonymous phrasing.
5. **Cookie consent:** Implement opt-in. GA4 / analytics must not initialize until `localStorage.cookie_consent === "accepted"`.
6. **Founder identity:** Create `/about` in minimal mode. Disclose Bernard Huang and Clearscope connection as trust leverage.
7. **Design restraint:** Loud Y2K for marketing. Restrained Y2K for docs/pricing/account/alternatives. Minimal Y2K for legal/trust pages.

---

## Acceptance Criteria

### Visual / brand

- Homepage uses the Y2K Chrome aesthetic from `08-y2k-chrome.html`: chrome buttons, dithered background, marquee, beveled window chrome, hot pink, cyber cyan, acid green, hard-offset shadows, and pixel-stat accents.
- Docs, pricing, account, alternatives, legal, and trust pages use route-appropriate restraint.
- Exactly one canonical nav and one canonical footer render across the site.
- Mobile navigation works below `900px` with a hamburger drawer.

### Product clarity

- Homepage above fold says “Detect AI slop before it ships.”
- Homepage preserves the live demo and keeps it visible as a product proof panel.
- The product remains positioned as workflow/content-trust triage, not forensic authorship proof.
- Core action enums remain exact: `allow`, `revise`, `human_review`, `reject`.

### Audit/security

- Pricing calculator uses `.005`, not `.01`, for analyze-only text.
- Public HTML contains no `Tabiji` string.
- Broken curl `\n` literals are removed from rendered docs/use-case HTML.
- OpenAPI drift is fixed: text min length `20`, no deprecated `synthetic_risk` in required arrays, discriminator on `/v1/analyze` oneOf response, `429` response on paid POST endpoints.
- Browser 404s receive branded HTML; API/JSON clients still receive JSON 404.
- Security headers exist on HTML responses.
- `/.well-known/security.txt` exists and points to `security@veracityapi.com` and `/security`.
- DMARC and CAA are added in Cloudflare DNS.

### QA/deploy

- `npm test` passes.
- `npx tsc --noEmit` passes if TypeScript config supports it.
- Preview deploy succeeds before production deploy.
- Production smoke checks pass for all retained routes and verify expected 404 for unpublished routes.
- Lighthouse target: desktop ≥90, mobile ≥85 if achievable without compromising launch; document blockers if not.
- Rollback command/version is recorded in final report.

---

## Non-Goals

- No frontend framework migration.
- No SDK package release.
- No changes to pricing model beyond fixing stale/miscomputed copy/calculator.
- No API behavior changes except documented OpenAPI/spec corrections and HTML/marketing route unpublishing.
- No full lawyer-approved privacy/terms/DPA rewrite in this sprint. Add interim minimal notes and contact paths only.
- No public claims of forensic proof, student misconduct detection, or guaranteed AI-authorship detection.

---

## Phase 1 — Pre-flight + P0 Audit Fixes

These should land before visual work or in a separate first commit group. They reduce production risk immediately.

### Task 1.1 — Capture design/audit source of truth

**Objective:** Put source assets in-repo so future agents implement the selected design, not an imagined one.

**Files:**
- Create: `design/redesign-source/template.html`
- Create: `design/redesign-source/README.md`
- Create: `design/redesign-source/audit-decisions.md`

**Steps:**
1. Copy template:
   ```bash
   mkdir -p design/redesign-source
   cp ~/Desktop/veracityapi-redesigns/08-y2k-chrome.html design/redesign-source/template.html
   ```
2. Create `README.md` documenting:
   - selected direction: Y2K Chrome / retro-tech
   - tokens to preserve
   - components to port
   - loud/restrained/minimal usage rules
3. Create `audit-decisions.md` listing the resolved decisions from section 0.
4. Do not edit production code in this task.

**Verification:**
```bash
test -f design/redesign-source/template.html
test -f design/redesign-source/README.md
test -f design/redesign-source/audit-decisions.md
```

**Commit:** `docs: capture Y2K redesign source and audit decisions`

---

### Task 1.2 — Add/verify security headers on HTML responses

**Objective:** Add required browser security headers to all HTML responses without breaking JSON/API responses.

**Files:**
- Modify: `src/index.ts`
- Test: `test/siteRoutes.test.ts` or `test/securityHeaders.test.ts`

**Implementation:**
In or near `html(body: string, cache = true, status = 200): Response` in `src/index.ts`, add headers:

```ts
const securityHeaders: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy-report-only": "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://api.veracityapi.com",
};
```

**Steps:**
1. Add test that homepage response includes `strict-transport-security` and `x-content-type-options`.
2. Run the test to confirm it fails if headers missing.
3. Patch `html()` helper.
4. Run full tests.

**Verification:**
```bash
npm test
curl -sI https://veracityapi.com/ | grep -Ei 'strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy'
```

**Commit:** `feat(security): add browser security headers to html responses`

---

### Task 1.3 — Verify/update `/.well-known/security.txt`

**Objective:** Ensure the security contact route is published and correct.

**Files:**
- Modify if needed: `src/index.ts`
- Test: `test/siteRoutes.test.ts` or `test/securityTxt.test.ts`

**Known current state:** `src/index.ts` already appears to route `/.well-known/security.txt`; verify content and tests.

**Required content:**
```txt
Contact: mailto:security@veracityapi.com
Expires: 2027-05-12T00:00:00Z
Preferred-Languages: en
Canonical: https://veracityapi.com/.well-known/security.txt
Policy: https://veracityapi.com/security
```

**Verification:**
```bash
npm test
curl -s https://veracityapi.com/.well-known/security.txt | grep 'Contact: mailto:security@veracityapi.com'
```

**Commit:** `test(security): cover security.txt route` or `feat(security): publish security.txt`

---

### Task 1.4 — DNS-only DMARC + CAA checklist

**Objective:** Add required DNS records in Cloudflare and document verification.

**Files:**
- Create: `docs/ops/2026-05-12-dns-security-records.md`

**Records to add in Cloudflare DNS:**

```txt
_dmarc.veracityapi.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@veracityapi.com; pct=100; aspf=r; adkim=r"
veracityapi.com CAA 0 issue "pki.goog"
veracityapi.com CAA 0 issuewild ";"
veracityapi.com CAA 0 iodef "mailto:security@veracityapi.com"
```

**Verification commands:**
```bash
dig _dmarc.veracityapi.com TXT +short
dig veracityapi.com CAA +short
```

**Commit:** `docs(ops): document DNS security records`

---

### Task 1.5 — Fix pricing calculator overcharge

**Objective:** Correct analyze-only calculator rate from `.01` to `.005`.

**Files:**
- Modify: `src/pages.ts` or whichever file emits `/pricing` calculator JS
- Test: `test/pricing.test.ts` or `test/siteRoutes.test.ts`

**Test first:**
```ts
it("pricing calculator uses analyze-only rate", async () => {
  const res = await worker.fetch(new Request("https://veracityapi.com/pricing"), {} as any);
  const html = await res.text();
  expect(html).toMatch(/text\s*\*\s*\.005/);
  expect(html).not.toMatch(/text\s*\*\s*\.01(?!\d)/);
});
```

**Verification:**
```bash
npm test
```

**Commit:** `fix(pricing): correct analyze-only calculator rate`

---

### Task 1.6 — Remove Tabiji/client-name public leaks

**Objective:** Ensure no public rendered HTML contains `Tabiji`.

**Files:**
- Modify: `src/site.ts`
- Modify: `src/pages.ts`
- Modify: `src/discovery.ts` if machine-readable public copy includes it
- Test: `test/publicCopy.test.ts`

**Required replacement:**
- `Tabiji captions` → `your captions`
- `Dogfooded on Tabiji workflows` → `Dogfooded on a customer content pipeline`
- `Tabiji dogfooding: 16 pages...` → `Customer pipeline calibration: 16 pages...` or remove if too specific

**Test:** render representative routes and assert absence:
```ts
expect(html).not.toMatch(/Tabiji/i);
```

**Routes to test:** `/`, `/docs`, `/for-agents`, `/evals`, `/use-cases`, `/use-cases/social-caption-preflight`, `/llms.txt`, `/agents.json`.

**Commit:** `fix(copy): remove public customer-name leaks`

---

### Task 1.7 — Unpublish vaporware/risky routes

**Objective:** Remove pages we do not want indexed or publicly accessible.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/distribution.ts`
- Modify: `src/discovery.ts`
- Modify: `src/index.ts` if route handlers need explicit 404 guard
- Test: `test/siteRoutes.test.ts`

**Routes to return 404:**
- `/use-cases/audio-customer-support-call-qa`
- `/alternatives/reality-defender`
- `/alternatives/resemble-detect`

**Steps:**
1. Remove these entries from source arrays (`USE_CASES`, `DISTRIBUTION_PAGES`, alternative page arrays, comparison row maps, sitemap list construction).
2. Add tests that these exact paths return 404.
3. Verify sitemap no longer contains them.

**Verification:**
```bash
npm test
curl -s https://veracityapi.com/sitemap.xml | grep -E 'audio-customer-support-call-qa|reality-defender|resemble-detect' && exit 1 || true
```

**Commit:** `fix(routes): unpublish risky vaporware and alternatives pages`

---

### Task 1.8 — Fix use-case payload drift and zombie links

**Objective:** Patch stale public examples and redirect-link friction.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/distribution.ts`
- Test: `test/publicCopy.test.ts`

**Fixes:**
1. Change any rendered payload using `"intended_use":"train"` for customer-support QA to `"qa"` if the surrounding page remains. Since `/use-cases/audio-customer-support-call-qa` is unpublished, the main verification is that no public page still emits that stale payload.
2. Replace public nav links to `/categories/ai-detector-api` with direct `/ai-detection-api` links where the target is meant to be the canonical landing page.
3. Keep the redirect map for backward compatibility, but do not link to the redirected URL from public navs.

**Verification:**
```bash
npm test
```

**Commit:** `fix(copy): correct stale examples and direct-link category nav`

---

### Task 1.9 — Fix OpenAPI spec drift

**Objective:** Align `/openapi.json` with the live API contract and agent expectations.

**Files:**
- Modify: `src/discovery.ts`
- Test: `test/openapi.test.ts` or existing discovery tests

**Fixes:**
1. `UnifiedAnalyzeRequest.content.minLength`: `1` → `20`.
2. Remove deprecated `synthetic_risk` from required arrays for text/image/audio response schemas. Keep the field if needed with `deprecated: true`, but it cannot be required.
3. Add discriminator to `POST /v1/analyze` `200` oneOf response:
   ```json
   "discriminator": {
     "propertyName": "modality",
     "mapping": {
       "text": "#/components/schemas/AnalyzeTextResponse",
       "image": "#/components/schemas/AnalyzeImageResponse",
       "audio": "#/components/schemas/AnalyzeAudioResponse"
     }
   }
   ```
4. Add reusable `RateLimited` response and `429` to paid POST endpoints.

**Verification:**
```bash
npm test
curl -s https://veracityapi.com/openapi.json | jq '.paths["/v1/analyze"].post.responses["200"]'
```

**Commit:** `fix(openapi): align schema with live analyze contract`

---

### Task 1.10 — Content-negotiated HTML 404

**Objective:** Browser users get a branded 404, API clients keep JSON shape.

**Files:**
- Modify: `src/index.ts`
- Create or modify: `src/site/components.ts` if shared 404 component exists after extraction
- Test: `test/siteRoutes.test.ts`

**Implementation rule:**
- If `Accept` contains `text/html` and path is not an API path, return `html(notFoundHtml(path), true, 404)`.
- If `Accept` prefers JSON or path starts with `/v1/`, `/demo/`, `/api-keys/`, `/extension/`, keep `json({ error: "not_found" }, 404)`.

**Test cases:**
```ts
it("serves html 404 to browsers", async () => {
  const res = await worker.fetch(new Request("https://veracityapi.com/missing", { headers: { accept: "text/html" } }), {} as any);
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type") || "").toContain("text/html");
});

it("serves json 404 to api clients", async () => {
  const res = await worker.fetch(new Request("https://veracityapi.com/v1/missing", { headers: { accept: "application/json" } }), {} as any);
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type") || "").toContain("application/json");
});
```

**Commit:** `feat(404): serve branded html 404 to browsers`

---

## Phase 2 — Y2K Design System + Shared Primitives

### Task 2.1 — Extract shared constants and escaping

**Objective:** Reduce duplicated constants before large template edits.

**Files:**
- Create: `src/site/shared.ts`
- Modify: `src/site.ts`
- Modify: `src/pages.ts`
- Modify: `src/account.ts`
- Modify: `src/distribution.ts` if useful

**Implementation:**
```ts
export const BASE_URL = "https://veracityapi.com";
export const API_BASE_URL = "https://api.veracityapi.com";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[c] || c));
}
```

**Verification:** `npm test`

**Commit:** `refactor(site): share constants and html escaping`

---

### Task 2.2 — Port Y2K CSS tokens and base styles

**Objective:** Translate `08-y2k-chrome.html` into a central CSS module.

**Files:**
- Create: `src/site/styles.ts`
- Modify: `src/site.ts`
- Modify: `src/pages.ts`
- Modify: `src/account.ts`

**Tokens to implement:**
```css
:root {
  color-scheme: light;
  --bg: #d8d6d2;
  --paper: #f0ede7;
  --ink: #0a0a0a;
  --text: #1a1a1a;
  --muted: #5a564f;
  --hot-pink: #ff2d8a;
  --hot-pink-dark: #d0186c;
  --cyber-cyan: #00d4ff;
  --acid-green: #b8ff00;
  --warning-amber: #ffaa00;
  --chrome-1: #f4f4f2;
  --chrome-2: #d4d2cc;
  --chrome-3: #8c8a85;
  --shadow-3d: 2px 2px 0 var(--ink);
  --shadow-card: 6px 6px 0 var(--ink);
  --shadow-hero: 8px 8px 0 var(--ink);
  --sans: "Space Grotesk", system-ui, sans-serif;
  --mono: "Departure Mono", "JetBrains Mono", ui-monospace, monospace;
  --pixel: "VT323", "Departure Mono", monospace;
}
```

**Required CSS classes/patterns:**
- Dithered dot-grid `body` background.
- `.chrome`, `.chrome-fill`, `.chrome-dark` gradients ported from template.
- `.btn-chrome`, `.window-frame`, `.window-bar`, `.window-body`, `.marquee`, `.marquee-track`, `.bevel-card`, `.pixel-stat`, `.code-window`, `.price-card`.
- `:focus-visible { outline: 2px solid var(--hot-pink); outline-offset: 2px; }`.
- `@media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; transform: none; } }`.
- Route restraint selectors:
  ```css
  .page--restrained .marquee,
  .page--restrained .stamp-tag { display:none; }
  .page--restrained .btn-chrome { background: var(--paper); box-shadow:none; }
  .page--minimal .chrome,
  .page--minimal .marquee,
  .page--minimal .stamp-tag { display:none; }
  ```

**Verification:** `npm test`; browser render of `/` and `/docs` still works.

**Commit:** `feat(design): port Y2K chrome tokens and base css`

---

### Task 2.3 — Implement reusable HTML primitives

**Objective:** Stop duplicating page chrome and create primitives needed for homepage/docs/pricing.

**Files:**
- Create: `src/site/components.ts`
- Modify: `src/site.ts`
- Modify: `src/pages.ts`
- Modify: `src/account.ts`
- Modify: `src/distribution.ts`

**Components:**
```ts
type ButtonVariant = "default" | "pink" | "cyan" | "dark";

export function chromeButton(label: string, href: string, variant: ButtonVariant = "default"): string;
export function windowFrame(title: string, bodyHtml: string): string;
export function codeWindow(title: string, code: string): string;
export function marqueeTicker(items: string[]): string;
export function bevelCard(opts: { title?: string; eyebrow?: string; bodyHtml: string; tone?: "pink" | "cyan" | "green" | "amber" }): string;
export function pixelStat(label: string, value: string): string;
export function navHtml(active?: string): string;
export function footerHtml(): string;
export function cookieBannerHtml(): string;
export function notFoundHtml(path: string): string;
```

**Nav/footer requirements:**
- Nav primary links: Docs, Evals, For agents, Pricing.
- CTA: Get API key → `/account`.
- Footer includes: Docs, Evals, Use cases, MCP, For agents, Pricing, Status, Changelog, Privacy, Terms, Security, About, OpenAPI, llms.txt.
- No nav/footer variant drift.

**Verification:** Render `/`, `/docs`, `/pricing`, `/account`; each includes one nav and one footer.

**Commit:** `refactor(site): add Y2K components and canonical nav/footer`

---

### Task 2.4 — Route-aware layout modes

**Objective:** Enforce loud/restrained/minimal usage without relying on implementer taste.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/site.ts`
- Modify: `src/account.ts`
- Modify: `src/distribution.ts`

**Mode mapping:**
- `page--loud`: `/`, `/use-cases`, `/for-agents`, `/mcp`, `/evals`, category/integration marketing pages.
- `page--restrained`: `/docs`, `/pricing`, `/account`, `/alternatives/*`, `/status`, `/changelog`.
- `page--minimal`: `/privacy`, `/terms`, `/security`, `/subprocessors`, `/about`, future `/dpa`.

**Verification:** HTML source contains correct body class for representative routes.

**Commit:** `feat(layout): add loud restrained minimal page modes`

---

## Phase 3 — Homepage Redesign: Loud Y2K

### Task 3.1 — Rebuild hero using Y2K template layout

**Objective:** Make the first screen match the selected design and sharpen product positioning.

**Files:**
- Modify: `src/site.ts`
- Modify: `src/site/styles.ts`

**Required content:**
- Banner/stamp: `SYSTEM ONLINE · v0.1 · CONTENT TRUST GATE`
- H1: `Detect AI slop before it ships.`
- Lead: `Score text, images, and audio in one HTTP call — get a routing action your code can branch on, not a black-box probability.`
- Primary CTA: `/account` label `get api key`
- Secondary CTA: `/docs` label `read docs`
- Stamp tags: `$1.50 starter credit`, `OpenAPI`, `MCP`, `llms.txt`, `no raw media stored`
- Right side: `windowFrame("veracityapi://demo/analyze", ...)` containing the live demo panel.

**Hard constraint:** Preserve current demo IDs used by `js()` including `text`, `sampleSelect`, `format`, `use`, `domain`, `run`, and result IDs.

**Verification:** Local browser: hero fits desktop above fold; mobile stacks; no console errors.

**Commit:** `feat(home): ship Y2K chrome hero and demo window`

---

### Task 3.2 — Add marquee ticker with reduced-motion guard

**Objective:** Add distinctive Y2K motion without accessibility regression.

**Files:**
- Modify: `src/site.ts`
- Modify: `src/site/styles.ts`

**Ticker items:**
`POST /v1/analyze`, `4 routing actions`, `Text · Image · Audio`, `TypeScript + Python SDKs`, `MCP`, `OpenAPI`, `$1.50 starter credit`, `store_content=false`.

**Verification:** In reduced-motion mode animation is disabled.

**Commit:** `feat(home): add Y2K marquee ticker`

---

### Task 3.3 — Rebuild action-routing matrix

**Objective:** Make `recommended_action` the visual anchor.

**Files:**
- Modify: `src/site.ts`

**Cards:**
- `allow` — low-risk content can proceed.
- `revise` — return to agent/editor with evidence and fixes.
- `human_review` — queue uncertain/high-impact content for review.
- `reject` — block/quarantine according to local policy.

**Verification:** Exact enum strings appear in rendered homepage.

**Commit:** `feat(home): add bevel-card routing matrix`

---

### Task 3.4 — Add developer code/terminal section

**Objective:** Appeal directly to developers with concrete API usage and response shape.

**Files:**
- Modify: `src/site.ts`

**Content:**
- `codeWindow("curl", ...)` with a one-line or `.join("\n")` generated curl example to avoid escaped-newline rendering bugs.
- `codeWindow("response", ...)` with sample JSON containing `recommended_action`, `risk_level`, `evidence`, `limitations`.

**Verification:** Rendered HTML does not contain broken literal `\n -H` curl sequences.

**Commit:** `feat(home): add Y2K code windows for curl and response`

---

### Task 3.5 — Consolidate homepage features to exactly three cards

**Objective:** Remove card fatigue and focus the homepage.

**Files:**
- Modify: `src/site.ts`

**Feature grid cards:**
1. `Built for agent checkpoints`
2. `Every response is routable`
3. `Privacy by default`

**Verification:** Homepage still links to `/docs`, `/for-agents`, `/mcp`, `/evals`, `/pricing`, `/account`, `/openapi.json`, `/llms.txt`.

**Commit:** `feat(home): consolidate proof sections into three Y2K cards`

---

## Phase 4 — Inner Pages: Restrained + Minimal Y2K

### Task 4.1 — Docs page redesign + docs audit fixes

**Objective:** Make `/docs` high-trust and developer-readable while fixing stale snippets.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/site/styles.ts`

**Requirements:**
- `page--restrained` mode.
- Sidebar layout retained.
- Curl examples rendered via `codeWindow()`.
- No broken `\n` literals.
- Add tables for:
  - error status codes
  - rate limit headers
  - request IDs / debugging
- Keep anchors: `#quickstart`, `#endpoints`, `#policy`, `#routing`, `#sdks`, `#media`, `#privacy`.

**Verification:** `/docs` renders, anchors work, tests assert no broken curl literals.

**Commit:** `feat(docs): restrained Y2K docs with errors and rate limits`

---

### Task 4.2 — Pricing + account redesign

**Objective:** Improve conversion without breaking billing/auth forms.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/account.ts`
- Modify: `src/index.ts` if login messaging needs adjustment

**Pricing:**
- `page--restrained`.
- Three `.price-card` tiers.
- Highlight `Team` with featured border and slight negative `translateY`.
- Include starter credit, modality pricing, and `/v1/balance` preflight copy.

**Account:**
- Preserve every existing form `action=` and input `name=` exactly unless tests are updated deliberately.
- Keep magic-link anti-enumeration: for valid-looking emails, response should be generic: `If that email can receive a login link, we'll send one.`
- Keep rate limit messaging for actual quota failures.

**Verification:** Existing account/auth tests pass; pricing calculator test passes.

**Commit:** `feat(account): restrained Y2K pricing and account surfaces`

---

### Task 4.3 — Use-case template redesign + schema cleanup

**Objective:** Make use-case pages scannable and safe.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/discovery.ts` if sitemap uses use-case list

**Requirements:**
- Add `Built for:` persona pill row.
- Use restrained cards, no loud chrome overload.
- Change invalid `HowTo` JSON-LD to `TechArticle`, or add a real `step` array if retaining HowTo.
- Ensure unpublished customer-support route is absent.
- Add related-use-cases block.

**Verification:** `/use-cases` and `/use-cases/publishing-pipeline-quality-gate` return 200; unpublished route returns 404.

**Commit:** `feat(use-cases): restrained Y2K template and schema cleanup`

---

### Task 4.4 — Alternatives page decisions

**Objective:** Remove risky alternatives and make remaining alternatives factual.

**Files:**
- Modify: `src/distribution.ts`
- Modify: `src/pages.ts` if older alternative arrays still serve pages
- Modify: `src/discovery.ts`

**Actions:**
- 404: `/alternatives/reality-defender`.
- 404: `/alternatives/resemble-detect`.
- Rewrite `/alternatives/gptzero-api` to avoid student accusation framing and authorship-proof claims.
- Rewrite `/alternatives/copyleaks-api` to avoid unverified procurement/self-serve claims.
- Add `Last updated: 2026-05-12` and standard disclaimer to all retained alternatives.
- Replace any emoji checkmark logo with the Veracity SVG/cube mark.

**Verification:** Tests for 404 routes and factual retained pages.

**Commit:** `fix(alternatives): unpublish risky competitors and rewrite retained pages`

---

### Task 4.5 — Legal, trust, and about pages

**Objective:** Add founder credibility while keeping legal content honest.

**Files:**
- Modify: `src/pages.ts`
- Modify: `src/index.ts` route map
- Modify: `src/discovery.ts` sitemap/agents/llms if needed

**Actions:**
- Create `/about` in `page--minimal` mode.
- Copy: disclose Bernard Huang, Clearscope background, and VeracityAPI’s product thesis without overclaiming.
- Add interim notes to `/privacy` and `/terms`: under review with counsel; DPA/data handling questions → `privacy@veracityapi.com`.
- Keep `/security` minimal and operational.

**Verification:** `/about`, `/privacy`, `/terms`, `/security` all return 200 and use minimal style.

**Commit:** `feat(trust): add about page and minimal legal trust surfaces`

---

## Phase 5 — Mobile, Accessibility, Cookies, Performance

### Task 5.1 — Mobile hamburger drawer

**Objective:** Fix mobile nav below 900px.

**Files:**
- Modify: `src/site/components.ts`
- Modify: `src/site/styles.ts`
- Modify: homepage/layout JS if needed

**Spec:**
- Breakpoint: `max-width: 900px`.
- 44×44 hamburger button.
- Drawer slides from right.
- Trap focus while open.
- Close on Escape.
- Lock body scroll while open.
- CTA at bottom: `Get API key`.

**Verification:** Browser QA at 360px, 768px, 900px; keyboard-only nav works.

**Commit:** `feat(mobile): add hamburger drawer with focus trap`

---

### Task 5.2 — Opt-in cookie banner + deferred analytics

**Objective:** GA4/analytics loads only after explicit consent.

**Files:**
- Modify: `src/index.ts` `injectGoogleAnalytics()` or equivalent
- Modify: `src/site/components.ts`
- Modify: `src/site/styles.ts`
- Add route/page if needed: `/cookies`

**Spec:**
- Bottom pinned `.chrome-dark` banner.
- Buttons: `Accept`, `Decline`.
- Store `localStorage.setItem("cookie_consent", "accepted" | "declined")`.
- Analytics script must only be injected or initialized when consent is accepted.
- If server-side injection cannot know localStorage, inject a tiny consent loader that conditionally appends GA script client-side after acceptance.

**Verification:** Browser network tab: no GA request before accept; GA request after accept; no banner after stored decision.

**Commit:** `feat(consent): add opt-in cookie banner and defer analytics`

---

### Task 5.3 — Accessibility pass

**Objective:** Avoid Y2K style causing contrast/motion/focus regressions.

**Files:**
- Modify: `src/site/styles.ts`
- Modify: affected templates for alt text / heading order

**Checks:**
- `--hot-pink-dark` for any text-on-pink context that fails AA.
- VT323 used only for decorative stats, never body copy.
- `prefers-reduced-motion` disables marquee.
- `:focus-visible` always visible.
- Add skip link to `#main`.
- Home demo image alt is descriptive, not `Image preview`.
- Heading hierarchy does not skip levels in main templates.

**Verification:** Manual keyboard pass + axe/Lighthouse accessibility run.

**Commit:** `feat(a11y): add focus skip-link contrast and motion safeguards`

---

### Task 5.4 — Fonts and OG image

**Objective:** Improve polish and social sharing without hurting performance.

**Files:**
- Add: `public/fonts/*` or Worker-served font assets if current project supports public assets
- Add: `public/og.png` or Worker route/module serving `/og.png`
- Modify: page head meta in `src/site.ts` / `src/pages.ts`

**Requirements:**
- Self-host or efficiently load `Space Grotesk`, `Departure Mono`, and `VT323` with `font-display: swap`.
- Preload primary weights if self-hosted.
- Generate 1200×630 PNG of Y2K hero and use it for `og:image` / Twitter card.
- Preserve existing `/og.svg` only as fallback if desired.

**Verification:** `/og.png` returns `image/png`; homepage meta points to `.png`.

**Commit:** `perf(brand): self-host fonts and add Y2K og image`

---

## Phase 6 — Test Coverage, Preview, Production Deploy

### Task 6.1 — Stronger smoke/regression tests

**Objective:** Encode known audit failures so they do not regress.

**Files:**
- Create or modify: `test/siteRoutes.test.ts`
- Create or modify: `test/publicCopy.test.ts`
- Create or modify: `test/openapi.test.ts`

**Minimum tests:**
```ts
const retainedHtmlRoutes = [
  "/", "/docs", "/pricing", "/evals", "/methodology", "/trust-model",
  "/for-agents", "/mcp", "/account", "/use-cases", "/about", "/privacy", "/terms", "/security"
];

const unpublishedRoutes = [
  "/use-cases/audio-customer-support-call-qa",
  "/alternatives/reality-defender",
  "/alternatives/resemble-detect",
];
```

Assertions:
- Retained routes return 200 HTML.
- Unpublished routes return 404.
- Rendered public HTML does not contain `Tabiji`.
- Rendered public HTML does not contain broken curl literal pattern `/curl\s+https[^<]*\\n\s+-H/`.
- Pricing contains `.005` rate and not stale `.01` analyze-only multiplier.
- Homepage meta `og:image` points to `.png`.
- HTML responses include security headers.
- `/openapi.json`, `/llms.txt`, `/agents.json`, `/sitemap.xml`, `/robots.txt` return expected status/content-type.
- Sitemap does not list unpublished routes.

**Verification:** `npm test`

**Commit:** `test: cover Y2K redesign audit regressions`

---

### Task 6.2 — Local browser QA

**Objective:** Verify visual and JS behavior before deploy.

**Files:**
- Create: `design/redesign-qa/notes.md`
- Add screenshots under: `design/redesign-qa/`

**Steps:**
1. Start local dev:
   ```bash
   npm run dev
   ```
2. Browser-check:
   - `/`
   - `/docs`
   - `/pricing`
   - `/account`
   - `/use-cases`
   - `/alternatives/gptzero-api`
   - `/about`
3. Run text/image/audio demo if env supports it; otherwise verify preloaded samples and no console errors.
4. Check mobile at 360/768/900px.
5. Check cookie banner behavior.
6. Record screenshots and issues.

**Verification:** No blocking console errors; no broken mobile nav; demo IDs still work.

**Commit:** `docs: record Y2K redesign visual QA`

---

### Task 6.3 — Preview deploy

**Objective:** Validate on Cloudflare before production.

**Commands:**
```bash
npm test
npx tsc --noEmit || true
wrangler deployments list | head -10
wrangler deploy --env preview
```

**Preview smoke loop:**
```bash
BASE="https://<preview-url>"
for p in / /docs /pricing /evals /methodology /trust-model /for-agents /mcp /account /use-cases /about /privacy /terms /security /llms.txt /llms-full.txt /agents.json /.well-known/agents.json /openapi.json /sitemap.xml /robots.txt /.well-known/security.txt; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} %{url_effective}\n" "$BASE$p"
done
for p in /use-cases/audio-customer-support-call-qa /alternatives/reality-defender /alternatives/resemble-detect; do
  curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE$p"
done
```

**Manual preview QA:**
- Homepage interactive demo.
- Cookie banner: before/after accept.
- Mobile menu focus/escape.
- Lighthouse desktop/mobile for `/` and `/docs`.

**Commit:** none unless fixes are needed.

---

### Task 6.4 — Production deploy + rollback record

**Objective:** Ship safely and leave rollback instructions.

**Steps:**
1. Record previous production deployment:
   ```bash
   wrangler deployments list | head -10
   ```
2. Deploy:
   ```bash
   npm test
   npm run deploy
   ```
3. Run production smoke loop against `https://veracityapi.com`.
4. Verify unpublished routes return 404.
5. Verify `/openapi.json`, `/llms.txt`, `/agents.json` still load.
6. Capture Lighthouse scores.
7. Record rollback command:
   ```bash
   wrangler rollback --version-id <PREV_VERSION_ID>
   ```

**Commit:** none unless post-deploy fixes are required.

---

## Production Smoke Checklist

Run after production deploy:

```bash
BASE="https://veracityapi.com"
for p in / /docs /pricing /evals /methodology /trust-model /for-agents /mcp /account /use-cases /about /privacy /terms /security /llms.txt /llms-full.txt /agents.json /.well-known/agents.json /openapi.json /sitemap.xml /robots.txt /.well-known/security.txt; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} %{url_effective}\n" "$BASE$p"
done

for p in /use-cases/audio-customer-support-call-qa /alternatives/reality-defender /alternatives/resemble-detect; do
  curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE$p"
done

curl -sI "$BASE/" | grep -Ei 'strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy'
curl -s "$BASE/sitemap.xml" | grep -E 'audio-customer-support-call-qa|reality-defender|resemble-detect' && echo "BAD: unpublished route in sitemap" || echo "OK: unpublished routes absent"
curl -s "$BASE/" | grep -i Tabiji && echo "BAD: Tabiji leak" || echo "OK: no Tabiji on homepage"
```

Expected:
- Retained routes: `200`.
- Unpublished routes: `404`.
- Security headers present.
- No unpublished routes in sitemap.
- No public `Tabiji` leaks.

---

## Suggested Execution Order

### Day 1 — Risk fixes first
1. Tasks 1.1–1.10.
2. Tests passing.
3. Optional deploy of P0 fixes before visual redesign.

### Day 2 — Design system + homepage
1. Tasks 2.1–2.4.
2. Tasks 3.1–3.5.
3. Browser QA homepage and demos.

### Day 3 — Inner pages + mobile/cookies
1. Tasks 4.1–4.5.
2. Tasks 5.1–5.4.
3. Full local QA.

### Day 4 — Preview + production
1. Tasks 6.1–6.4.
2. Final report.

---

## Final Report Template

```md
## VeracityAPI Y2K Chrome redesign + audit sprint shipped

- Repo: /Users/psy/projects/veracityapi
- Commit: <sha>
- Previous Wrangler version: <prev-version-id>
- New Wrangler version: <new-version-id>
- Preview URL: <preview-url>
- Production URL: https://veracityapi.com
- Design source: design/redesign-source/template.html

### Redesign delivered
- Homepage: Y2K Chrome hero, chrome demo window, marquee, action matrix, code windows.
- Shared tokens/components: chromeButton, windowFrame, codeWindow, marqueeTicker, bevelCard, pixelStat, canonical nav/footer.
- Inner pages: docs/pricing/account/use-cases/alternatives/legal using loud/restrained/minimal modes.
- Mobile hamburger and opt-in cookie banner.

### Audit/security fixes delivered
- [ ] Security headers
- [ ] security.txt
- [ ] DNS DMARC + CAA verified
- [ ] Pricing calculator `.005`
- [ ] No public Tabiji leaks
- [ ] OpenAPI drift fixed
- [ ] Broken curl literals fixed
- [ ] HTML 404 + JSON API 404 preserved
- [ ] Risky/vaporware pages unpublished
- [ ] GPTZero/Copyleaks factual rewrites
- [ ] About page with Bernard/Clearscope credibility
- [ ] Cookie opt-in and deferred analytics
- [ ] OG PNG

### Verification
- npm test: <pass/fail, count>
- Typecheck: <pass/fail or not configured>
- Preview deploy: <pass/fail>
- Production deploy: <pass/fail>
- Smoke routes: <all retained 200, unpublished 404>
- Lighthouse: homepage mobile/desktop, docs mobile/desktop
- A11y: <notes>
- Cookie banner: <verified>
- Demo JS: <verified>

### Rollback
```bash
wrangler rollback --version-id <PREV_VERSION_ID>
```

### Known follow-ups
- Lawyer-reviewed privacy/terms/DPA/AUP.
- Real external status page.
- Customer logos/case studies.
- Formal benchmark expansion beyond current eval proof.
```
