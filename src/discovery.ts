const BASE_URL = "https://veracityapi.com";
const API_BASE_URL = "https://api.veracityapi.com";

export function openApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "VeracityAPI",
      version: "0.1.0",
      summary: "Content trust scoring API for agents",
      description: "Scores English text for synthetic-content risk, AI slop risk, evidence spans, and a recommended action. Probabilistic risk scoring only; not proof of authorship or truth.",
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
      { name: "analysis", description: "Text content trust scoring" },
      { name: "demo", description: "No-key public demo endpoint" },
      { name: "health", description: "Service health" },
      { name: "access", description: "Credit-based API access requests" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["health"],
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
          summary: "Analyze text content risk",
          description: "Requires a bearer API key. Returns synthetic-content risk, slop risk, evidence, recommended fixes, and a deterministic recommended action.",
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
            "503": { "$ref": "#/components/responses/LlmUnavailable" },
          },
        },
      },
      "/demo/analyze": {
        post: {
          tags: ["demo"],
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
      "/request-access": {
        post: {
          tags: ["access"],
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
        bearerAuth: { type: "http", scheme: "bearer", description: "VeracityAPI beta key. Send a bearer token in the Authorization header. Request access at https://veracityapi.com/." },
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
            text: { type: "string", minLength: 20, maxLength: 100000, description: "English text to score. Requests are priced by character bucket up to 100k chars." },
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
        AnalyzeTextResponse: {
          type: "object",
          required: ["analysis_id", "synthetic_risk", "slop_risk", "risk_level", "recommended_action", "confidence", "evidence", "recommended_fixes", "model_version", "limitations"],
          properties: {
            analysis_id: { type: "string", example: "ana_01KRA1EQPDJ7N2KHBXCQMGZYFJ" },
            synthetic_risk: { type: "number", minimum: 0, maximum: 1, example: 0.72 },
            slop_risk: { type: "number", minimum: 0, maximum: 1, example: 0.78 },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            recommended_action: { type: "string", enum: ["allow", "revise", "human_review", "reject"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            evidence: { type: "array", items: { "$ref": "#/components/schemas/EvidenceItem" } },
            recommended_fixes: { type: "array", items: { type: "string" } },
            model_version: { type: "string", example: "v0.1" },
            limitations: { type: "array", items: { type: "string" } },
          },
        },
        EvidenceItem: {
          type: "object",
          required: ["type", "severity", "span", "explanation"],
          properties: {
            type: { type: "string", example: "generic_phrasing" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            span: { type: "string", example: "should always stay alert" },
            explanation: { type: "string", example: "Vague, universally applicable advice lacking specificity." },
          },
        },
        AccessRequest: {
          type: "object",
          required: ["name", "email", "use_case"],
          properties: {
            name: { type: "string", maxLength: 120 },
            email: { type: "string", format: "email", maxLength: 180 },
            company: { type: "string", maxLength: 160 },
            use_case: { type: "string", maxLength: 1200 },
            volume: { type: "string", enum: ["under 1k", "1k-10k", "10k-100k", "100k+"] }
          }
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
      responses: {
        BadRequest: { description: "Invalid JSON or request body", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        Unauthorized: { description: "Missing or invalid bearer API key", content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" }, examples: { unauthorized: { value: { error: "unauthorized" } } } } } },
        RateLimited: { description: "Demo rate limit reached", headers: { "Retry-After": { schema: { type: "string" } } }, content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
        LlmUnavailable: { description: "Scoring model unavailable", headers: { "Retry-After": { schema: { type: "string" } } }, content: { "application/json": { schema: { "$ref": "#/components/schemas/ErrorResponse" } } } },
      },
    },
  };
}

export function sampleAnalyzeResponse(analysisId = "demo_01KRA1EQPDJ7N2KHBXCQMGZYFJ"): Record<string, unknown> {
  return {
    analysis_id: analysisId,
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
    limitations: ["Probabilistic risk score, not proof of authorship.", "English-only at MVP."],
  };
}

export function llmsTxt(): string {
  return `# VeracityAPI

VeracityAPI is a content trust scoring API for agents. It scores English text for synthetic-content risk, AI slop risk, weak provenance signals, and recommended next actions.

VeracityAPI is not a truth oracle and does not prove authorship. Treat results as probabilistic risk signals with evidence and workflow recommendations.

## Human homepage

${BASE_URL}/

## API base URL

${API_BASE_URL}

## OpenAPI spec

${BASE_URL}/openapi.json

## Public demo endpoint

POST ${BASE_URL}/demo/analyze

No API key required. privacy_mode is forced true server-side. Text limit is 4,000 characters. Rate limited.

## Production endpoint

POST ${API_BASE_URL}/v1/analyze-text

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
- synthetic_risk: number 0-1
- slop_risk: number 0-1
- risk_level: low | medium | high
- recommended_action: allow | revise | human_review | reject
- confidence: low | medium | high
- evidence: array of { type, severity, span, explanation }
- recommended_fixes: array of strings
- model_version: model/scoring contract version
- limitations: array of caveats

## Example curl

curl ${API_BASE_URL}/v1/analyze-text \\
  -H "Authorization: Bearer $VERACITYAPI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Paste article, review, caption, or source text here...","context":{"format":"article","intended_use":"publish","domain":"travel safety"},"privacy_mode":true}'

## Human docs

- Docs: ${BASE_URL}/docs
- Evals/proof: ${BASE_URL}/evals
- Use cases/examples: ${BASE_URL}/examples
- Pricing: ${BASE_URL}/pricing
- Privacy: ${BASE_URL}/privacy
- Request access: ${BASE_URL}/request-access

## Access

Public demo is open. Production API access uses prepaid credits. No subscriptions. Every request debits the account balance by character bucket. Request access through ${BASE_URL}/request-access or by email: bernard@tabiji.ai

## Pricing

- ≤4k chars: $0.01
- ≤20k chars: $0.03
- ≤50k chars: $0.06
- ≤100k chars: $0.12
- >100k chars: chunk or contact us

## Limitations

- Probabilistic risk score, not proof of authorship or truth.
- English-only at MVP.
- Scores should be paired with evidence and workflow-specific policy.
`;
}

export function sitemapXml(): string {
  const updated = new Date().toISOString();
  const urls = ["/", "/docs", "/evals", "/examples", "/pricing", "/privacy", "/request-access", "/openapi.json", "/llms.txt", "/.well-known/agents.json", "/sitemap.xml"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${BASE_URL}${path}</loc><lastmod>${updated}</lastmod><changefreq>weekly</changefreq><priority>${path === "/" ? "1.0" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`;
}

export function agentsJson(): Record<string, unknown> {
  return {
    name: "VeracityAPI",
    description: "Content trust and synthetic-risk scoring API for agents.",
    homepage: BASE_URL,
    api_base: API_BASE_URL,
    openapi: `${BASE_URL}/openapi.json`,
    llms_txt: `${BASE_URL}/llms.txt`,
    sitemap: `${BASE_URL}/sitemap.xml`,
    docs: `${BASE_URL}/docs`,
    evals: `${BASE_URL}/evals`,
    examples: `${BASE_URL}/examples`,
    pricing_url: `${BASE_URL}/pricing`,
    privacy: `${BASE_URL}/privacy`,
    access_request: `${BASE_URL}/request-access`,
    auth: {
      type: "bearer",
      header: "Authorization header: Bearer token",
      instructions: "Request credit-based API access from the homepage or email bernard@tabiji.ai.",
    },
    pricing: {
      model: "prepaid_credits",
      billing: "No subscriptions. Every request debits the account balance by character bucket.",
      buckets: [
        { max_chars: 4000, price_usd: 0.01 },
        { max_chars: 20000, price_usd: 0.03 },
        { max_chars: 50000, price_usd: 0.06 },
        { max_chars: 100000, price_usd: 0.12 },
      ],
      above_100k: "chunk or contact us",
    },
    demo: {
      endpoint: `${BASE_URL}/demo/analyze`,
      method: "POST",
      auth_required: false,
      limits: "4000 chars, rate limited, privacy_mode=true forced server-side",
    },
    capabilities: ["synthetic_content_risk", "ai_slop_risk", "evidence_spans", "recommended_action", "privacy_mode"],
    limitations: ["Probabilistic risk score, not proof of authorship or truth", "English-only at MVP"],
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
  <text x="110" y="438" fill="#a2a8b3" font-family="Inter, Arial, sans-serif" font-size="30">Synthetic risk · Slop risk · Evidence · Actions</text>
  <text x="110" y="496" fill="#d0d6e0" font-family="JetBrains Mono, monospace" font-size="24">POST /v1/analyze-text → JSON</text>
</svg>`;
}
