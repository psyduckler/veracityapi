# VeracityAPI Image Trust Scoring MVP Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Add an MVP image analysis feature to VeracityAPI that scores image trust, synthetic-image risk, provenance weakness, visual artifact risk, metadata integrity risk, and context consistency for agent workflows.

**Architecture:** Add a new `POST /v1/analyze-image` endpoint beside the existing text analysis endpoint. The Worker fetches an image URL, validates and temporarily stores the image in Cloudflare R2, extracts metadata, runs a structured multimodal scoring pass, stores privacy-safe analysis logs in D1, debits prepaid account balance, and returns normalized decision-oriented JSON.

**Tech Stack:** Cloudflare Worker, TypeScript, Cloudflare D1, Cloudflare R2, existing API-key auth/billing ledger, Anthropic or equivalent multimodal model, OpenAPI/llms.txt/agents.json discovery surfaces.

---

## 1. Product Positioning

Do **not** position this as a definitive AI image detector.

Use:

- image trust scoring
- synthetic-image risk
- provenance weakness
- visual artifact risk
- metadata integrity risk
- context consistency
- recommended action

Avoid:

- AI-generated proof
- authorship proof
- “97% AI-generated” claims
- binary real/fake language

The API should answer:

> “Should an agent trust this image enough to publish, cite, summarize, use in training data, attach to a claim, or route to human review?”

It should not claim:

> “This image was definitely made by AI.”

Core disclaimer to include in docs and response metadata:

```text
VeracityAPI returns probabilistic workflow-risk signals. A high synthetic-image risk score means review-worthy risk, not proof of AI authorship.
```

---

## 2. MVP Scope

### Build in v0

- `POST /v1/analyze-image`
- `image_url` input only
- JPEG, PNG, WebP support
- Cloudflare R2 temporary storage
- Cloudflare D1 image analysis log table
- API-key auth using existing account system
- prepaid billing debit using existing ledger pattern
- flat image analysis price
- structured multimodal image scoring
- metadata extraction
- privacy mode defaulting to no retained image
- OpenAPI, `llms.txt`, `agents.json`, docs, examples, pricing copy updates
- tests with mocked image provider
- small seed eval set for calibration

### Do not build yet

- browser upload dashboard
- presigned uploads
- batch image endpoint
- reverse image search
- C2PA verification UI
- heatmaps/localization
- video detection
- pHash duplicate search
- user image library
- public benchmark claims
- model marketplace

---

## 3. Endpoint Design

### Endpoint

```http
POST /v1/analyze-image
Authorization: Bearer vap_...
Content-Type: application/json
```

### Request

```json
{
  "image_url": "https://example.com/image.jpg",
  "context": {
    "intended_use": "publishing_pipeline",
    "claim": "Photo of a street protest in Paris",
    "source_url": "https://example.com/article",
    "platform": "instagram",
    "needs_human_review_threshold": 0.7
  },
  "store_content": false,
  "retain_image": false,
  "execution_mode": "fast"
}
```

### MVP request schema

```ts
type AnalyzeImageRequest = {
  image_url?: string;
  context?: {
    intended_use?:
      | "publishing_pipeline"
      | "social_post"
      | "ugc_moderation"
      | "training_data"
      | "news_claim"
      | "marketplace_listing"
      | "other";
    claim?: string;
    source_url?: string;
    platform?: string;
    audience?: string;
    needs_human_review_threshold?: number;
  };
  store_content?: boolean; // default false; legacy privacy_mode?: boolean still accepted
  retain_image?: boolean;
  execution_mode?: "fast" | "deep";
};
```

For v0, implement only:

- `image_url`
- `context`
- `privacy_mode`
- `retain_image`
- `execution_mode = fast`

Reject or ignore `deep` until explicitly implemented.

### Response

