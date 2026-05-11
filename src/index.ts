import { ulid } from "ulid";
import { sha256Hex } from "./auth";
import { accountHtml, buildAccountView, cleanEmail, clearSessionCookie, consumeMagicLink, createApiKey, createMagicLink, getSessionAccount, parseForm, redirect, requireAccount, sendMagicLink, sessionCookie, validEmail } from "./account";
import { authenticateUsageKey, BillingAuthError, creditCheckoutSession, CREDIT_PACKS, debitForRequest, InsufficientBalanceError, refundUsage, verifyStripeWebhook } from "./billing";
import { logAnalysis } from "./db";
import { LlmError, scoreText } from "./llm";
import { deriveAction, deriveRiskLevel, deriveTrustSignals } from "./scoring";
import { agentsJson, llmsTxt, ogSvg, openApiSpec, robotsTxt, sitemapXml } from "./discovery";
import { docsHtml, evalsHtml, examplesHtml, howItWorksHtml, pricingHtml, privacyHtml, requestAccessHtml, useCaseHtml, useCasesIndexHtml } from "./pages";
import { homepageHtml } from "./site";
import type { AnalyzeResponse, Env } from "./types";
import { parseAnalyzeRequest, ValidationError } from "./validate";

const LIMITATIONS = [
  "Scores are probabilistic workflow risk signals, not proof of AI authorship or truth.",
  "v0.1 uses an LLM-backed structured scoring pass; treat synthetic_risk as texture risk, not ground-truth authorship detection.",
  "English-calibrated at MVP; non-English content should be treated as experimental.",
];

