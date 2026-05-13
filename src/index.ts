import { ulid } from "ulid";
import { sha256Hex } from "./auth";
import { accountHtml, buildAccountView, cleanEmail, clearSessionCookie, consumeMagicLink, createApiKey, createMagicLink, getSessionAccount, parseForm, redirect, requireAccount, sendMagicLink, sessionCookie, validEmail } from "./account";
import { authenticateUsageKey, BillingAuthError, creditCheckoutSession, CREDIT_PACKS, debitForAudio, debitForBatchRequest, debitForImage, debitForRequest, debitForVideo, getBalanceSummary, InsufficientBalanceError, refundUsage, verifyStripeWebhook } from "./billing";
import { logAnalysis } from "./db";
import { LlmError, reviseText, scoreAudio, scoreImage, scoreText } from "./llm";
import { buildAnalyzeVideoResponse, extractVideoContactSheet, scoreVideoContactSheet, VideoAnalysisError } from "./video";
import { deriveAction, deriveAudioRiskLevel, deriveAudioTrustScore, deriveImageRiskLevel, deriveImageTrustScore, derivePrimaryReason, deriveRiskLevel, deriveTrustSignals } from "./scoring";
import { agentsJson, faviconSvg, INDEXNOW_KEY, llmsTxt, llmsFullTxt, ogSvg, openApiSpec, robotsTxt, sitemapXml } from "./discovery";
import { authorizeExtension, exchangeExtensionCode, ExtensionAuthError, extensionConnectHtml, safeExtensionNextPath, safeRelativeNext, validateExtensionRedirectUri, validateExtensionState } from "./extensionAuth";
import { DEMO_IMAGE_CONTENT_TYPE, DEMO_IMAGE_PATH, demoImageBytes } from "./demoImage";
import { DEMO_AUDIO_CONTENT_TYPE, DEMO_AUDIO_PATH, demoAudioBytes } from "./demoAudio";
import { DEMO_VIDEO_CONTENT_TYPE, DEMO_VIDEO_PATH, demoVideoBytes } from "./demoVideo";
import { ogPngBytes } from "./ogPng";
import { aboutHtml, alternativesHtml, benchmark2026Html, blogIndexHtml, blogPostHtml, categoryHtml, changelogHtml, comparisonHtml, docsHtml, docsErrorsHtml, evalsHtml, examplesHtml, forAgentsHtml, howItWorksHtml, methodologyHtml, trustModelHtml, mcpHtml, pricingHtml, privacyHtml, subprocessorsHtml, securityHtml, termsHtml, requestAccessHtml, statusHtml, useCaseHtml, useCasesIndexHtml, vsIndexHtml, whatWeDetectHtml } from "./pages";
import { distributionPageHtml, distributionRedirectTarget } from "./distribution";
import { homepageHtml } from "./site";
import { y2kCss } from "./y2k";
import { welcomeHtml } from "./welcome";
import { WELCOME_IMAGE_STEP_1_PATH, WELCOME_IMAGE_STEP_2_PATH, WELCOME_RESULT_PATH, WELCOME_RIGHT_CLICK_PATH, WELCOME_SCREENSHOT_CONTENT_TYPE, welcomeImageStep1Bytes, welcomeImageStep2Bytes, welcomeResultBytes, welcomeRightClickBytes } from "./welcomeAssets";
import type { AnalyzeAudioResponse, AnalyzeBatchRequest, AnalyzeImageRequest, AnalyzeImageResponse, AnalyzeResponse, AnalyzeVideoResponse, Env } from "./types";
import { parseAnalyzeAudioRequest, parseAnalyzeBatchRequest, parseAnalyzeImageRequest, parseAnalyzeRequest, parseAnalyzeVideoRequest, parseUnifiedAnalyzeRequest, ValidationError } from "./validate";

const LIMITATIONS = [
  "Scores are probabilistic workflow risk signals, not proof of AI authorship or truth.",
  "v0.1 uses an LLM-backed structured scoring pass; treat synthetic_risk as texture risk, not ground-truth authorship detection.",
  "English-calibrated at MVP; non-English content should be treated as experimental.",
];

const IMAGE_LIMITATIONS = [
  "Scores are probabilistic workflow risk signals, not proof of AI authorship.",
  "v0.1 image scoring uses a vision LLM, not a calibrated synthetic-image classifier.",
  "Evidence is limited to visible artifacts; VeracityAPI does not inspect EXIF, C2PA Content Credentials, or provenance metadata in v0.1.",
  "Missing metadata, social compression, screenshots, and edited exports can lower trust in real workflows but are not used as proof of synthetic generation here.",
];

const AUDIO_LIMITATIONS = [
  "Gemini-powered audio workflow triage, not proof of AI generation.",
  "Not voice-clone proof, speaker identity verification, or forensic determination.",
  "Scores can be affected by compression, background noise, short clips, edits, music beds, and recording quality.",
];

const VIDEO_LIMITATIONS = [
  "Video authenticity-risk scoring is workflow triage, not forensic proof of AI generation or manipulation.",
  "MVP uses six sampled frames in a 3x2 contact sheet plus sanitized metadata; short artifacts outside sampled frames can be missed.",
  "Compression, edits, screen recordings, captions, and platform re-uploads can raise or lower visible synthetic-risk signals.",
];