```json
{
  "analysis_id": "img_01H...",
  "image_trust_score": 0.42,
  "synthetic_image_risk": 0.78,
  "provenance_weakness": 0.91,
  "visual_artifact_risk": 0.64,
  "metadata_integrity_risk": 0.88,
  "semantic_consistency_risk": 0.45,
  "risk_level": "high",
  "recommended_action": "human_review",
  "summary": "The image has weak provenance, missing useful metadata, and several visual inconsistencies around hands, signage, and background geometry.",
  "evidence": [
    {
      "type": "visual_artifact",
      "label": "hand_detail_inconsistency",
      "description": "Fingers appear partially fused and inconsistent with surrounding anatomy.",
      "confidence": 0.71
    },
    {
      "type": "metadata",
      "label": "missing_camera_metadata",
      "description": "No camera model, lens, timestamp, or GPS metadata was available.",
      "confidence": 0.83
    }
  ],
  "image": {
    "mime_type": "image/jpeg",
    "width": 1200,
    "height": 1600,
    "byte_size": 524288,
    "sha256_prefix": "a1b2c3d4e5f6"
  },
  "billing": {
    "charged_cents": 2,
    "pricing_unit": "image_fast"
  },
  "model_notes": {
    "not_authorship_proof": true,
    "limitations": [
      "Screenshots, compressed social images, edited exports, and CDN-resized images often lack useful metadata.",
      "A high score means review-worthy risk, not definitive synthetic authorship."
    ]
  }
}
```

### Response TypeScript shape

```ts
type AnalyzeImageResponse = {
  analysis_id: string;
  image_trust_score: number;
  synthetic_image_risk: number;
  provenance_weakness: number;
  visual_artifact_risk: number;
  metadata_integrity_risk: number;
  semantic_consistency_risk: number;
  risk_level: "low" | "medium" | "high";
  recommended_action: "allow" | "warn" | "human_review" | "reject";
  summary: string;
  evidence: Array<{
    type:
      | "visual_artifact"
      | "metadata"
      | "provenance"
      | "semantic_consistency"
      | "limitation";
    label: string;
    description: string;
    confidence: number;
  }>;
  image: {
    mime_type: string;
    width?: number;
    height?: number;
    byte_size: number;
    sha256_prefix: string;
  };
  billing: {
    charged_cents: number;
    pricing_unit: "image_fast";
  };
  model_notes: {
    not_authorship_proof: true;
    limitations: string[];
  };
};
```

---

## 4. Storage Plan

Use Cloudflare R2 for image blobs and Cloudflare D1 for analysis metadata/results.

### R2 bucket

Create one bucket:

```text
veracityapi-images
```

Add Worker binding:

```toml
[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "veracityapi-images"
```

Use prefixes:

```text
tmp/{account_id}/{analysis_id}/original
retained/{account_id}/{analysis_id}/original
evals/{analysis_id}/original
```

### Retention policy

Default:

```json
{
  "store_content": false,
  "retain_image": false
}
```

Default behavior:

- Store image temporarily for analysis.
- Delete after analysis when possible.
- Also configure lifecycle expiration for `tmp/*` as a safety net.
- Store hash/dimensions/MIME/byte size/results in D1.
- Do not store full raw image in privacy mode.

Suggested lifecycle:

```text
tmp/*       delete after 24 hours
retained/* delete after 30 days unless explicitly extended
evals/*    manually curated only
```

### D1 table

Add to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS image_analysis_logs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,

  source_type TEXT NOT NULL, -- image_url | upload
  source_url_domain TEXT,
  image_r2_key TEXT,

  privacy_mode INTEGER NOT NULL DEFAULT 1,
  retained_image INTEGER NOT NULL DEFAULT 0,

  mime_type TEXT,
  byte_size INTEGER,
  width INTEGER,
  height INTEGER,
  sha256 TEXT,

  image_trust_score REAL,
  synthetic_image_risk REAL,
  provenance_weakness REAL,
  visual_artifact_risk REAL,
  metadata_integrity_risk REAL,
  semantic_consistency_risk REAL,

  risk_level TEXT,
  recommended_action TEXT,
  summary TEXT,
  evidence_json TEXT,
  raw_provider_json TEXT,

  charged_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_image_analysis_logs_account_created
  ON image_analysis_logs(account_id, created_at DESC);
