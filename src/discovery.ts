import { DEMO_IMAGE_URL } from "./demoImage";
import { USE_CASES } from "./pages";

const BASE_URL = "https://veracityapi.com";
const API_BASE_URL = "https://api.veracityapi.com";

export function openApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "VeracityAPI",
      version: "0.1.0",
      summary: "Content and image trust scoring API for agents",
      description: "Scores English text and image URLs for content trust, specificity/slop risk, synthetic-image risk, evidence, and recommended actions. Workflow risk scoring only; not proof of authorship or truth.",
      contact: {
        name: "VeracityAPI beta access",
        email: "bernard@tabiji.ai",
        url: BASE_URL,
      },
      license: {
        name: "Proprietary beta",
      },
    },
    servers: [
      { url: API_BASE_URL, description: "Production API" },
      { url: BASE_URL, description: "Public demo host" },
    ],
    tags: [
      { name: "analysis", description: "Text and image content trust scoring" },
      { name: "demo", description: "No-key public demo endpoint" },
      { name: "health", description: "Service health" },
      { name: "access", description: "Credit-based API access requests" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["health"],
          operationId: "getHealth",
          summary: "Health check",
          responses: {
            "200": {
              description: "Service is reachable",
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/HealthResponse" },
                  examples: { ok: { value: { status: "ok", service: "veracityapi", version: "v0.1" } } },
                },
              },
            },
          },
        },
      },
      "/v1/analyze-text": {
        post: {
          tags: ["analysis"],
          operationId: "analyzeText",
          summary: "Analyze text content risk",
          description: "Requires a bearer API key. Returns content trust, specificity/slop risk, weak-provenance signals, evidence, recommended fixes, and a deterministic recommended action.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/AnalyzeTextRequest" },
                examples: {
                  genericTravelAdvice: {
                    value: {
                      text: "Travelers visiting major European cities should always stay alert. Pickpockets are everywhere, scams happen constantly, and you should never trust strangers. Keep your belongings safe and avoid tourist areas because criminals target all visitors.",
                      context: { format: "article", intended_use: "publish", domain: "travel safety" },
                      privacy_mode: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Risk scoring result",
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/AnalyzeTextResponse" },
                  examples: { highRisk: { value: sampleAnalyzeResponse("ana_01EXAMPLE") } },
                },
              },
            },
            "400": { "$ref": "#/components/responses/BadRequest" },
            "401": { "$ref": "#/components/responses/Unauthorized" },
            "402": { "$ref": "#/components/responses/InsufficientBalance" },
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },

      "/v1/analyze-batch": {
        post: {
          tags: ["analysis"],
          operationId: "analyzeBatch",
          summary: "Analyze a synchronous batch of text items",
          description: "Requires a bearer API key. Scores 1-25 text items synchronously. Each item is capped at 4,000 characters and the batch total is capped at 50,000 characters. Billing is the sum of per-item text prices.",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeBatchRequest" } } } },
          responses: {
            "200": { description: "Batch scoring result", content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeBatchResponse" } } } },
            "400": { "$ref": "#/components/responses/BadRequest" },
            "401": { "$ref": "#/components/responses/Unauthorized" },
            "402": { "$ref": "#/components/responses/InsufficientBalance" },
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },

      "/v1/balance": {
        get: {
          tags: ["access"],
          operationId: "getBalance",
          summary: "Get account credit balance and recent usage",
          description: "Requires an account bearer API key. Use this as a preflight check before autonomous agent pipelines call paid analysis endpoints.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Balance and usage summary", content: { "application/json": { schema: { "$ref": "#/components/schemas/BalanceResponse" } } } },
            "401": { "$ref": "#/components/responses/Unauthorized" },
          },
        },
      },

      "/v1/analyze-image": {
        post: {
          tags: ["analysis"],
          operationId: "analyzeImage",
          summary: "Analyze image synthetic risk",
          description: "Requires a bearer API key. Submit an https image URL and receive synthetic-image risk, content trust score, visible evidence, recommended fixes, and a deterministic recommended action. No image bytes are stored by VeracityAPI.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/AnalyzeImageRequest" },
                examples: {
                  imageUrl: {
                    value: {
                      image_url: DEMO_IMAGE_URL,
                      context: { format: "social_post", intended_use: "publish", domain: "influencer product post" },
                      privacy_mode: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Image risk scoring result",
              content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeImageResponse" }, examples: { highRisk: { value: sampleAnalyzeImageResponse("img_01EXAMPLE") } } } },
            },
            "400": { "$ref": "#/components/responses/BadRequest" },
            "401": { "$ref": "#/components/responses/Unauthorized" },
            "402": { "$ref": "#/components/responses/InsufficientBalance" },
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },
      "/demo/analyze": {
        post: {
          tags: ["demo"],
          operationId: "demoAnalyzeText",
          summary: "Analyze text with the public no-key demo",
          description: "No API key required. privacy_mode is forced true server-side. Text is capped at 4,000 characters and requests are rate limited.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeTextRequest" } },
            },
          },
          responses: {
            "200": {
              description: "Demo risk scoring result",
              content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeTextResponse" } } },
            },
            "400": { "$ref": "#/components/responses/BadRequest" },
            "429": { "$ref": "#/components/responses/RateLimited" },
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },
      "/demo/analyze-image": {
        post: {
          tags: ["demo"],
          operationId: "demoAnalyzeImage",
          summary: "Analyze an image URL with the public no-key demo",
          description: "No API key required. Accepts an HTTPS image URL, forces privacy_mode=true, logs no image bytes or full URL, and rate limits by IP/cookie.",
          requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeImageRequest" } } } },
          responses: {
            "200": { description: "Demo image scoring result", content: { "application/json": { schema: { "$ref": "#/components/schemas/AnalyzeImageResponse" } } } },
            "400": { "$ref": "#/components/responses/BadRequest" },
            "429": { "$ref": "#/components/responses/RateLimited" },
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },
      "/request-access": {
        post: {
          tags: ["access"],
          operationId: "requestAccess",
          summary: "Request private beta API access",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { "$ref": "#/components/schemas/AccessRequest" } } },
          },
          responses: {
            "200": { description: "Access request stored", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, request_id: { type: "string" } } } } } },
            "400": { "$ref": "#/components/responses/BadRequest" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "VeracityAPI key. Send a bearer token in the Authorization header. New accounts get $1.50 free credit — enough for 150 short text analyses at https://veracityapi.com/account." },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["status", "service", "version"],
          properties: {
            status: { type: "string", enum: ["ok"] },
            service: { type: "string", enum: ["veracityapi"] },
            version: { type: "string", example: "v0.1" },
          },
        },
        AnalyzeTextRequest: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", minLength: 20, maxLength: 100000, description: "English-calibrated text to score. Requests are priced by character bucket up to 100k chars." },
            context: {
              type: "object",
              properties: {
                format: { type: "string", enum: ["article", "social_post", "product_review", "caption", "other"], default: "other" },
                intended_use: { type: "string", enum: ["publish", "train", "cite", "moderate", "other"], default: "other" },
                domain: { type: "string", maxLength: 100, description: "Optional topic/domain hint." },
              },
            },
            privacy_mode: { type: "boolean", default: true, description: "When true, raw text is not stored in D1 logs." },
          },
        },

        AnalyzeBatchRequest: {
          type: "object",
          required: ["items"],
          properties: {
            items: { type: "array", minItems: 1, maxItems: 25, items: { type: "object", required: ["id", "text"], properties: { id: { type: "string", minLength: 1, maxLength: 120 }, text: { type: "string", minLength: 20, maxLength: 4000 } } } },
            context: { "$ref": "#/components/schemas/AnalyzeTextRequest/properties/context" },
            privacy_mode: { type: "boolean", default: true },
          },
          description: "Synchronous batch request. Each item is capped at 4,000 chars; batch total max is 50,000 chars.",
        },

        BalanceResponse: {
          type: "object",
          required: ["account_id", "balance_cents", "currency", "last_usage_at", "recent_usage"],
          properties: {
            account_id: { type: "string", example: "acct_01K..." },
            balance_cents: { type: "integer", example: 842 },
            currency: { type: "string", enum: ["USD"] },
            last_usage_at: { type: ["string", "null"], format: "date-time" },
            recent_usage: { type: "object", properties: { today_cents: { type: "integer" }, last_7_days_cents: { type: "integer" }, last_30_days_cents: { type: "integer" } } },
          },
        },

        AnalyzeImageRequest: {
          type: "object",
          required: ["image_url"],
          properties: {
            image_url: { type: "string", format: "uri", maxLength: 2000, description: "HTTPS URL for a JPEG, PNG, WebP, or other image format supported by the vision provider. VeracityAPI does not store image bytes." },
            context: {
              type: "object",
              properties: {
                format: { type: "string", enum: ["article", "social_post", "product_review", "caption", "other"], default: "other" },
                intended_use: { type: "string", enum: ["publish", "train", "cite", "moderate", "other"], default: "other" },
                domain: { type: "string", maxLength: 100, description: "Optional topic/domain hint." },
              },
            },
            privacy_mode: { type: "boolean", default: true, description: "When true, only the image URL hash and hostname are logged; image bytes and the full URL are not stored." },
          },
        },
        AnalyzeTextResponse: {
          type: "object",
          required: ["analysis_id", "synthetic_risk", "slop_risk", "risk_level", "recommended_action", "confidence", "evidence", "recommended_fixes", "model_version", "limitations"],
          properties: {
            analysis_id: { type: "string", example: "ana_01KRA1EQPDJ7N2KHBXCQMGZYFJ" },
            content_trust_score: { type: "number", minimum: 0, maximum: 1, example: 0.22, description: "Derived workflow trust score. Higher is better." },
            specificity_risk: { type: "number", minimum: 0, maximum: 1, example: 0.78, description: "Risk that the text is vague, generic, or low-detail." },
            provenance_weakness: { type: "number", minimum: 0, maximum: 1, example: 0.78, description: "Risk that claims lack visible sourcing, firsthand detail, or provenance markers." },
            synthetic_texture_risk: { type: "number", minimum: 0, maximum: 1, example: 0.72, description: "Backward-compatible authorship-texture signal; not proof of AI authorship." },
            synthetic_risk: { type: "number", minimum: 0, maximum: 1, example: 0.72, deprecated: true, description: "Legacy alias for synthetic_texture_risk; retained for compatibility." },
            slop_risk: { type: "number", minimum: 0, maximum: 1, example: 0.78 },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            recommended_action: { type: "string", enum: ["allow", "revise", "human_review", "reject"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            evidence: { type: "array", items: { "$ref": "#/components/schemas/EvidenceItem" } },
            recommended_fixes: { type: "array", items: { type: "string" } },
            model_version: { type: "string", example: "v0.1" },
            limitations: { type: "array", items: { type: "string" } },
            billing: { type: "object", properties: { chars_analyzed: { type: "integer" }, bucket: { type: "string", example: "up_to_4k" }, price_cents: { type: "integer", example: 1 }, remaining_balance_cents: { type: "integer" } } },
          },
        },

        AnalyzeBatchResponse: {
          type: "object",
          required: ["batch_id", "results"],
          properties: {
            batch_id: { type: "string", example: "bat_01K..." },
            results: { type: "array", items: { allOf: [{ "$ref": "#/components/schemas/AnalyzeTextResponse" }, { type: "object", properties: { id: { type: "string" }, batch_id: { type: "string" } } }] } },
            billing: { type: "object", properties: { units_analyzed: { type: "integer" }, chars_analyzed: { type: "integer" }, bucket: { type: "string", example: "batch_text_v0" }, price_cents: { type: "integer" }, remaining_balance_cents: { type: "integer" } } },
          },
        },

        AnalyzeImageResponse: {
          type: "object",
          required: ["analysis_id", "content_trust_score", "synthetic_image_risk", "synthetic_risk", "risk_level", "recommended_action", "confidence", "evidence", "recommended_fixes", "model_version", "limitations"],
          properties: {
            analysis_id: { type: "string", example: "img_01KRA1EQPDJ7N2KHBXCQMGZYFJ" },
            content_trust_score: { type: "number", minimum: 0, maximum: 1, example: 0.28, description: "Derived image workflow trust score. Higher is better." },
            synthetic_image_risk: { type: "number", minimum: 0, maximum: 1, example: 0.72, description: "Visible synthetic-image artifact risk; not proof of AI authorship." },
            synthetic_risk: { type: "number", minimum: 0, maximum: 1, example: 0.72, description: "Alias for synthetic_image_risk for SDK consistency." },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            recommended_action: { type: "string", enum: ["allow", "revise", "human_review", "reject"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            evidence: { type: "array", items: { "$ref": "#/components/schemas/EvidenceItem" } },
            recommended_fixes: { type: "array", items: { type: "string" } },
            model_version: { type: "string", example: "v0.1" },
            limitations: { type: "array", items: { type: "string" } },
          },
        },
      },
      responses: {
        BadRequest: { description: "Invalid JSON or request body", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        Unauthorized: { description: "Missing or invalid bearer API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" }, examples: { unauthorized: { value: { error: "unauthorized" } } } } } },
        InsufficientBalance: { description: "Account balance is too low for the requested analysis", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        RateLimited: { description: "Demo rate limit reached", headers: { "Retry-After": { schema: { type: "string" } } }, content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        LlmUnavailable: { description: "Scoring model unavailable", headers: { "Retry-After": { schema: { type: "string" } } }, content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
      },
    },
  };
}

export function sampleAnalyzeResponse(analysisId = "demo_01KRA1EQPDJ7N2KHBXCQMGZYFJ"): Record<string, unknown> {
  return {
    analysis_id: analysisId,
    content_trust_score: 0.22,
    specificity_risk: 0.78,
    provenance_weakness: 0.78,
    synthetic_texture_risk: 0.72,
    synthetic_risk: 0.72,
    slop_risk: 0.78,
    confidence: "medium",
    evidence: [
      { type: "generic_phrasing", severity: "high", span: "should always stay alert", explanation: "Vague, universally applicable advice lacking specificity or actionable detail." },
      { type: "hedging_and_absolutes", severity: "high", span: "Pickpockets are everywhere", explanation: "Sweeping generalization without supporting evidence or useful context." },
      { type: "absence_of_specificity", severity: "medium", span: "major European cities", explanation: "No named cities, neighborhoods, timeframes, or source details." },
    ],
    recommended_fixes: [
      "Replace generic warnings with named examples, locations, and sourceable details.",
      "Remove absolute claims unless they are supported by evidence.",
      "Add concrete decision guidance for the intended workflow.",
    ],
    risk_level: "high",
    recommended_action: "human_review",
    model_version: "v0.1",
    limitations: ["Scores are probabilistic workflow risk signals, not proof of AI authorship or truth.", "v0.1 uses an LLM-backed structured scoring pass; treat synthetic_risk as texture risk, not ground-truth authorship detection.", "English-calibrated at MVP; non-English content should be treated as experimental."],
  };
}


export function sampleAnalyzeImageResponse(analysisId = "img_01KRA1IMAGEEXAMPLE"): Record<string, unknown> {
  return {
    analysis_id: analysisId,
    content_trust_score: 0.75,
    synthetic_image_risk: 0.25,
    synthetic_risk: 0.25,
    confidence: "medium",
    evidence: [
      { type: "skin_texture", severity: "low", span: "facial skin and neck area", explanation: "Skin appears slightly over-smoothed with minimal visible pore detail, consistent with beauty filters or light retouching rather than synthetic generation." },
      { type: "hand_anatomy", severity: "low", span: "left hand holding product bottle", explanation: "Hand structure, finger joints, and nail definition appear anatomically plausible with natural proportions and realistic shadow detail." },
      { type: "product_label_clarity", severity: "low", span: "Beauty Tonic bottle label text and design", explanation: "Product label text is readable and perspective-aligned, without obvious text distortion artifacts typical of generated images." },
      { type: "lighting_consistency", severity: "low", span: "overall scene lighting from face to background fence", explanation: "Lighting direction and shadow placement appear consistent across the subject and environment." },
    ],
    recommended_fixes: ["No critical fixes needed; image appears consistent with professional photography or light post-processing.", "If publishing, standard influencer disclosure practices apply regardless of synthetic risk assessment.", "Verify original source/provenance if the image is used as evidence for a claim."],
    risk_level: "low",
    recommended_action: "allow",
    model_version: "v0.1",
    limitations: ["Scores are probabilistic workflow risk signals, not proof of AI authorship.", "v0.1 image scoring uses a vision LLM, not a calibrated synthetic-image classifier.", "VeracityAPI does not inspect EXIF, C2PA Content Credentials, or provenance metadata in v0.1."],
  };
}


export function llmsTxt(): string {
  return `# VeracityAPI

VeracityAPI is a content and image trust scoring API for agents. It scores English-calibrated text for specificity/slop/provenance risk and image URLs for visible synthetic-image risk, evidence, and recommended next actions.

VeracityAPI is not an AI detector, truth oracle, or proof of authorship. Treat results as probabilistic workflow risk signals with evidence and recommendations.

## Human homepage

${BASE_URL}/

## API base URL

${API_BASE_URL}

## OpenAPI spec

${BASE_URL}/openapi.json

## Public demo endpoint

POST ${BASE_URL}/demo/analyze
POST ${BASE_URL}/demo/analyze-image

No API key required. privacy_mode is forced true server-side. Text limit is 4,000 characters. Image demo accepts HTTPS image URLs and logs only URL hash + hostname. Rate limited by IP/cookie.

## Production endpoints

POST ${API_BASE_URL}/v1/analyze-text
POST ${API_BASE_URL}/v1/analyze-batch
POST ${API_BASE_URL}/v1/analyze-image
GET ${API_BASE_URL}/v1/balance

Requires:

Authorization header: Bearer token
Content-Type: application/json

## Request schema

{
  "text": "string, 20-100000 chars",
  "context": {
    "format": "article | social_post | product_review | caption | other",
    "intended_use": "publish | train | cite | moderate | other",
    "domain": "optional string"
  },
  "privacy_mode": true
}

## Response fields

- analysis_id: stable ID for the analysis
- content_trust_score: number 0-1, higher is better
- specificity_risk: number 0-1, vague/generic/low-detail risk
- provenance_weakness: number 0-1, weak source/firsthand/detail risk
- synthetic_texture_risk: number 0-1, backward-compatible authorship-texture signal; not proof
- synthetic_risk: legacy number 0-1 retained for compatibility
- slop_risk: number 0-1
- risk_level: low | medium | high
- recommended_action: allow | revise | human_review | reject
- confidence: low | medium | high
- evidence: array of { type, severity, span, explanation }
- recommended_fixes: array of strings
- model_version: model/scoring contract version
- limitations: array of caveats

## Image endpoint

POST ${API_BASE_URL}/v1/analyze-image
POST ${API_BASE_URL}/v1/analyze-image accepts {"image_url":"https://...","context":{"format":"social_post","intended_use":"publish","domain":"influencer product post"},"privacy_mode":true}. Demo fixture: ${DEMO_IMAGE_URL}. It returns content_trust_score, synthetic_image_risk, synthetic_risk alias, evidence, recommended_fixes, risk_level, recommended_action, limitations, and billing. VeracityAPI stores no image bytes and logs only a hash plus hostname. Price: $0.02/image.

## Batch and balance endpoints

POST ${API_BASE_URL}/v1/analyze-batch accepts {"items":[{"id":"post_001","text":"..."}],"context":{"format":"social_post","intended_use":"publish","domain":"travel_safety"},"privacy_mode":true}. Limits: 1-25 items, 4,000 chars per item, 50,000 chars total. It returns {"batch_id":"bat_...","results":[...],"billing":{"units_analyzed":25,"price_cents":25,"remaining_balance_cents":...}}.

GET ${API_BASE_URL}/v1/balance returns account_id, balance_cents, currency, last_usage_at, and recent_usage windows so agents can preflight autonomous runs.

## Example curl

curl ${API_BASE_URL}/v1/analyze-text \\
  -H "Authorization: Bearer $VERACITYAPI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Paste article, review, caption, or source text here...","context":{"format":"article","intended_use":"publish","domain":"travel safety"},"privacy_mode":true}'

## Human docs

- Docs: ${BASE_URL}/docs
- How it works: ${BASE_URL}/how-it-works
- Evals/proof: ${BASE_URL}/evals
- Use case library: ${BASE_URL}/use-cases
- Examples/tool wrapper: ${BASE_URL}/examples
- Pricing: ${BASE_URL}/pricing
- Privacy: ${BASE_URL}/privacy
- Request access: ${BASE_URL}/request-access


## Business use-case pages for agents

${USE_CASES.map((u) => `- ${u.title}: ${BASE_URL}/use-cases/${u.slug}`).join("\n")}

## Access

Public demo is open. New accounts get $1.50 free credit — enough for 150 short text analyses to test real workflows. Production API access uses prepaid credits. No subscriptions. Every request debits the account balance by character bucket. Create an account, get $1.50 free credit — enough for 150 short text analyses, and create an API key at ${BASE_URL}/account.

## Pricing

- Text ≤4k chars: $0.01
- Batch text: sum of per-item text prices; synchronous v0 allows 1-25 items, ≤4k chars each, ≤50k chars total
- Text ≤20k chars: $0.03
- Text ≤50k chars: $0.06
- Text ≤100k chars: $0.12
- Image analysis: $0.02/image
- >100k chars: chunk or contact us

## Limitations

- Workflow risk score, not proof of authorship or truth.
- English-calibrated at MVP; non-English is experimental.
- Scores should be paired with evidence and workflow-specific policy.
`;
}

export function sitemapXml(): string {
  const updated = new Date().toISOString();
  const urls = ["/", "/docs", "/how-it-works", "/use-cases", ...USE_CASES.map((u) => `/use-cases/${u.slug}`), "/evals", "/examples", "/pricing", "/privacy", "/request-access", "/openapi.json", "/llms.txt", "/.well-known/agents.json", "/sitemap.xml"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${BASE_URL}${path}</loc><lastmod>${updated}</lastmod><changefreq>weekly</changefreq><priority>${path === "/" ? "1.0" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`;
}

export function agentsJson(): Record<string, unknown> {
  return {
    name: "VeracityAPI",
    description: "Content and image trust scoring API for agents.",
    homepage: BASE_URL,
    api_base: API_BASE_URL,
    openapi: `${BASE_URL}/openapi.json`,
    llms_txt: `${BASE_URL}/llms.txt`,
    sitemap: `${BASE_URL}/sitemap.xml`,
    docs: `${BASE_URL}/docs`,
    evals: `${BASE_URL}/evals`,
    examples: `${BASE_URL}/examples`,
    use_cases: `${BASE_URL}/use-cases`,
    use_case_pages: USE_CASES.map((u) => ({ title: u.title, url: `${BASE_URL}/use-cases/${u.slug}`, summary: u.summary })),
    pricing_url: `${BASE_URL}/pricing`,
    privacy: `${BASE_URL}/privacy`,
    access_request: `${BASE_URL}/request-access`,
    auth: {
      type: "bearer",
      header: "Authorization header: Bearer token",
      instructions: "Create an account at https://veracityapi.com/account, get $1.50 free credit — enough for 150 short text analyses, and create an API key.",
    },
    pricing: {
      model: "prepaid_credits",
      billing: "New accounts get $1.50 free credit — enough for 150 short text analyses. No subscriptions. Text requests debit by character bucket; batch text is billed as the sum of per-item text prices; image analysis debits $0.02/image.",
      buckets: [
        { max_chars: 4000, price_usd: 0.01 },
        { max_chars: 20000, price_usd: 0.03 },
        { max_chars: 50000, price_usd: 0.06 },
        { max_chars: 100000, price_usd: 0.12 },
      ],
      above_100k: "chunk or contact us",
      image_analysis: { unit: "image", price_usd: 0.02, bucket: "image_v0" },
      batch_text: { max_items: 25, max_chars_per_item: 4000, max_total_chars: 50000, billing: "sum_per_item" },
    },
    demo: {
      endpoint: `${BASE_URL}/demo/analyze`,
      image_endpoint: `${BASE_URL}/demo/analyze-image`,
      method: "POST",
      auth_required: false,
      limits: "text demo: 4000 chars; image demo: HTTPS image URL; both rate limited and privacy_mode=true forced server-side",
      sample_image_url: DEMO_IMAGE_URL,
    },
    recommended_use_cases: USE_CASES.map((u) => u.title),
    capabilities: ["content_trust_score", "specificity_risk", "provenance_weakness", "synthetic_texture_risk", "synthetic_image_risk", "ai_slop_risk", "evidence_spans", "recommended_action", "privacy_mode", "synchronous_batch", "balance_preflight"],
    limitations: ["Workflow risk score, not proof of authorship or truth", "English-calibrated text at MVP; non-English scoring is experimental", "Image v0.1 uses visible artifact scoring only and does not inspect EXIF/C2PA metadata"],
  };
}

export function robotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml

# VeracityAPI is intended to be discoverable by search engines and agent crawlers.
# Agent-readable service docs:
# - ${BASE_URL}/llms.txt
# - ${BASE_URL}/openapi.json
# - ${BASE_URL}/.well-known/agents.json
`;
}

export function ogSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7170ff"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#08090a"/>
  <circle cx="250" cy="60" r="320" fill="#7170ff" opacity="0.22"/>
  <circle cx="980" cy="160" r="280" fill="#38bdf8" opacity="0.12"/>
  <rect x="74" y="76" width="1052" height="478" rx="34" fill="#0f1011" stroke="rgba(255,255,255,0.12)"/>
  <rect x="108" y="110" width="64" height="64" rx="16" fill="url(#g)"/>
  <text x="196" y="154" fill="#f7f8f8" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700">VeracityAPI</text>
  <text x="108" y="282" fill="#f7f8f8" font-family="Inter, Arial, sans-serif" font-size="66" font-weight="700">Content trust scoring</text>
  <text x="108" y="358" fill="#f7f8f8" font-family="Inter, Arial, sans-serif" font-size="66" font-weight="700">for agents</text>
  <text x="110" y="438" fill="#a2a8b3" font-family="Inter, Arial, sans-serif" font-size="30">Specificity · Provenance · Evidence · Actions</text>
  <text x="110" y="496" fill="#d0d6e0" font-family="JetBrains Mono, monospace" font-size="24">POST /v1/analyze-text or /v1/analyze-image → JSON</text>
</svg>`;
}