const demoHits = new Map<string, { count: number; resetAt: number }>();
const DEMO_MAX_CHARS = 4_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/index.html")) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : homepageHtml());
    }

    const pageRoutes: Record<string, () => string> = {
      "/docs": docsHtml,
      "/how-it-works": howItWorksHtml,
      "/evals": evalsHtml,
      "/examples": examplesHtml,
      "/use-cases": useCasesIndexHtml,
      "/pricing": pricingHtml,
      "/privacy": privacyHtml,
      "/request-access": requestAccessHtml,
    };
    const pageRenderer = pageRoutes[url.pathname];
    if ((request.method === "GET" || request.method === "HEAD") && pageRenderer) {
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : pageRenderer());
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/use-cases/")) {
      const useCase = useCaseHtml(url.pathname.replace("/use-cases/", ""));
      if (!useCase) return json({ error: "not_found" }, 404);
      if (request.method === "GET") await logSiteEvent(env, request, "page_view", url.pathname);
      return html(request.method === "HEAD" ? "" : useCase);
    }

    if (request.method === "POST" && url.pathname === "/request-access") {
      return handleAccessRequest(request, env);
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/account") {
      const account = await getSessionAccount(request, env);
      const view = account ? await buildAccountView(env, account.accountId, account.email) : null;
      return html(request.method === "HEAD" ? "" : accountHtml(view, url.searchParams.get("message") || ""), false);
    }

    if (request.method === "POST" && url.pathname === "/auth/login") return handleLogin(request, env);
    if (request.method === "GET" && url.pathname === "/auth/callback") return handleCallback(request, env);
    if (request.method === "POST" && url.pathname === "/auth/logout") return handleLogout(request, env);
    if (request.method === "POST" && url.pathname === "/api-keys") return handleCreateApiKey(request, env);
    if (request.method === "POST" && /^\/api-keys\/[^/]+\/revoke$/.test(url.pathname)) return handleRevokeApiKey(request, env, url.pathname.split("/")[2]);
    if (request.method === "POST" && url.pathname === "/account/email") return handleUpdateEmail(request, env);
    if (request.method === "POST" && url.pathname === "/account/delete") return handleDeleteAccount(request, env);
    if (request.method === "POST" && url.pathname === "/billing/checkout") return handleCheckout(request, env);
    if (request.method === "POST" && url.pathname === "/billing/webhook") return handleStripeWebhook(request, env);

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/openapi.json") {
      return json(request.method === "HEAD" ? null : openApiSpec(), 200, { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/.well-known/agents.json") {
      return json(request.method === "HEAD" ? null : agentsJson(), 200, { "cache-control": "public, max-age=300" });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/llms.txt") {
      return text(request.method === "HEAD" ? "" : llmsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
      return text(request.method === "HEAD" ? "" : sitemapXml(), "application/xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
      return text(request.method === "HEAD" ? "" : robotsTxt(), "text/plain; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/og.svg") {
      return text(request.method === "HEAD" ? "" : ogSvg(), "image/svg+xml; charset=utf-8");
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/health") {
      return json(request.method === "HEAD" ? null : { status: "ok", service: "veracityapi", version: env.MODEL_VERSION || "v0.1" });
    }

    if (request.method === "POST" && url.pathname === "/demo/analyze") {
      await logSiteEvent(env, request, "demo_run", url.pathname);
      return handleDemoAnalyze(request, env);
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze-text") {
      return handleAnalyzeText(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};

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
      return json({ error: "rate_limited", message: "Public demo limit reached. Try again later or request an API key." }, 429, { "Retry-After": "3600" });
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
      privacy_mode: true,
    };
    const parsed = await parseAnalyzeRequest(jsonRequest(request.url, sanitized));
    const scored = await scoreText(parsed, env);
    const derived = deriveTrustSignals(scored.synthetic_risk, scored.slop_risk, scored.evidence);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: `demo_${ulid()}`,
      ...scored,
      ...derived,
      risk_level: riskLevel,
      recommended_action: action,
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
    return json(response);
  } catch (err) {
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
    const billing = auth.legacy ? undefined : await debitForRequest(env, auth.accountId!, auth.apiKeyId!, analysisId, parsed);
    if (billing) debit = { accountId: auth.accountId!, apiKeyId: auth.apiKeyId!, billing, analysisId };
    const scored = await scoreText(parsed, env);
    const derived = deriveTrustSignals(scored.synthetic_risk, scored.slop_risk, scored.evidence);
    const riskLevel = deriveRiskLevel(scored.synthetic_risk, scored.slop_risk);
    const action = deriveAction(riskLevel, parsed.context.intended_use);
    const response: AnalyzeResponse = {
      analysis_id: analysisId,
      ...scored,
      ...derived,
      risk_level: riskLevel,
      recommended_action: action,
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
    });
    return json(response);
  } catch (err) {
    if (debit && (err instanceof LlmError)) await refundUsage(env, debit.accountId, debit.apiKeyId, debit.analysisId, debit.billing, "llm_unavailable");
    if (err instanceof BillingAuthError) return json({ error: "unauthorized" }, 401);
    if (err instanceof InsufficientBalanceError) return json({ error: "insufficient_balance", message: `This request costs $${(err.requiredCents / 100).toFixed(2)}. Your balance is $${(err.balanceCents / 100).toFixed(2)}.`, required_cents: err.requiredCents, balance_cents: err.balanceCents, top_up_url: "https://veracityapi.com/account" }, 402);
    if (err instanceof ValidationError) return json({ error: "bad_request", message: err.message }, 400);
    if (err instanceof LlmError) return json({ error: "llm_unavailable", message: "Scoring model unavailable. Retry shortly." }, 503, { "Retry-After": "10" });
    console.error(err);
    return json({ error: "internal_error" }, 500);
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const params = parseForm(await request.text());
    const email = cleanEmail(params.get("email") || "");
    if (!validEmail(email)) return html(accountHtml(null, "Enter a valid email address."), false);
    const link = await createMagicLink(email, request, env);
    await sendMagicLink(env, email, link);
    return html(accountHtml(null, "Login link sent. Check your email."), false);
  } catch (err) {
    console.error(err);
    return html(accountHtml(null, "Could not send login email yet. If DNS verification is still pending, try again shortly."), false);
  }
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") || "";
  try {
    const session = await consumeMagicLink(env, token);
    return redirect("/account?message=Logged+in", { "Set-Cookie": sessionCookie(session.sessionToken) });
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

function consumeDemoQuota(key: string, limit: number): boolean {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  for (const [k, value] of demoHits.entries()) {
    if (value.resetAt <= now) demoHits.delete(k);
  }
  const current = demoHits.get(key);
  if (!current || current.resetAt <= now) {
    demoHits.set(key, { count: 1, resetAt: now + hour });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function html(body: string, cache = true): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache ? "public, max-age=120" : "no-store",
      ...corsHeaders(),
    },
  });
}

function text(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
      ...corsHeaders(),
    },
  });
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };
}