```

Privacy rule:

- If `store_content=false`, store `raw_provider_json = NULL` unless sanitized.
- If `retain_image=false`, store `image_r2_key = NULL` after deletion or store only a temporary key that no longer exists.
- Store `source_url_domain`, not full URL, by default.

---

## 5. Image Ingestion Rules

MVP supports remote image URLs only.

Validation:

```text
Max file size: 8 MB
Supported MIME types: image/jpeg, image/png, image/webp
Max dimensions: 4096 x 4096
Timeout target: 10-20 seconds
Redirects: allow limited redirects only
Private IP / localhost URLs: block
```

Server-side fetch protections:

- Require `https://` URLs unless explicitly testing locally.
- Block `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local, and metadata IP ranges.
- Enforce `Content-Length` if present.
- Stream or abort if response exceeds max bytes.
- Validate actual bytes/MIME, not just extension.

---

## 6. Scoring Model

Do not expose `ai_percent`.

Expose:

```json
"synthetic_image_risk": 0.78
```

Human-friendly copy can say:

```text
78% synthetic-risk score
```

Not:

```text
78% AI-generated
```

### MVP score composition

Initial normalized score:

```text
synthetic_image_risk =
  35% visual_artifact_risk
  25% metadata_integrity_risk
  20% provenance_weakness
  15% semantic_consistency_risk
   5% known-source / duplicate signal
```

For v0, the known-source signal can be `0` or omitted internally until reverse image / pHash exists.

### Core score fields

#### `synthetic_image_risk`

Likelihood the image contains synthetic-generation traits.

Signals:

- anatomy artifacts
- hallucinated text
- impossible details
- unnatural object boundaries
- repeated patterns
- over-smoothed/generated texture
- inconsistent reflections/shadows
- latent diffusion-like background mush

#### `provenance_weakness`

How weak the sourcing is.

Signals:

- no useful metadata
- image URL is CDN/social repost
- source domain is weak or unknown
- claim/source mismatch
- no timestamp/camera context
- obvious screenshot/repost/compression chain
- context says “news/photo evidence” but image looks like generic stock/generated art

#### `metadata_integrity_risk`

Whether metadata supports or weakens trust.

Signals:

- missing EXIF
- suspicious software tag
- edited/exported tool metadata
- inconsistent timestamps
- impossible camera metadata
- dimensions/compression inconsistent with claimed source

Important: missing metadata is not strong AI evidence. Treat it as provenance weakness.

#### `visual_artifact_risk`

Pure visual artifact assessment.

Signals:

- hands/faces
- eyes/teeth
- text/signage
- logos
- shadows
- reflections
- perspective
- repeated textures
- object merging
- boundary weirdness

#### `semantic_consistency_risk`

Whether the image makes sense relative to supplied context.

Example context:

```json
{
  "claim": "A real photo of the Eiffel Tower during a snowstorm today"
}
```

Risk signals:

- summer foliage
- impossible skyline
- no weather evidence
- landmarks arranged incorrectly
- visual content contradicts supplied claim

---

## 7. Recommended Action Logic

Normalize into the same workflow behavior as text scoring:

```text
allow
warn
human_review
reject
```

Suggested scoring:

```ts
const risk = Math.max(
  synthetic_image_risk,
  provenance_weakness * 0.85,
  semantic_consistency_risk
);

let recommended_action: "allow" | "warn" | "human_review" | "reject";
let risk_level: "low" | "medium" | "high";