const demoHits = new Map<string, { count: number; resetAt: number }>();
const loginHits = new Map<string, { count: number; resetAt: number }>();
const DEMO_MAX_CHARS = 4_000;
const GOOGLE_ANALYTICS_TAG = `<script>(function(){var id='cookie_consent';function load(){if(window.__vapGaLoaded)return;window.__vapGaLoaded=true;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-BMB8X59JBY';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','G-BMB8X59JBY',{anonymize_ip:true})}function ready(){if(localStorage.getItem(id)==='accepted')load()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();})();</script>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === "www.veracityapi.com") {
      return Response.redirect(`https://veracityapi.com${url.pathname}${url.search}`, 301);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...corsHeadersForRequest(request), ...securityHeaders(), "x-request-id": requestId() } });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/index.html")) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : homepageHtml());
    }

    // On the API hostname, /mcp is the machine-readable remote MCP endpoint.
    // Keep https://veracityapi.com/mcp as the human docs page below.
    if ((request.method === "GET" || request.method === "HEAD") && url.hostname === "api.veracityapi.com" && url.pathname === "/mcp") {
      return handleRemoteMcp(request, env);
    }

    const pageRoutes: Record<string, () => string> = {
      "/docs": docsHtml,
      "/docs/errors": docsErrorsHtml,
      "/what-we-detect": whatWeDetectHtml,
      "/welcome": welcomeHtml,
      "/how-it-works": howItWorksHtml,
      "/methodology": methodologyHtml,
      "/evals": evalsHtml,
      "/evals/2026-benchmark": benchmark2026Html,
      "/blog": blogIndexHtml,
      "/vs": vsIndexHtml,
      "/examples": examplesHtml,
      "/for-agents": forAgentsHtml,
      "/mcp": mcpHtml,
      "/use-cases": useCasesIndexHtml,
      "/pricing": pricingHtml,
      "/about": aboutHtml,
      "/status": statusHtml,
      "/changelog": changelogHtml,
      "/privacy": privacyHtml,
      "/subprocessors": subprocessorsHtml,
      "/security": securityHtml,
      "/terms": termsHtml,
      "/request-access": requestAccessHtml,
      "/alternatives": alternativesHtml,
    };
    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/trust" || url.pathname === "/trust-model")) {
      return Response.redirect(`${url.origin}/methodology`, 301);
    }

    const pageRenderer = pageRoutes[url.pathname];
    if ((request.method === "GET" || request.method === "HEAD") && pageRenderer) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      const noindex = url.pathname === "/evals/2026-benchmark" || url.pathname === "/vs";
      return html(request.method === "HEAD" ? "" : pageRenderer(), true, 200, noindex ? { "X-Robots-Tag": "noindex, follow" } : {});
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/vs/")) {
      const page = comparisonHtml(url.pathname.replace("/vs/", ""));
      if (!page) return notFound(request);
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : page, true, 200, { "X-Robots-Tag": "noindex, follow" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/blog/")) {
      const page = blogPostHtml(url.pathname.replace("/blog/", ""));
      if (!page) return notFound(request);
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : page);
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/use-cases/")) {
      const useCase = useCaseHtml(url.pathname.replace("/use-cases/", ""));
      if (!useCase) return notFound(request);
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : useCase);
    }


    if ((request.method === "GET" || request.method === "HEAD")) {
      const directCategory = categoryHtml(url.pathname.replace(/^\//, ""), url.pathname);
      if (directCategory) {
        if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
        return html(request.method === "HEAD" ? "" : directCategory);
      }
    }

    if (request.method === "POST" && url.pathname === "/request-access") {
      return handleAccessRequest(request, env);
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/account") {
      const account = await getSessionAccount(request, env);
      if (request.method === "GET") await logSiteEvent(env, request, account ? "account_view" : "signup_page_view", url.pathname, account ? { account_id: account.accountId } : {});
      const view = account ? await buildAccountView(env, account.accountId, account.email) : null;
      return html(request.method === "HEAD" ? "" : accountHtml(view, url.searchParams.get("message") || ""), false, 200, { "X-Robots-Tag": "noindex, nofollow" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/extension/connect") {
      return handleExtensionConnect(request, env, request.method === "HEAD");
    }
    if (request.method === "POST" && url.pathname === "/extension/connect/login") return handleExtensionConnectLogin(request, env);
    if (request.method === "POST" && url.pathname === "/extension/connect/authorize") return handleExtensionAuthorize(request, env);

    if (request.method === "POST" && url.pathname === "/auth/login") return handleLogin(request, env);
    if (request.method === "GET" && url.pathname === "/auth/callback") return handleCallback(request, env);
    if (request.method === "POST" && url.pathname === "/auth/logout") return handleLogout(request, env);
    if (request.method === "POST" && url.pathname === "/api-keys") return handleCreateApiKey(request, env);
    if (request.method === "POST" && /^\/api-keys\/[^/]+\/revoke$/.test(url.pathname)) return handleRevokeApiKey(request, env, url.pathname.split("/")[2]);
    if (request.method === "POST" && url.pathname === "/account/email") return handleUpdateEmail(request, env);
    if (request.method === "POST" && url.pathname === "/account/delete") return handleDeleteAccount(request, env);
    if (request.method === "POST" && url.pathname === "/billing/checkout") return handleCheckout(request, env);
    if (request.method === "POST" && url.pathname === "/billing/webhook") return handleStripeWebhook(request, env);

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/assets/site.css") {
      return text(request.method === "HEAD" ? "" : y2kCss(), "text/css; charset=utf-8", { "cache-control": "public, max-age=31536000, immutable" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/site.webmanifest") {
      return text(request.method === "HEAD" ? "" : JSON.stringify(siteManifest()), "application/manifest+json; charset=utf-8", { "cache-control": "public, max-age=31536000, immutable" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/openapi.json") {
      return text(request.method === "HEAD" ? "" : JSON.stringify(openApiSpec(), null, 2), "application/json; charset=utf-8", { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/.well-known/agents.json" || url.pathname === "/agents.json")) {
      return text(request.method === "HEAD" ? "" : JSON.stringify(agentsJson(), null, 2), "application/json; charset=utf-8", { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/.well-known/openai-apps-challenge") {
      return text(request.method === "HEAD" ? "" : "nt5gCIu8YUphsVdJnZO2ieBW5RLdqPX9AMo0ZoHIGv4", "text/plain; charset=utf-8", { "cache-control": "no-store" });
    }

    if ((request.method === "GET" || request.method === "HEAD")) {
      const redirectTarget = distributionRedirectTarget(url.pathname);
      if (redirectTarget) return Response.redirect(`${url.origin}${redirectTarget}`, 301);
      const distribution = distributionPageHtml(url.pathname);
      if (distribution) {
        if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
        return html(request.method === "HEAD" ? "" : distribution);
      }
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === `/${INDEXNOW_KEY}.txt`) {
      return text(request.method === "HEAD" ? "" : INDEXNOW_KEY, "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/llms.txt") {
      return text(request.method === "HEAD" ? "" : llmsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/llms-full.txt") {
      return text(request.method === "HEAD" ? "" : llmsFullTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
      return text(request.method === "HEAD" ? "" : sitemapXml(), "application/xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
      return text(request.method === "HEAD" ? "" : robotsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/.well-known/security.txt") {
      return text(request.method === "HEAD" ? "" : securityTxt(), "text/plain; charset=utf-8", { "cache-control": "public, max-age=3600" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/og.svg") {
      return text(request.method === "HEAD" ? "" : ogSvg(), "image/svg+xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/apple-touch-icon.png") {
      const iconBytes = ogPngBytes();
      return new Response(request.method === "HEAD" ? null : (iconBytes.buffer.slice(iconBytes.byteOffset, iconBytes.byteOffset + iconBytes.byteLength) as ArrayBuffer), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", ...securityHeaders(), "x-request-id": requestId() } });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/og.png") {
      const ogBytes = ogPngBytes();
      return new Response(request.method === "HEAD" ? null : (ogBytes.buffer.slice(ogBytes.byteOffset, ogBytes.byteOffset + ogBytes.byteLength) as ArrayBuffer), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", ...securityHeaders(), "x-request-id": requestId() } });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === WELCOME_RIGHT_CLICK_PATH || url.pathname === WELCOME_RESULT_PATH || url.pathname === WELCOME_IMAGE_STEP_1_PATH || url.pathname === WELCOME_IMAGE_STEP_2_PATH)) {
      const bytes = url.pathname === WELCOME_RIGHT_CLICK_PATH
        ? welcomeRightClickBytes()
        : url.pathname === WELCOME_RESULT_PATH
          ? welcomeResultBytes()
          : url.pathname === WELCOME_IMAGE_STEP_1_PATH
            ? welcomeImageStep1Bytes()
            : welcomeImageStep2Bytes();
      return new Response(request.method === "HEAD" ? null : bytes, { headers: { "content-type": WELCOME_SCREENSHOT_CONTENT_TYPE, "cache-control": "public, max-age=31536000, immutable", ...securityHeaders(), "x-request-id": requestId() } });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico")) {
      return text(request.method === "HEAD" ? "" : faviconSvg(), "image/svg+xml; charset=utf-8", { "cache-control": "public, max-age=31536000, immutable" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === DEMO_IMAGE_PATH) {
      return new Response(request.method === "HEAD" ? null : demoImageBytes(), {
        headers: {
          "content-type": DEMO_IMAGE_CONTENT_TYPE,
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        },
      });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === DEMO_AUDIO_PATH) {
      return new Response(request.method === "HEAD" ? null : demoAudioBytes().buffer as ArrayBuffer, {
        headers: {
          "content-type": DEMO_AUDIO_CONTENT_TYPE,
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        },
      });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === DEMO_VIDEO_PATH) {
      return new Response(request.method === "HEAD" ? null : demoVideoBytes().buffer as ArrayBuffer, {
        headers: {
          "content-type": DEMO_VIDEO_CONTENT_TYPE,
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        },
      });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json(request.method === "HEAD" ? null : { status: "ok", service: "veracityapi", version: env.MODEL_VERSION || "v0.1" });
    }

    if ((request.method === "GET" || request.method === "HEAD" || request.method === "POST") && url.pathname === "/mcp") {
      return handleRemoteMcp(request, env);
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze") {
      await logSiteEvent(env, request, "demo_run", url.pathname);
      return handleDemoAnalyze(request, env);
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze-image") {
      await logSiteEvent(env, request, "image_demo_run", url.pathname);
      return handleDemoAnalyzeImage(request, env);
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze-audio") {
      await logSiteEvent(env, request, "audio_demo_run", url.pathname);
      return handleDemoAnalyzeAudio(request, env);
    }


    if (request.method === "GET" && url.pathname === "/v1/balance") {
      return handleBalance(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/extension/exchange-token") {
      return handleExtensionExchangeToken(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze") {
      return handleUnifiedAnalyze(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-text") {
      return handleAnalyzeText(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-batch") {
      return handleAnalyzeBatch(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-image") {
      return handleAnalyzeImage(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-audio") {
      return handleAnalyzeAudio(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-video") {
      return handleAnalyzeVideo(request, env);
    }


    return notFound(request);
  },
};

function notFound(request: Request): Response {
  const accept = request.headers.get("accept") || "";
  const url = new URL(request.url);
  const apiClient = url.pathname.startsWith("/v1/") || url.pathname.startsWith("/demo/") || accept.includes("application/json") || !accept.includes("text/html");
  if (apiClient) return json({ error: "not_found" }, 404);
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>404 | VeracityAPI</title><meta name="robots" content="noindex"/><style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f1df;color:#15120d}.wrap{max-width:760px;margin:12vh auto;padding:24px}.card{border:2px solid #15120d;background:#fffdf4;box-shadow:6px 6px 0 #15120d;padding:28px}a{color:inherit}</style></head><body><main class="wrap"><section class="card"><p>404</p><h1>That page is unpublished or does not exist.</h1><p>Try the <a href="/docs">docs</a>, <a href="/use-cases">use cases</a>, or <a href="/">homepage</a>.</p></section></main></body></html>`, false, 404);
}

function securityTxt(): string {
  return `Contact: mailto:security@veracityapi.com
Preferred-Languages: en
Canonical: https://veracityapi.com/.well-known/security.txt
Policy: https://veracityapi.com/security
Hiring: https://veracityapi.com/
Expires: 2027-05-11T00:00:00Z
`;
}

async function handleAccessRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const company = cleanText(body.company, 160);
    const useCase = cleanText(body.use_case, 1200);
    const volume = cleanText(body.volume, 80);
    if (!name || !email || !useCase) return json({ error: "bad_request", message: "name, email, and use_case are required" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_request", message: "email must be valid" }, 400);
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const requestId = `req_${ulid()}`;
    await env.DB.prepare(`INSERT INTO access_requests (request_id, created_at, name, email, company, use_case, volume, source, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(requestId, new Date().toISOString(), name, email, company || null, useCase, volume || null, "website", await sha256Hex(ip), request.headers.get("user-agent") || null)
      .run();
    await logSiteEvent(env, request, "access_request", "/request-access", { request_id: requestId, volume });
    return json({ ok: true, request_id: requestId });
  } catch (err) {
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleDemoAnalyze(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    if (!consumeDemoQuota(ip, Number(env.DEMO_RATE_LIMIT_PER_HOUR || 12))) {
      return json({ error: "rate_limited", message: "Public demo limit reached. Try again later or create an account for $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests." }, 429, { "Retry-After": "3600" });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    if (typeof body.text !== "string" || body.text.length > DEMO_MAX_CHARS) {
      throw new ValidationError(`text: Demo text must be 20-${DEMO_MAX_CHARS} characters`);
    }

    const sanitized = {
      text: body.text,
      context: body.context,
      store_content: false,
    };
    const parsed = await parseAnalyzeRequest(jsonRequest(request.url, sanitized));
    const scored = await scoreText(parsed, env);
    const derived = deriveTrustSignals(scored.synthetic_risk, scored.slop_risk, scored.evidence);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: `demo_${ulid()}`,
      modality: "text",
      ...scored,
      ...derived,
      risk_level: riskLevel,
      recommended_action: action,
      primary_reason: derivePrimaryReason("text", scored),
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: LIMITATIONS,
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash: `demo:${await sha256Hex(ip)}`,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
    });
    const publicResponse = { ...response } as Record<string, unknown>;
    delete publicResponse.synthetic_texture_risk;
    return json(publicResponse);
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleDemoAnalyzeImage(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const cookieKey = request.headers.get("cookie")?.match(/veracity_demo=([^;]+)/)?.[1] || "nocookie";
    if (!consumeDemoQuota(`image:${ip}:${cookieKey}`, Number(env.DEMO_RATE_LIMIT_PER_HOUR || 12))) {
      return json({ error: "rate_limited", message: "Public image demo limit reached. Try again later or create an account for API access." }, 429, { "Retry-After": "3600" });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }
    const sanitized = { image_url: body.image_url, context: body.context, store_content: false };
    const parsed = await parseAnalyzeImageRequest(jsonRequest(request.url, sanitized));
    const scored = await scoreImage(parsed, env);
    const riskLevel = deriveImageRiskLevel(scored.synthetic_image_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeImageResponse = {
      analysis_id: `demo_img_${ulid()}`,
      modality: "image",
      ...scored,
      content_trust_score: deriveImageTrustScore(scored.synthetic_image_risk),
      risk_level: riskLevel,
      recommended_action: action,
      primary_reason: derivePrimaryReason("image", scored),
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: IMAGE_LIMITATIONS,
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash: `demo-image:${await sha256Hex(ip)}`,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
      kind: "image",
    });
    return json(response, 200, { "Set-Cookie": `veracity_demo=${cookieKey === "nocookie" ? ulid() : cookieKey}; Path=/; Max-Age=86400; SameSite=Lax; Secure` });
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError && /400|image|url|fetch|format|unsupported|too large|invalid/i.test(err.message)) return json({ error: "bad_request", message: "Image URL could not be analyzed. Check that it is a reachable supported image URL." }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}


async function handleDemoAnalyzeAudio(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const cookieKey = request.headers.get("cookie")?.match(/veracity_demo=([^;]+)/)?.[1] || "nocookie";
    if (!consumeDemoQuota(`audio:${ip}:${cookieKey}`, Number(env.DEMO_RATE_LIMIT_PER_HOUR || 12))) return json({ error: "rate_limited", message: "Public audio demo limit reached. Try again later or create an account for API access." }, 429, { "Retry-After": "3600" });
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { throw new ValidationError("Request body must be valid JSON"); }
    const parsed = await parseAnalyzeAudioRequest(jsonRequest(request.url, { audio_url: body.audio_url, transcript: body.transcript, context: body.context, store_content: false }));
    const scored = await scoreAudio(parsed, env);
    const riskLevel = deriveAudioRiskLevel(scored.synthetic_audio_risk, scored.workflow_risk);
    const response: AnalyzeAudioResponse = { analysis_id: `demo_aud_${ulid()}`, modality: "audio", ...scored, content_trust_score: deriveAudioTrustScore(scored.synthetic_audio_risk, scored.workflow_risk), risk_level: riskLevel, recommended_action: deriveAction(riskLevel, parsed.context.intended_use), primary_reason: derivePrimaryReason("audio", scored), model_version: env.MODEL_VERSION || "v0.1", limitations: AUDIO_LIMITATIONS };
    await logAnalysis({ env, analysisId: response.analysis_id, apiKeyHash: `demo-audio:${await sha256Hex(ip)}`, request: parsed, response, latencyMs: Date.now() - start, kind: "audio" });
    return json(response, 200, { "Set-Cookie": `veracity_demo=${cookieKey === "nocookie" ? ulid() : cookieKey}; Path=/; Max-Age=86400; SameSite=Lax; Secure` });
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError && /url|fetch|format|unsupported|too large|private|localhost|https|Gemini returned 400/i.test(err.message)) return json({ error: "bad_request", message: err.message.slice(0, 500) }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err); return json({ error: "internal_error" }, 500);
  }
}

async function handleBalance(request: Request, env: Env): Promise<Response> {
  try {
    const auth = await authenticateUsageKey(request, env);
    return json(await getBalanceSummary(env, auth.accountId));
  } catch (err) {
    if (err instanceof BillingAuthError) return json({ error: "unauthorized" }, 401);
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleUnifiedAnalyze(request: Request, env: Env): Promise<Response> {
  try {
    const parsed = await parseUnifiedAnalyzeRequest(request);
    if (parsed.type === "text") {
      return handleAnalyzeText(jsonRequestFrom(request, { text: parsed.content, context: parsed.context, privacy_mode: parsed.privacy_mode, auto_revise: parsed.auto_revise }), env);
    }
    if (parsed.type === "image") {
      const imageUrl = parsed.source?.kind === "url" ? parsed.source.url : typeof parsed.content === "string" ? parsed.content : undefined;
      return handleAnalyzeImage(jsonRequestFrom(request, { image_url: imageUrl, source: parsed.source, context: parsed.context, privacy_mode: parsed.privacy_mode }), env);
    }
    if (parsed.type === "audio") {
      const audioUrl = parsed.source?.kind === "url" ? parsed.source.url : typeof parsed.content === "string" ? parsed.content : undefined;
      return handleAnalyzeAudio(jsonRequestFrom(request, { audio_url: audioUrl, source: parsed.source, transcript: parsed.transcript, context: parsed.context, privacy_mode: parsed.privacy_mode }), env);
    }
    if (parsed.type === "video") {
      const videoUrl = parsed.source?.kind === "url" ? parsed.source.url : typeof parsed.content === "string" ? parsed.content : undefined;
      return handleAnalyzeVideo(jsonRequestFrom(request, { video_url: videoUrl, context: parsed.context, privacy_mode: parsed.privacy_mode }), env);
    }
    return json({ error: "bad_request", message: "asset input is validated and documented; production mixed-asset scoring is staged behind the async/multimodal implementation path" }, 400);
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleAnalyzeBatch(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  let debit: { accountId: string; apiKeyId: string; billing: NonNullable<AnalyzeResponse["billing"]>; batchId: string } | null = null;
  try {
    const auth = await authenticateUsageKey(request, env);
    const parsed = await parseAnalyzeBatchRequest(request);
    const batchId = `bat_${ulid()}`;
    const billing = await debitForBatchRequest(env, auth.accountId, auth.apiKeyId, batchId, parsed);
    debit = { accountId: auth.accountId, apiKeyId: auth.apiKeyId, billing, batchId };
    const results: Array<{ index: number; id: string; status: "succeeded"; analysis: AnalyzeResponse & { id?: string; batch_id?: string } } | { index: number; id: string; status: "failed"; error: { code: string; message: string; retryable: boolean } }> = [];
    for (const [index, item] of parsed.items.entries()) {
      try {
        const itemRequest = { text: item.text, context: parsed.context, privacy_mode: parsed.privacy_mode };
        const scored = await scoreText(itemRequest, env);
        const derived = deriveTrustSignals(scored.synthetic_risk, scored.slop_risk, scored.evidence);
        const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
        const action = deriveAction(riskLevel, parsed.context.intended_use);
        const response: AnalyzeResponse & { id?: string; batch_id?: string } = {
          id: item.id,
          batch_id: batchId,
          analysis_id: `ana_${ulid()}`,
          modality: "text",
          ...scored,
          ...derived,
          risk_level: riskLevel,
          recommended_action: action,
          primary_reason: derivePrimaryReason("text", scored),
          model_version: env.MODEL_VERSION || "v0.1",
          limitations: LIMITATIONS,
        };
        await logAnalysis({
          env,
          analysisId: response.analysis_id,
          apiKeyHash: auth.apiKeyHash,
          request: itemRequest,
          response,
          latencyMs: Date.now() - start,
          kind: "text",
        });
        results.push({ index, id: item.id, status: "succeeded", analysis: response });
      } catch (err) {
        results.push({
          index,
          id: item.id,
          status: "failed",
          error: {
            code: err instanceof LlmError ? "model_unavailable" : "item_failed",
            message: err instanceof Error ? err.message : "Item analysis failed",
            retryable: err instanceof LlmError,
          },
        });
      }
    }
    const failedCount = results.filter((item) => item.status === "failed").length;
    const succeededCount = results.length - failedCount;
    const status = failedCount === 0 ? "completed" : succeededCount === 0 ? "failed" : "completed_with_errors";
    return json({ batch_id: batchId, status, partial_failure: failedCount > 0, results, ...(billing ? { billing } : {}) });
  } catch (err) {
    if (debit && (err instanceof LlmError)) await refundUsage(env, debit.accountId, debit.apiKeyId, debit.batchId, debit.billing, "llm_unavailable");
    if (err instanceof BillingAuthError) return json({ error: "unauthorized" }, 401);
    if (err instanceof InsufficientBalanceError) return json({ error: "insufficient_balance", message: `This batch costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, 402);
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}


async function handleAnalyzeText(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  let debit: { accountId: string; apiKeyId: string; billing: NonNullable<AnalyzeResponse["billing"]>; analysisId: string } | null = null;
  try {
    const auth = await authenticateUsageKey(request, env);
    const parsed = await parseAnalyzeRequest(request);
    const analysisId = `ana_${ulid()}`;
    const billing = await debitForRequest(env, auth.accountId, auth.apiKeyId, analysisId, parsed);
    debit = { accountId: auth.accountId, apiKeyId: auth.apiKeyId, billing, analysisId };
    const scored = await scoreText(parsed, env);
    const derived = deriveTrustSignals(scored.synthetic_risk, scored.slop_risk, scored.evidence);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: analysisId,
      modality: "text",
      ...scored,
      ...derived,
      risk_level: riskLevel,
      recommended_action: action,
      primary_reason: derivePrimaryReason("text", scored),
      ...(parsed.auto_revise === true && action === "revise" ? await reviseText(parsed, scored.recommended_fixes, env) : {}),
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: LIMITATIONS,
      ...(billing ? { billing } : {}),
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash: auth.apiKeyHash,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
      kind: "text",
    });
    await logApiCallSuccess(env, request, auth.accountId, auth.apiKeyId, "text", response.analysis_id);
    return jsonForRequest(response, request);
  } catch (err) {
    if (debit && (err instanceof LlmError)) await refundUsage(env, debit.accountId, debit.apiKeyId, debit.analysisId, debit.billing, "llm_unavailable");
    if (err instanceof BillingAuthError) return jsonForRequest({ error: "unauthorized" }, request, 401);
    if (err instanceof InsufficientBalanceError) return jsonForRequest({ error: "insufficient_balance", message: `This request costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, request, 402);
    if (err instanceof ValidationError) return jsonForRequest({ error: "bad_request", message: err.message }, request, 400);
    if (err instanceof LlmError) return jsonForRequest({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, request, 503, { "Retry-After": "10" });
    console.error(err);
    return jsonForRequest({ error: "internal_error" }, request, 500);
  }
}

async function handleAnalyzeImage(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  let auth: Awaited<ReturnType<typeof authenticateUsageKey>> | null = null;
  let parsed: AnalyzeImageRequest | null = null;
  let debit: { accountId: string; apiKeyId: string; billing: NonNullable<AnalyzeImageResponse["billing"]>; analysisId: string } | null = null;
  try {
    auth = await authenticateUsageKey(request, env);
    parsed = await parseAnalyzeImageRequest(request);
    const analysisId = `img_${ulid()}`;
    const billing = await debitForImage(env, auth.accountId, auth.apiKeyId, analysisId);
    debit = { accountId: auth.accountId, apiKeyId: auth.apiKeyId, billing, analysisId };
    const scored = await scoreImage(parsed, env);
    const riskLevel = deriveImageRiskLevel(scored.synthetic_image_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeImageResponse = {
      analysis_id: analysisId,
      modality: "image",
      ...scored,
      content_trust_score: deriveImageTrustScore(scored.synthetic_image_risk),
      risk_level: riskLevel,
      recommended_action: action,
      primary_reason: derivePrimaryReason("image", scored),
      model_version: env.MODEL_VERSION || "v0.1",
      limitations: IMAGE_LIMITATIONS,
      ...(billing ? { billing } : {}),
    };
    await logAnalysis({
      env,
      analysisId: response.analysis_id,
      apiKeyHash: auth.apiKeyHash,
      request: parsed,
      response,
      latencyMs: Date.now() - start,
      kind: "image",
    });
    await logApiCallSuccess(env, request, auth.accountId, auth.apiKeyId, "image", response.analysis_id);
    return jsonForRequest(response, request);
  } catch (err) {
    if (debit && (err instanceof LlmError)) await refundUsage(env, debit.accountId, debit.apiKeyId, debit.analysisId, debit.billing, "llm_unavailable");
    if (auth && parsed) await logImageAnalysisFailure(env, request, auth, parsed, err);
    if (err instanceof BillingAuthError) return jsonForRequest({ error: "unauthorized" }, request, 401);
    if (err instanceof InsufficientBalanceError) return jsonForRequest({ error: "insufficient_balance", message: `This request costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, request, 402);
    if (err instanceof ValidationError) return jsonForRequest({ error: "bad_request", message: err.message }, request, 400);
    if (err instanceof LlmError && /400|image|url|fetch|format|unsupported|too large|invalid/i.test(err.message)) return jsonForRequest({ error: "bad_request", message: "Image URL could not be analyzed. Check that it is a reachable supported image URL." }, request, 400);
    if (err instanceof LlmError) return jsonForRequest({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, request, 503, { "Retry-After": "10" });
    console.error(err);
    return jsonForRequest({ error: "internal_error" }, request, 500);
  }
}




async function handleAnalyzeVideo(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const auth = await authenticateUsageKey(request, env);
    const parsed = await parseAnalyzeVideoRequest(request);
    const analysisId = `vid_${ulid()}`;
    const extraction = await extractVideoContactSheet(env, parsed);
    const scored = await scoreVideoContactSheet(env, parsed, extraction);
    const rawBilling = await debitForVideo(env, auth.accountId, auth.apiKeyId, analysisId);
    const billing = { units_analyzed: rawBilling.units_analyzed ?? 1, bucket: rawBilling.bucket, price_cents: rawBilling.price_cents, remaining_balance_cents: rawBilling.remaining_balance_cents };
    const response: AnalyzeVideoResponse = { ...buildAnalyzeVideoResponse(analysisId, scored, extraction, env.VIDEO_VISION_MODEL || env.ANTHROPIC_MODEL || env.MODEL_VERSION || "claude-haiku-4-5-20251001"), limitations: VIDEO_LIMITATIONS, billing };
    await logAnalysis({ env, analysisId, apiKeyHash: auth.apiKeyHash, request: parsed, response, latencyMs: Date.now() - start, kind: "video" });
    await logApiCallSuccess(env, request, auth.accountId, auth.apiKeyId, "video", response.analysis_id);
    return jsonForRequest(response, request);
  } catch (err) {
    if (err instanceof BillingAuthError) return jsonForRequest({ error: "unauthorized" }, request, 401);
    if (err instanceof InsufficientBalanceError) return jsonForRequest({ error: "insufficient_balance", message: `This video analysis costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, request, 402);
    if (err instanceof ValidationError) return jsonForRequest({ error: "bad_request", message: err.message }, request, 400);
    if (err instanceof VideoAnalysisError && /download|format|unsupported|too large|private|localhost|https/i.test(err.message)) return jsonForRequest({ error: "bad_request", message: err.message }, request, 400);
    if (err instanceof VideoAnalysisError) return jsonForRequest({ error: "video_unavailable", message: "Video scoring unavailable. Retry shortly." }, request, err.status || 503, { "Retry-After": "10" });
    console.error(err); return jsonForRequest({ error: "internal_error" }, request, 500);
  }
}

async function handleAnalyzeAudio(request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  let debit: { accountId: string; apiKeyId: string; billing: NonNullable<AnalyzeAudioResponse["billing"]>; analysisId: string } | null = null;
  try {
    const auth = await authenticateUsageKey(request, env);
    const parsed = await parseAnalyzeAudioRequest(request);
    const analysisId = `aud_${ulid()}`;
    const rawBilling = await debitForAudio(env, auth.accountId, auth.apiKeyId, analysisId);
    const billing = { units_analyzed: rawBilling.units_analyzed ?? 1, bucket: rawBilling.bucket, price_cents: rawBilling.price_cents, remaining_balance_cents: rawBilling.remaining_balance_cents };
    debit = { accountId: auth.accountId, apiKeyId: auth.apiKeyId, billing, analysisId };
    const scored = await scoreAudio(parsed, env);
    const riskLevel = deriveAudioRiskLevel(scored.synthetic_audio_risk, scored.workflow_risk);
    const response: AnalyzeAudioResponse = { analysis_id: analysisId, modality: "audio", ...scored, content_trust_score: deriveAudioTrustScore(scored.synthetic_audio_risk, scored.workflow_risk), risk_level: riskLevel, recommended_action: deriveAction(riskLevel, parsed.context.intended_use), primary_reason: derivePrimaryReason("audio", scored), model_version: env.MODEL_VERSION || "v0.1", limitations: AUDIO_LIMITATIONS, billing };
    await logAnalysis({ env, analysisId, apiKeyHash: auth.apiKeyHash, request: parsed, response, latencyMs: Date.now() - start, kind: "audio" });
    await logApiCallSuccess(env, request, auth.accountId, auth.apiKeyId, "audio", response.analysis_id);
    return json(response);
  } catch (err) {
    if (debit && err instanceof LlmError) await refundUsage(env, debit.accountId, debit.apiKeyId, debit.analysisId, debit.billing, "llm_unavailable");
    if (err instanceof BillingAuthError) return json({ error: "unauthorized" }, 401);
    if (err instanceof InsufficientBalanceError) return json({ error: "insufficient_balance", message: `This audio analysis costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, 402);
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError && /url|fetch|format|unsupported|too large|private|localhost|https/i.test(err.message)) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err); return json({ error: "internal_error" }, 500);
  }
}

async function handleExtensionConnect(request: Request, env: Env, head = false): Promise<Response> {
  const url = new URL(request.url);
  try {
    const redirectUri = validateExtensionRedirectUri(url.searchParams.get("redirect_uri") || "");
    const state = validateExtensionState(url.searchParams.get("state") || "");
    const account = await getSessionAccount(request, env);
    if (!head) await logSiteEvent(env, request, "extension_connect_view", "/extension/connect", account ? { account_id: account.accountId } : {});
    return html(head ? "" : extensionConnectHtml({ redirectUri, state, loggedInEmail: account?.email, message: url.searchParams.get("message") || "" }), false);
  } catch (err) {
    if (err instanceof ExtensionAuthError) return html(head ? "" : extensionConnectHtml({ redirectUri: "", state: "", message: err.message }), false, 400);
    console.error(err);
    return html(head ? "" : "Could not start extension connection.", false, 500);
  }
}

async function handleExtensionConnectLogin(request: Request, env: Env): Promise<Response> {
  try {
    const params = parseForm(await request.text());
    const email = cleanEmail(params.get("email") || "");
    const redirectUri = validateExtensionRedirectUri(params.get("redirect_uri") || "");
    const state = validateExtensionState(params.get("state") || "");
    if (!validEmail(email)) return html(extensionConnectHtml({ redirectUri, state, message: "Enter a valid email address." }), false, 400);
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const emailHash = await sha256Hex(email);
    if (!consumeLoginQuota(`ip:${ip}`, Number(env.LOGIN_RATE_LIMIT_PER_HOUR || 12)) || !consumeLoginQuota(`email:${emailHash}`, Number(env.LOGIN_RATE_LIMIT_PER_HOUR || 3))) {
      return html(extensionConnectHtml({ redirectUri, state, message: "Too many login link requests. Try again in about an hour." }), false, 429);
    }
    const nextPath = safeExtensionNextPath(redirectUri, state);
    const link = await createMagicLink(email, request, env, nextPath);
    await sendMagicLink(env, email, link);
    await logSiteEvent(env, request, "extension_login_link_requested", "/extension/connect", { email_hash: emailHash });
    return html(extensionConnectHtml({ redirectUri, state, message: "Login link sent. Check your email, then this connection window will continue." }), false);
  } catch (err) {
    if (err instanceof ExtensionAuthError) return html(extensionConnectHtml({ redirectUri: "", state: "", message: err.message }), false, 400);
    console.error(err);
    return html("Could not send extension login email yet. Try again shortly.", false, 500);
  }
}

async function handleExtensionAuthorize(request: Request, env: Env): Promise<Response> {
  try {
    const wantsJson = request.headers.get("accept")?.includes("application/json") || request.headers.get("x-requested-with") === "fetch";
    const response = await authorizeExtension(request, env, wantsJson);
    await logSiteEvent(env, request, "extension_authorized", "/extension/connect");
    return response;
  } catch (err) {
    if (err instanceof ExtensionAuthError) return jsonForRequest({ error: err.code, message: err.message }, request, 400);
    console.error(err);
    return jsonForRequest({ error: "internal_error" }, request, 500);
  }
}

async function handleExtensionExchangeToken(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : "";
    const result = await exchangeExtensionCode(env, code);
    await logSiteEvent(env, request, "extension_token_exchanged", "/v1/extension/exchange-token", { account_id: result.account_id, key_id: result.key_id });
    return jsonForRequest(result, request);
  } catch (err) {
    if (err instanceof ExtensionAuthError) return jsonForRequest({ error: err.code, message: err.message }, request, 400);
    console.error(err);
    return jsonForRequest({ error: "internal_error" }, request, 500);
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const params = parseForm(await request.text());
    const email = cleanEmail(params.get("email") || "");
    if (!validEmail(email)) return html(accountHtml(null, "Enter a valid email address."), false);
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const emailHash = await sha256Hex(email);
    if (!consumeLoginQuota(`ip:${ip}`, Number(env.LOGIN_RATE_LIMIT_PER_HOUR || 12)) || !consumeLoginQuota(`email:${emailHash}`, Number(env.LOGIN_RATE_LIMIT_PER_HOUR || 3))) {
      return html(accountHtml(null, "Too many login link requests. Try again in about an hour."), false, 429);
    }
    const link = await createMagicLink(email, request, env);
    await sendMagicLink(env, email, link);
    await logSiteEvent(env, request, "login_link_requested", "/account", { email_hash: emailHash });
    return html(accountHtml(null, "Login link sent. Check your email."), false);
  } catch (err) {
    console.error(err);
    return html(accountHtml(null, "Could not send login email yet. If DNS verification is still pending, try again shortly."), false);
  }
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  try {
    const session = await consumeMagicLink(env, token);
    await logSiteEvent(env, request, "account_login", "/auth/callback", { account_id: session.accountId });
    const next = safeRelativeNext(url.searchParams.get("next") || "");
    return redirect(next || "/account?message=Logged+in", { "Set-Cookie": sessionCookie(session.sessionToken) });
  } catch {
    return redirect("/account?message=Login+link+expired+or+invalid");
  }
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const account = await getSessionAccount(request, env);
  if (account) await env.DB.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(account.accountId).run();
  return redirect("/account?message=Logged+out", { "Set-Cookie": clearSessionCookie() });
}

async function handleCreateApiKey(request: Request, env: Env): Promise<Response> {
  const account = await requireAccount(request, env);
  if (account instanceof Response) return account;
  const params = parseForm(await request.text());
  const label = (params.get("label") || "default").slice(0, 80);
  const created = await createApiKey(env, account.accountId, label);
  await logSiteEvent(env, request, "api_key_created", "/api-keys", { account_id: account.accountId, key_id: created.keyId, label });
  const view = await buildAccountView(env, account.accountId, account.email);
  return html(accountHtml(view, `API key created. Copy it now: ${created.key}`), false);
}

async function handleRevokeApiKey(request: Request, env: Env, keyId: string): Promise<Response> {
  const account = await requireAccount(request, env);
  if (account instanceof Response) return account;
  await env.DB.prepare(`UPDATE api_keys SET status = 'revoked', revoked_at = ? WHERE key_id = ? AND account_id = ?`).bind(new Date().toISOString(), keyId, account.accountId).run();
  return redirect("/account?message=API+key+revoked");
}

async function handleUpdateEmail(request: Request, env: Env): Promise<Response> {
  const account = await requireAccount(request, env);
  if (account instanceof Response) return account;
  const email = cleanEmail(parseForm(await request.text()).get("email") || "");
  if (!validEmail(email)) return redirect("/account?message=Invalid+email");
  try {
    await env.DB.prepare(`UPDATE accounts SET email = ?, updated_at = ? WHERE account_id = ?`).bind(email, new Date().toISOString(), account.accountId).run();
    return redirect("/account?message=Email+updated");
  } catch {
    return redirect("/account?message=Email+already+exists");
  }
}

async function handleDeleteAccount(request: Request, env: Env): Promise<Response> {
  const account = await requireAccount(request, env);
  if (account instanceof Response) return account;
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE account_id = ?`).bind(now, now, account.accountId).run();
  await env.DB.prepare(`UPDATE api_keys SET status = 'revoked', revoked_at = ? WHERE account_id = ?`).bind(now, account.accountId).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE account_id = ?`).bind(account.accountId).run();
  return redirect("/account?message=Account+deleted", { "Set-Cookie": clearSessionCookie() });
}

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const account = await requireAccount(request, env);
  if (account instanceof Response) return account;
  if (!env.STRIPE_SECRET_KEY) return redirect("/account?message=Stripe+is+not+configured");
  const packId = parseForm(await request.text()).get("pack") || "starter";
  const pack = CREDIT_PACKS[packId] || CREDIT_PACKS.starter;
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/account?message=Checkout+complete.+Credits+will+appear+after+webhook+confirmation`,
    cancel_url: `${origin}/account?message=Checkout+canceled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(pack.amountCents),
    "line_items[0][price_data][product_data][name]": `VeracityAPI ${pack.label}`,
    "metadata[account_id]": account.accountId,
    "metadata[amount_cents]": String(pack.amountCents),
    customer_email: account.email,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" }, body: params });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || !data.url || !data.id) {
    console.error("stripe_checkout_failed", data);
    return redirect("/account?message=Stripe+checkout+failed");
  }
  await env.DB.prepare(`INSERT INTO checkout_sessions (checkout_id, account_id, stripe_session_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, 'created', ?)`).bind(`chk_${ulid()}`, account.accountId, String(data.id), pack.amountCents, new Date().toISOString()).run();
  return redirect(String(data.url));
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") || "";
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "webhook_secret_not_configured" }, 503);
  if (!(await verifyStripeWebhook(body, sig, env.STRIPE_WEBHOOK_SECRET))) return json({ error: "bad_signature" }, 400);
  const event = JSON.parse(body) as { type: string; data?: { object?: Record<string, unknown> } };
  if (event.type === "checkout.session.completed" && event.data?.object) await creditCheckoutSession(env, event.data.object);
  if (event.type === "checkout.session.expired" && event.data?.object?.id) await env.DB.prepare(`UPDATE checkout_sessions SET status = 'expired' WHERE stripe_session_id = ?`).bind(String(event.data.object.id)).run();
  return json({ received: true });
}

async function logImageAnalysisFailure(env: Env, request: Request, auth: Awaited<ReturnType<typeof authenticateUsageKey>>, parsed: AnalyzeImageRequest, err: unknown): Promise<void> {
  await logSiteEvent(env, request, "image_analysis_failed", "/v1/analyze-image", {
    account_id: auth.accountId,
    api_key_id: auth.apiKeyId,
    image_url_domain: imageUrlDomain(parsed.image_url),
    error_code: imageAnalysisErrorCode(err),
  });
}

function imageUrlDomain(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function imageAnalysisErrorCode(err: unknown): string {
  if (err instanceof InsufficientBalanceError) return "insufficient_balance";
  if (err instanceof ValidationError) return "bad_request";
  if (err instanceof LlmError && /400|image|url|fetch|format|unsupported|too large|invalid/i.test(err.message)) return "bad_image_url";
  if (err instanceof LlmError) return "llm_unavailable";
  return "internal_error";
}

async function logApiCallSuccess(env: Env, request: Request, accountId: string, apiKeyId: string, modality: string, analysisId: string): Promise<void> {
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM usage_events WHERE account_id = ?`).bind(accountId).first<{ count: number }>();
    const usageCount = Number(row?.count ?? 0);
    await logSiteEvent(env, request, usageCount <= 1 ? "first_api_call" : "api_call_success", "/v1/analyze", { account_id: accountId, api_key_id: apiKeyId, modality, analysis_id: analysisId, usage_count: usageCount });
  } catch (err) {
    console.warn("api_call_event_failed", err);
  }
}

async function logSiteEvent(env: Env, request: Request, eventName: string, path: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    await env.DB.prepare(`INSERT INTO site_events (event_id, created_at, event_name, path, ip_hash, user_agent, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`evt_${ulid()}`, new Date().toISOString(), eventName, path, await sha256Hex(ip), request.headers.get("user-agent") || null, JSON.stringify(metadata))
      .run();
  } catch (err) {
    console.warn("site_event_log_failed", err);
  }
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function consumeLoginQuota(key: string, limit: number): boolean {
  return consumeWindowQuota(loginHits, key, limit);
}

function consumeDemoQuota(key: string, limit: number): boolean {
  return consumeWindowQuota(demoHits, key, limit);
}

function consumeWindowQuota(store: Map<string, { count: number; resetAt: number }>, key: string, limit: number): boolean {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  for (const [k, value] of store.entries()) {
    if (value.resetAt <= now) store.delete(k);
  }
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + hour });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function jsonRequestFrom(source: Request, body: unknown): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const authorization = source.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  return new Request(source.url, { method: "POST", headers, body: JSON.stringify(body) });
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MCP_ANALYSIS_OUTPUT_SCHEMA = {
  type: "object",
  required: ["analysis_id", "modality", "risk_level", "recommended_action", "primary_reason", "confidence", "evidence", "recommended_fixes", "model_version", "limitations"],
  properties: {
    analysis_id: { type: "string" },
    modality: { type: "string", enum: ["text", "image", "audio", "asset", "content"] },
    content_trust_score: { type: "number", minimum: 0, maximum: 1 },
    synthetic_risk: { type: "number", minimum: 0, maximum: 1 },
    slop_risk: { type: "number", minimum: 0, maximum: 1 },
    synthetic_image_risk: { type: "number", minimum: 0, maximum: 1 },
    synthetic_audio_risk: { type: "number", minimum: 0, maximum: 1 },
    workflow_risk: { type: "number", minimum: 0, maximum: 1 },
    transcript: { type: "string" },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    recommended_action: { type: "string", enum: ["allow", "revise", "human_review", "reject"] },
    primary_reason: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    evidence: { type: "array", items: { type: "object" } },
    recommended_fixes: { type: "array", items: { type: "string" } },
    revised_text: { type: "string" },
    revision_notes: { type: "array", items: { type: "string" } },
    billing: { type: "object" },
    model_version: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
  },
} as const;

const MCP_BATCH_OUTPUT_SCHEMA = {
  type: "object",
  required: ["batch_id", "status", "partial_failure", "results"],
  properties: {
    batch_id: { type: "string" },
    status: { type: "string", enum: ["completed", "completed_with_errors", "failed"] },
    partial_failure: { type: "boolean" },
    results: { type: "array", items: { type: "object" } },
    billing: { type: "object" },
  },
} as const;

const MCP_BALANCE_OUTPUT_SCHEMA = {
  type: "object",
  required: ["account_id", "balance_cents", "currency", "recent_usage"],
  properties: {
    account_id: { type: "string" },
    balance_cents: { type: "integer" },
    currency: { type: "string", enum: ["USD"] },
    last_usage_at: { type: ["string", "null"] },
    recent_usage: { type: "object" },
  },
} as const;

const MCP_TOOLS = [
  {
    name: "analyze_text",
    description: "Analyze text for content trust, specificity risk, weak provenance, slop risk, evidence, and recommended workflow action. Workflow triage only; not proof of AI authorship or truth.",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 20, maxLength: 100000 },
        context: mcpContextSchema(),
        store_content: { type: "boolean", default: false, description: "Default false. Do not store raw content unless explicitly needed for audit/debug." },
        privacy_mode: { type: "boolean", default: true, deprecated: true, description: "Legacy alias. Prefer store_content:false." },
        auto_revise: { type: "boolean", default: false, description: "When true, bill Analyze + revise at $0.010 per 1k chars and return revised_text only when recommended_action=revise." },
      },
    },
    outputSchema: MCP_ANALYSIS_OUTPUT_SCHEMA,
  },
  {
    name: "analyze_image",
    description: "Analyze an HTTPS image URL for visible synthetic-image artifact risk, content trust score, evidence, and recommended workflow action. Not forensic proof of AI authorship, provenance, identity, or truth.",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      required: ["image_url"],
      properties: {
        image_url: { type: "string", format: "uri", maxLength: 2000, description: "HTTPS image URL to analyze." },
        context: mcpContextSchema(),
        store_content: { type: "boolean", default: false, description: "No raw image bytes or full URLs are stored; only URL hash and hostname are logged." },
        privacy_mode: { type: "boolean", default: true, deprecated: true },
      },
    },
    outputSchema: MCP_ANALYSIS_OUTPUT_SCHEMA,
  },
  {
    name: "analyze_audio",
    description: "Analyze a short HTTPS audio URL for synthetic-audio workflow triage. Stores no audio bytes/base64/full URL. Not proof of AI generation, voice cloning, speaker identity, or truth.",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      required: ["audio_url"],
      properties: {
        audio_url: { type: "string", format: "uri", maxLength: 2000, description: "HTTPS audio URL. Supports common short audio formats up to 4 MB." },
        transcript: { type: "string", maxLength: 10000, description: "Optional caller-supplied transcript/context. VeracityAPI also returns a Gemini-generated transcript." },
        context: mcpContextSchema(),
        store_content: { type: "boolean", default: false, description: "No raw audio bytes, base64, or full URLs are stored; only URL hash and hostname are logged." },
        privacy_mode: { type: "boolean", default: true, deprecated: true },
      },
    },
    outputSchema: MCP_ANALYSIS_OUTPUT_SCHEMA,
  },
  {
    name: "analyze_batch",
    description: "Analyze 1-25 short text items in one bounded synchronous batch. Use before autonomous publishing/moderation loops.",
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      required: ["items"],
      properties: {
        items: { type: "array", minItems: 1, maxItems: 25, items: { type: "object", required: ["id", "text"], properties: { id: { type: "string", minLength: 1, maxLength: 120 }, text: { type: "string", minLength: 20, maxLength: 4000 } } } },
        context: mcpContextSchema(),
        store_content: { type: "boolean", default: false },
        privacy_mode: { type: "boolean", default: true, deprecated: true },
      },
    },
    outputSchema: MCP_BATCH_OUTPUT_SCHEMA,
  },
  { name: "check_balance", description: "Get VeracityAPI account credit balance and recent usage before running agent analysis loops.", annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }, inputSchema: { type: "object", properties: {} }, outputSchema: MCP_BALANCE_OUTPUT_SCHEMA },
  { name: "get_balance", description: "Compatibility alias for check_balance.", annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }, inputSchema: { type: "object", properties: {} }, outputSchema: MCP_BALANCE_OUTPUT_SCHEMA },
] as const;

function mcpContextSchema() {
  return {
    type: "object",
    properties: {
      format: { type: "string", enum: ["article", "social_post", "product_review", "caption", "other"], default: "other" },
      intended_use: { type: "string", enum: ["publish", "train", "cite", "moderate", "other"], default: "other" },
      domain: { type: "string", maxLength: 100 },
    },
  };
}

async function handleRemoteMcp(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET" || request.method === "HEAD") {
    return json(request.method === "HEAD" ? null : {
      name: "veracityapi",
      version: "0.1.0",
      transport: "streamable_http_jsonrpc",
      endpoint: "https://api.veracityapi.com/mcp",
      auth: "Authorization: Bearer VERACITY_API_KEY",
      tools: MCP_TOOLS.map((tool) => tool.name),
    });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return mcpHttpResponse(mcpError(null, -32700, "Parse error"), 400);
  }
  const isBatch = Array.isArray(payload);
  const messages = isBatch ? payload : [payload];
  const responses = [];
  for (const message of messages) {
    const response = await handleMcpMessage(message, request, env);
    if (response !== null) responses.push(response);
  }
  if (responses.length === 0) return new Response(null, { status: 202, headers: corsHeaders() });
  return mcpHttpResponse(isBatch ? responses : responses[0]);
}

async function handleMcpMessage(message: any, source: Request, env: Env): Promise<Record<string, unknown> | null> {
  const id = message?.id ?? null;
  const method = message?.method;
  if (!id && typeof method === "string" && method.startsWith("notifications/")) return null;

  if (method === "initialize") {
    return mcpResult(id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "veracityapi", version: "0.1.0" },
      instructions: "Use VeracityAPI as a content, image, and audio workflow-risk gate for agents. Return recommended_action and evidence; do not treat outputs as forensic proof.",
    });
  }
  if (method === "ping") return mcpResult(id, {});
  if (method === "tools/list") return mcpResult(id, { tools: MCP_TOOLS });
  if (method === "tools/call") return callMcpTool(id, String(message?.params?.name || ""), message?.params?.arguments || {}, source, env);
  return mcpError(id, -32601, `Method not found: ${method || "unknown"}`);
}

async function callMcpTool(id: unknown, name: string, args: Record<string, unknown>, source: Request, env: Env): Promise<Record<string, unknown>> {
  try {
    let response: Response;
    if (name === "analyze_text") {
      response = await handleUnifiedAnalyze(mcpApiRequest(source, "/v1/analyze", { type: "text", content: args.text, context: args.context, store_content: args.store_content ?? (args.privacy_mode === undefined ? false : !args.privacy_mode), auto_revise: args.auto_revise }), env);
    } else if (name === "analyze_image") {
      response = await handleUnifiedAnalyze(mcpApiRequest(source, "/v1/analyze", { type: "image", content: args.image_url, context: args.context, store_content: false }), env);
    } else if (name === "analyze_audio") {
      response = await handleUnifiedAnalyze(mcpApiRequest(source, "/v1/analyze", { type: "audio", content: args.audio_url, transcript: args.transcript, context: args.context, store_content: false }), env);
    } else if (name === "analyze_batch") {
      response = await handleAnalyzeBatch(mcpApiRequest(source, "/v1/analyze-batch", { items: args.items, context: args.context, store_content: args.store_content ?? false }), env);
    } else if (name === "check_balance" || name === "get_balance") {
      response = await handleBalance(mcpApiRequest(source, "/v1/balance", null, "GET"), env);
    } else {
      return mcpResult(id, { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] });
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return mcpResult(id, { isError: true, content: [{ type: "text", text: formatMcpApiError(response.status, result) }, { type: "text", text: JSON.stringify(result, null, 2) }] });
    return mcpResult(id, { structuredContent: result, content: [{ type: "text", text: summarizeMcpResult(name, result) }, { type: "text", text: JSON.stringify(result, null, 2) }] });
  } catch (err) {
    return mcpResult(id, { isError: true, content: [{ type: "text", text: err instanceof Error ? err.message : "Tool call failed" }] });
  }
}

function mcpApiRequest(source: Request, path: string, body: unknown, method: "GET" | "POST" = "POST"): Request {
  const url = new URL(source.url);
  const headers = new Headers();
  const authorization = mcpAuthorization(source);
  if (authorization) headers.set("authorization", authorization);
  if (method === "POST") headers.set("content-type", "application/json");
  return new Request(`${url.origin}${path}`, { method, headers, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
}

function mcpAuthorization(source: Request): string | null {
  const header = source.headers.get("authorization");
  if (header) return header;

  // Claude.ai custom connectors currently do not expose a UI field for custom
  // Authorization headers. Accepting a token in the connector URL is a pragmatic
  // fallback for hosted MCP clients that cannot send headers. Prefer headers or
  // the local stdio MCP package when the client supports them.
  const url = new URL(source.url);
  const queryToken = url.searchParams.get("api_key") || url.searchParams.get("key") || url.searchParams.get("token");
  if (queryToken && /^vap_[A-Za-z0-9]+$/.test(queryToken)) return `Bearer ${queryToken}`;

  const apiKeyHeader = source.headers.get("x-veracity-api-key");
  if (apiKeyHeader && /^vap_[A-Za-z0-9]+$/.test(apiKeyHeader)) return `Bearer ${apiKeyHeader}`;

  return null;
}

function summarizeMcpResult(name: string, result: any): string {
  if (name === "check_balance" || name === "get_balance") return `Balance: $${((Number(result.balance_cents || 0)) / 100).toFixed(2)} ${result.currency || "USD"}.`;
  if (name === "analyze_batch") return `Batch analysis complete: ${Array.isArray(result.results) ? result.results.length : 0} items analyzed.`;
  return `VeracityAPI ${result.modality || name} analysis: recommended_action=${result.recommended_action || "unknown"}; risk_level=${result.risk_level || "unknown"}; primary_reason=${result.primary_reason || "unknown"}.`;
}

function formatMcpApiError(status: number, result: any): string {
  const message = typeof result?.message === "string" ? result.message : typeof result?.error === "string" ? result.error : "Request failed";
  if (status === 401) return "VeracityAPI unauthorized: missing or invalid API key. Create/copy a key at https://veracityapi.com/account and send it as Authorization: Bearer VERACITY_API_KEY.";
  if (status === 402) return `${message} Top up at https://veracityapi.com/account.`;
  return `VeracityAPI HTTP ${status}: ${message}`;
}

function mcpResult(id: unknown, result: Record<string, unknown>): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result };
}

function mcpError(id: unknown, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function mcpHttpResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(), ...securityHeaders(), "x-request-id": requestId() } });
}

function html(body: string, cache = true, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const nonce = cspNonce();
  const htmlBody = prepareHtml(body, nonce);
  return new Response(htmlBody, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache ? "public, max-age=120, stale-while-revalidate=86400" : "no-store",
      ...extraHeaders,
      ...corsHeaders(),
      ...securityHeaders(nonce),
      "x-request-id": requestId(),
    },
  });
}

function prepareHtml(body: string, nonce: string): string {
  let htmlBody = injectGoogleAnalytics(body);
  htmlBody = extractSharedCss(htmlBody);
  htmlBody = injectAppHeadAssets(htmlBody);
  htmlBody = addNonceAttributes(htmlBody, nonce);
  return htmlBody;
}

function injectGoogleAnalytics(body: string): string {
  if (!body || body.includes("G-BMB8X59JBY")) return body;
  if (body.includes("<title>VeracityAPI Account</title>") || body.includes("<title>Connect Veracity</title>")) return body;
  if (body.includes("</head>")) return body.replace("</head>", `${GOOGLE_ANALYTICS_TAG}</head>`);
  return body;
}

function extractSharedCss(body: string): string {
  const sharedCss = y2kCss();
  if (!body.includes(sharedCss)) return body;
  let out = body.split(sharedCss).join("");
  out = out.replace(/<style>\s*<\/style>/g, "");
  if (!out.includes('/assets/site.css')) {
    const link = '<link rel="stylesheet" href="/assets/site.css"/>';
    out = out.includes('<style>') ? out.replace('<style>', `${link}<style>`) : out.replace('</head>', `${link}</head>`);
  }
  return out;
}

function injectAppHeadAssets(body: string): string {
  if (!body.includes("</head>")) return body;
  const tags = [
    body.includes('rel="apple-touch-icon"') ? "" : '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>',
    body.includes('rel="manifest"') ? "" : '<link rel="manifest" href="/site.webmanifest"/>',
  ].join("");
  return tags ? body.replace("</head>", `${tags}</head>`) : body;
}

function addNonceAttributes(body: string, nonce: string): string {
  return body
    .replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`)
    .replace(/<style(?![^>]*\bnonce=)/g, `<style nonce="${nonce}"`);
}

function cspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function siteManifest(): Record<string, unknown> {
  return {
    name: "VeracityAPI",
    short_name: "VeracityAPI",
    description: "Content verification API for AI agents and publishing workflows.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1df",
    theme_color: "#f4f0e8",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/og.png", sizes: "1200x630", type: "image/png", purpose: "any" },
    ],
  };
}

function text(body: string, contentType: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
      ...headers,
      ...corsHeaders(),
      ...securityHeaders(),
      "x-request-id": requestId(),
    },
  });
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const id = requestId();
  const payload = body && typeof body === "object" && !Array.isArray(body) && !(body instanceof Response) && !String((body as Record<string, unknown>).error || "").startsWith("not_found")
    ? { request_id: id, ...(body as Record<string, unknown>) }
    : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...securityHeaders(),
      "x-request-id": id,
      ...headers,
    },
  });
}

function jsonForRequest(body: unknown, request: Request, status = 200, headers: Record<string, string> = {}): Response {
  return json(body, status, { ...corsHeadersForRequest(request), ...headers });
}

function requestId(): string {
  return `req_${ulid()}`;
}

function corsHeadersForRequest(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  return corsHeaders(isAllowedBrowserExtensionOrigin(origin) ? origin : undefined);
}

function isAllowedBrowserExtensionOrigin(origin: string): boolean {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

function corsHeaders(origin = "https://veracityapi.com"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Mcp-Session-Id,MCP-Protocol-Version,X-Veracity-API-Key,X-Requested-With,Accept,X-Request-Id",
    "Access-Control-Expose-Headers": "X-Request-Id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function securityHeaders(nonce?: string): Record<string, string> {
  const scriptNonce = nonce ? ` 'nonce-${nonce}'` : "";
  const styleNonce = nonce ? ` 'nonce-${nonce}'` : "";
  return {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": `default-src 'self'; script-src 'self'${scriptNonce} https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com; style-src 'self'${styleNonce} https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https://api.veracityapi.com https://www.google-analytics.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`,
  };
}