if (risk < 0.4) {
  recommended_action = "allow";
  risk_level = "low";
} else if (risk < 0.7) {
  recommended_action = "warn";
  risk_level = "medium";
} else if (risk < 0.85) {
  recommended_action = "human_review";
  risk_level = "high";
} else {
  recommended_action = "reject";
  risk_level = "high";
}
```

`reject` should be rare. For ambiguous/high-risk images, `human_review` is usually the honest action.

---

## 8. Provider Design

Add a small provider abstraction so the MVP can start with a multimodal model and later add specialized detectors.

```ts
interface ImageRiskProvider {
  analyze(input: {
    imageBytes: ArrayBuffer;
    mimeType: string;
    metadata: ImageMetadata;
    context?: ImageAnalysisContext;
  }): Promise<ImageRiskProviderResult>;
}
```

Provider roadmap:

```text
v0: vision LLM + metadata heuristic
v1: add specialized synthetic-image detector
v2: ensemble detector + provenance + reverse-image/context signals
```

### Multimodal rubric

Prompt the provider to inspect observable evidence only:

1. Anatomy consistency
   - hands
   - eyes
   - teeth
   - ears
   - limbs
   - reflections of people

2. Text/logos/signage
   - garbled text
   - fake alphabets
   - inconsistent brand marks
   - impossible typography

3. Geometry and physics
   - impossible shadows
   - inconsistent light direction
   - warped perspective
   - objects merging into each other
   - broken reflections
   - inconsistent depth of field

4. Texture artifacts
   - over-smoothed skin
   - plastic surfaces
   - repeated micro-patterns
   - mushy details
   - unnatural background blending

5. Scene plausibility
   - implausible object relationships
   - inconsistent weather/lighting
   - crowd anomalies
   - impossible architecture

6. Provenance fit
   - Does the image match the claimed context?
   - Does it look like a screenshot, social repost, stock image, generated asset, camera photo, or edited composite?

Provider must return structured JSON only.

Example internal provider result:

```json
{
  "visual_artifact_risk": 0.64,
  "metadata_integrity_risk": 0.88,
  "provenance_weakness": 0.91,
  "semantic_consistency_risk": 0.45,
  "synthetic_image_risk": 0.78,
  "confidence": 0.67,
  "evidence": [
    {
      "category": "text",
      "finding": "Street sign contains letter-like but unreadable glyphs.",
      "risk_contribution": 0.18
    }
  ],
  "recommended_action": "human_review"
}
```

---

## 9. Pricing and Billing

MVP price:

```text
Image fast analysis: $0.02/request
```

Why:

- Easy to understand.
- Vision calls cost more than text.
- Fits existing prepaid-credit model.
- The `$1.50` signup credit gives 75 image checks.

Add a billing ledger type:

```text
image_analysis_debit
```

Response billing field:

```json
{
  "billing": {
    "charged_cents": 2,
    "pricing_unit": "image_fast"
  }
}
```

---

## 10. Implementation Files

Likely new files:

```text
src/imageTypes.ts
src/imageValidation.ts
src/imageMetadata.ts
src/imageScoring.ts
src/imageStorage.ts
src/imageRoutes.ts
test/imageAnalysis.test.ts
```

Likely modified files:

```text
src/index.ts
src/billing.ts
src/discovery.ts
src/pages.ts
src/site.ts
schema.sql
wrangler.toml
```

Add Env binding:

```ts
export interface Env {
  DB: D1Database;
  IMAGE_BUCKET: R2Bucket;
  ANTHROPIC_API_KEY: string;
}
```

Adapt exact Env type to current codebase conventions.

---

## 11. Request Flow

```text
Agent calls POST /v1/analyze-image with image_url
        ↓
Worker authenticates API key
        ↓
Worker checks balance >= 2 cents
        ↓
Worker fetches image with SSRF protections
        ↓
Validate MIME, size, dimensions
        ↓
Compute sha256 + basic metadata
        ↓
Temporarily store in R2
        ↓
Run image scoring provider
        ↓
Normalize scores + recommended action
        ↓
Write image_analysis_logs row
        ↓
Debit account balance
        ↓
Delete R2 object unless retain_image=true
        ↓
Return structured result
```

---

## 12. Agent-Facing Distribution

Update:

```text
/openapi.json
/llms.txt
/.well-known/agents.json
/docs
/examples
/use-cases
/pricing
```

Docs should include:

- endpoint description
- auth
- request schema
- response schema
- privacy/retention behavior
- billing
- limitations
- curl example
- agent policy snippets

### Publishing pipeline policy example

```ts
if (result.recommended_action === "reject") blockPublish();
if (result.recommended_action === "human_review") sendToEditor();
if (result.recommended_action === "warn") attachWarning();
if (result.recommended_action === "allow") continuePublishing();
```

### Training data curation policy example

```ts
if (result.synthetic_image_risk > 0.7) excludeFromHumanPhotoDataset();
if (result.provenance_weakness > 0.8) requireSourceLabel();
```

### UGC moderation policy example

```ts
if (result.semantic_consistency_risk > 0.7) queueForModerator();
```

---

## 13. Seed Evaluation Set

Create a small internal eval set before public launch:

```text
20 obvious AI images
20 real camera photos
20 edited/compressed social images
20 screenshots/memes
20 ambiguous stock-like images
```

For each item, manually label:

```json
{
  "expected_synthetic_risk": "low|medium|high",
  "expected_recommended_action": "allow|warn|human_review|reject",
  "notes": "why"
}
```

Evaluation goals:

- Avoid overclaiming.
- Correctly route suspicious images to review.
- Avoid calling normal compressed social images “AI” just because EXIF is missing.
- Produce evidence that feels useful to an agent.
- Keep recommendations consistent.

This is product calibration, not a public benchmark.

---

## 14. MVP Acceptance Criteria

### API

- `POST /v1/analyze-image` works with `image_url`.
- Requires bearer API key.
- Debits prepaid account balance.
- Returns stable structured JSON.
- Returns `analysis_id`.
- Returns `recommended_action`.
- Handles bad URLs safely.
- Handles unsupported formats.
- Handles oversized images.
- Blocks obvious SSRF/private-network fetches.

### Storage

- R2 bucket exists and is bound to Worker.
- Temp image objects are deleted after request or lifecycle-expired.
- D1 logs image analysis metadata/results.
- Privacy mode does not retain raw images.

### Docs and discovery

- OpenAPI includes image endpoint.
- `llms.txt` includes image endpoint.
- `agents.json` includes image capability.
- Pricing page includes image analysis cost.
- Docs include curl example.
- Use case pages mention image trust scoring where relevant.

### Tests

- Auth failure test.
- Insufficient balance test.
- Bad image URL test.
- Unsupported MIME test.
- Oversized image test.
- Successful image analysis test with mocked provider.
- Billing debit test.
- Privacy-mode storage behavior test.
- Discovery/OpenAPI snapshot or smoke test.

---

# Implementation Tasks

## Task 1: Add image analysis types

**Objective:** Define request/response/provider types for the image endpoint.

**Files:**

- Create: `src/imageTypes.ts`
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Add TypeScript types for request, context, response, image metadata, evidence, provider result, recommended action, and risk level.
2. Add validation helper or schema if current codebase uses a validation pattern.
3. Write tests for request defaults:
   - `store_content` defaults to `false` (legacy `privacy_mode` still accepted)
   - `retain_image` defaults to `false`
   - `execution_mode` defaults to `fast`
4. Run:

```bash
npm test -- imageAnalysis
npx tsc --noEmit
```

5. Commit:

```bash
git add src/imageTypes.ts test/imageAnalysis.test.ts
git commit -m "Add image analysis types"
```

---

## Task 2: Add D1 schema for image logs

**Objective:** Persist image analysis metadata, scores, evidence, and billing fields.

**Files:**

- Modify: `schema.sql`
- Test: existing schema/migration tests if present

**Steps:**

1. Add `image_analysis_logs` table.
2. Add account/created index.
3. Verify local tests still pass.
4. Apply remote D1 migration only after tests pass.
5. Verify table exists remotely:

```bash
npx wrangler d1 execute veracityapi --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='image_analysis_logs'"
```

6. Commit:

```bash
git add schema.sql
git commit -m "Add image analysis log schema"
```

---

## Task 3: Add R2 bucket binding

**Objective:** Provide private object storage for temporary and retained images.

**Files:**

- Modify: `wrangler.toml`
- Modify: Env type file if separate from route code

**Steps:**

1. Create R2 bucket if it does not exist:

```bash
npx wrangler r2 bucket create veracityapi-images
```

2. Add binding:

```toml
[[r2_buckets]]
binding = "IMAGE_BUCKET"
bucket_name = "veracityapi-images"
```

3. Add `IMAGE_BUCKET: R2Bucket` to Env type.
4. Run:

```bash
npx tsc --noEmit
```

5. Commit:

```bash
git add wrangler.toml src/index.ts
git commit -m "Bind image storage bucket"
```

Adjust staged files based on actual Env type location.

---

## Task 4: Implement image URL fetch and validation

**Objective:** Safely fetch remote images and reject unsupported, oversized, or private-network URLs.

**Files:**

- Create: `src/imageValidation.ts`
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Implement URL validation.
2. Block private/local IPs and non-HTTPS URLs.
3. Fetch with max-byte enforcement.
4. Validate MIME type against:

```text
image/jpeg
image/png
image/webp
```

5. Enforce max file size of 8 MB.
6. Add tests for:
   - bad URL
   - localhost URL
   - unsupported MIME
   - oversized body
   - valid JPEG/PNG/WebP mock
7. Run:

```bash
npm test -- imageAnalysis
npx tsc --noEmit
```

8. Commit:

```bash
git add src/imageValidation.ts test/imageAnalysis.test.ts
git commit -m "Add safe image URL validation"
```

---

## Task 5: Implement metadata extraction

**Objective:** Extract basic image dimensions, byte size, MIME type, hash, and available metadata.

**Files:**

- Create: `src/imageMetadata.ts`
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Compute SHA-256.
2. Determine dimensions for JPEG, PNG, and WebP.
3. Extract simple metadata fields if practical in Worker runtime.
4. Return normalized `ImageMetadata`.
5. Add tests with tiny fixture images or generated buffers.
6. Run:

```bash
npm test -- imageAnalysis
npx tsc --noEmit
```

7. Commit:

```bash
git add src/imageMetadata.ts test/imageAnalysis.test.ts
git commit -m "Extract image metadata"
```

---

## Task 6: Implement R2 storage helper

**Objective:** Store image temporarily or retained based on request privacy flags.

**Files:**

- Create: `src/imageStorage.ts`
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Add helper to generate R2 keys.
2. Add helper to put original image in R2.
3. Add helper to delete temp object when `retain_image=false`.
4. Add tests using a mocked R2 bucket.
5. Run:

```bash
npm test -- imageAnalysis
npx tsc --noEmit
```

6. Commit:

```bash
git add src/imageStorage.ts test/imageAnalysis.test.ts
git commit -m "Add image storage helper"
```

---

## Task 7: Implement image scoring provider

**Objective:** Add a structured multimodal scoring provider with normalized output.

**Files:**

- Create: `src/imageScoring.ts`
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Define provider interface.
2. Implement a mockable provider function.
3. Implement score normalization and recommended-action logic.
4. Add strict parsing of provider JSON.
5. Add tests for:
   - low risk recommendation
   - medium risk recommendation
   - high risk human review
   - very high risk reject
   - malformed provider response fallback
6. Run:

```bash
npm test -- imageAnalysis
npx tsc --noEmit
```

7. Commit:

```bash
git add src/imageScoring.ts test/imageAnalysis.test.ts
git commit -m "Add image scoring provider"
```

---

## Task 8: Implement route handler

**Objective:** Wire auth, balance check, image fetch, storage, scoring, logging, billing, and response together.

**Files:**

- Create: `src/imageRoutes.ts`
- Modify: `src/index.ts`
- Modify: `src/billing.ts` if needed
- Test: `test/imageAnalysis.test.ts`

**Steps:**

1. Add `POST /v1/analyze-image` route.
2. Authenticate bearer key using existing auth helper.
3. Check account balance is at least 2 cents.
4. Fetch and validate image.
5. Extract metadata.
6. Store temp image in R2.
7. Run scoring provider.
8. Insert D1 image log row.
9. Debit account by 2 cents with ledger type `image_analysis_debit`.
10. Delete temp object unless `retain_image=true`.
11. Return response.
12. Add tests for success, auth failure, insufficient balance, and privacy deletion behavior.
13. Run:

```bash
npm test -- imageAnalysis
npm test
npx tsc --noEmit
```

14. Commit:

```bash
git add src/imageRoutes.ts src/index.ts src/billing.ts test/imageAnalysis.test.ts
git commit -m "Add image analysis endpoint"
```

Adjust staged files based on actual changes.

---

## Task 9: Update docs and agent discovery

**Objective:** Make the new image capability discoverable to humans and agents.

**Files:**

- Modify: `src/discovery.ts`
- Modify: `src/pages.ts`
- Modify: `src/site.ts`
- Modify: `README.md`

**Steps:**

1. Add image endpoint to OpenAPI.
2. Add image endpoint to `llms.txt`.
3. Add image capability to `agents.json`.
4. Add pricing copy: `$0.02/image fast analysis`.
5. Add docs section and curl example.
6. Add examples for publishing pipeline, training data curation, and UGC moderation.
7. Update relevant use case pages to mention image checks.
8. Run:

```bash
npm test
npx tsc --noEmit
```

9. Commit:

```bash
git add src/discovery.ts src/pages.ts src/site.ts README.md
git commit -m "Document image trust scoring"
```

---

## Task 10: Add seed eval fixtures

**Objective:** Create a tiny internal calibration set for image scoring behavior.

**Files:**

- Create: `evals/image/README.md`
- Create: `evals/image/labels.jsonl`

**Steps:**

1. Document eval categories.
2. Add labels schema.
3. Add initial manually labeled examples without committing copyrighted/private images.
4. Keep raw images out of git unless license-safe and intentionally included.
5. Run tests.
6. Commit:

```bash
git add evals/image/README.md evals/image/labels.jsonl
git commit -m "Add image scoring eval plan"
```

---

## Task 11: Deploy and smoke test

**Objective:** Verify the feature works in production without leaking images or secrets.

**Files:**

- No source changes expected unless bugs are found.

**Steps:**

1. Run full checks:

```bash
npm test
npx tsc --noEmit
git diff --check
```

2. Deploy:

```bash
npx wrangler deploy
```

3. Smoke test auth failure:

```bash
curl -i https://veracityapi.com/v1/analyze-image \
  -H 'Content-Type: application/json' \
  -d '{"image_url":"https://example.com/test.jpg"}'
```

Expected: `401`.

4. Smoke test with a real local API key stored outside chat.
5. Query D1 to verify image log exists and privacy behavior is correct.
6. Verify R2 temp object deletion or lifecycle.
7. Verify discovery endpoints:

```bash
curl -sS https://veracityapi.com/openapi.json | grep analyze-image
curl -sS https://veracityapi.com/llms.txt | grep analyze-image
curl -sS https://veracityapi.com/.well-known/agents.json | grep image
```

8. Commit any fixes.
9. Push:

```bash
git push
```

---

## 15. Recommended Implementation Order

1. Types and schema.
2. R2 binding.
3. Image validation.
4. Metadata extraction.
5. Storage helper.
6. Scoring provider.
7. Route handler.
8. Billing/logging integration.
9. Docs/discovery.
10. Eval plan.
11. Deploy/smoke.

---

## 16. Launch Copy

Short version:

```text
Image trust scoring for agents. Submit an image URL and get synthetic-image risk, provenance weakness, visual artifact findings, metadata integrity risk, and a recommended action. Built for publishing pipelines, UGC moderation, training-data curation, and claim review. Scores are probabilistic workflow signals, not proof of AI authorship.
```

Pricing copy:

```text
Image analysis: $0.02 per image. New accounts include $1.50 in free credits, enough to test roughly 75 image checks.
```

Docs caveat:

```text
Missing EXIF, social-media compression, screenshots, and edited exports can weaken provenance without proving synthetic generation. Treat high scores as review triggers, not authorship verdicts.
```

---

## 17. Open Questions Before Build

1. Should v0 use the existing Anthropic key/model if it supports image input in the Worker path, or should we add a separate multimodal provider secret?
2. Should `retain_image=true` be allowed for all accounts, or only internal/admin accounts at launch?
3. Should image pricing be exactly `$0.02`, or should deep mode be reserved from day one with `$0.06` copy hidden until implemented?
4. Should source URL be stored as domain-only by default, or full URL when `store_content=true`?
5. Do we want a small public demo for image analysis, or keep it API-key-only at launch?

Recommended defaults:

- Use the current provider if it supports image input cleanly.
- Disable retained images for public accounts until we need debugging/evals.
- Ship only `$0.02 fast` pricing.
- Store domain-only by default.
- Keep image endpoint API-key-only at launch.
