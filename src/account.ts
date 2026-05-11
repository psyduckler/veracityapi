import { ulid } from "ulid";
import { sha256Hex } from "./auth";
import { CREDIT_PACKS } from "./billing";
import type { Env } from "./types";

const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 20;

export function accountHtml(account: AccountView | null, message = ""): string {
  const loggedOut = !account;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>VeracityAPI Account</title><style>${css()}</style></head><body><main class="wrap"><nav><a href="/">VeracityAPI</a><span>Prepaid API console</span></nav>${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}${loggedOut ? loginPanel() : dashboard(account)}</main></body></html>`;
}

function loginPanel(): string { return `<section class="hero"><div class="eyebrow">Account</div><h1>Email login. Prepaid credits. API keys for agents.</h1><p>Enter your email and we’ll send a magic login link. No passwords, no subscriptions.</p></section><form method="post" action="/auth/login" class="card"><label>Email<input name="email" type="email" required autocomplete="email" placeholder="hello@company.com"/></label><button>Send login link</button></form>`; }

function dashboard(account: AccountView): string {
  const keyRows = account.apiKeys.length ? account.apiKeys.map((k) => `<tr><td><code>${escapeHtml(k.key_prefix)}…</code></td><td>${escapeHtml(k.label || "default")}</td><td>${escapeHtml(k.created_at.slice(0,10))}</td><td><form method="post" action="/api-keys/${k.key_id}/revoke"><button class="small">Revoke</button></form></td></tr>`).join("") : `<tr><td colspan="4">No API keys yet.</td></tr>`;
  const usageRows = account.usage.length ? account.usage.map((u) => `<tr><td>${escapeHtml(u.created_at.slice(0,19).replace("T"," "))}</td><td>${u.chars_analyzed}</td><td>${escapeHtml(u.bucket)}</td><td>$${(u.price_cents/100).toFixed(2)}</td><td>${escapeHtml(u.status)}</td></tr>`).join("") : `<tr><td colspan="5">No usage yet.</td></tr>`;
  const checkoutButtons = Object.entries(CREDIT_PACKS).map(([id, pack]) => `<form method="post" action="/billing/checkout"><input type="hidden" name="pack" value="${id}"/><button>${pack.label}</button></form>`).join("");
  return `<section class="hero"><div class="eyebrow">Logged in as ${escapeHtml(account.email)}</div><h1>$${(account.balance_cents/100).toFixed(2)} balance</h1><p>Buy credits once. Each analysis debits by character bucket.</p></section><section class="grid"><div class="card"><h2>Buy credits</h2><div class="buttons">${checkoutButtons}</div></div><div class="card"><h2>Create API key</h2><form method="post" action="/api-keys"><label>Label<input name="label" maxlength="80" placeholder="production agent"/></label><button>Create key</button></form></div></section><section class="card"><h2>API keys</h2><table><tr><th>Prefix</th><th>Label</th><th>Created</th><th></th></tr>${keyRows}</table><p class="muted">Full API keys are shown once after creation. Store them in your agent’s secret manager.</p></section><section class="card"><h2>Recent usage</h2><table><tr><th>When</th><th>Chars</th><th>Bucket</th><th>Price</th><th>Status</th></tr>${usageRows}</table></section><section class="grid"><div class="card"><h2>Edit email</h2><form method="post" action="/account/email"><label>New email<input name="email" type="email" required/></label><button>Update email</button></form></div><div class="card"><h2>Session / account</h2><form method="post" action="/auth/logout"><button>Log out</button></form><form method="post" action="/account/delete" onsubmit="return confirm('Delete account, revoke keys, and expire sessions?')"><button class="danger">Delete account</button></form></div></section>`;
}

export async function getSessionAccount(request: Request, env: Env): Promise<{ accountId: string; email: string } | null> {
  const sid = getCookie(request, "vap_session");
  if (!sid) return null;
  const hash = await sha256Hex(sid);
  const row = await env.DB.prepare(`SELECT a.account_id, a.email FROM sessions s JOIN accounts a ON a.account_id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.deleted_at IS NULL`).bind(hash, new Date().toISOString()).first<{ account_id: string; email: string }>();
  return row ? { accountId: row.account_id, email: row.email } : null;
}

export async function buildAccountView(env: Env, accountId: string, email: string): Promise<AccountView> {
  const acct = await env.DB.prepare(`SELECT balance_cents FROM accounts WHERE account_id = ?`).bind(accountId).first<{ balance_cents: number }>();
  const apiKeys = await env.DB.prepare(`SELECT key_id, key_prefix, label, created_at FROM api_keys WHERE account_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 20`).bind(accountId).all<ApiKeyView>();
  const usage = await env.DB.prepare(`SELECT created_at, chars_analyzed, bucket, price_cents, status FROM usage_events WHERE account_id = ? ORDER BY created_at DESC LIMIT 20`).bind(accountId).all<UsageView>();
  return { account_id: accountId, email, balance_cents: Number(acct?.balance_cents ?? 0), apiKeys: apiKeys.results ?? [], usage: usage.results ?? [] };
}

export async function createMagicLink(email: string, request: Request, env: Env): Promise<string> {
  const token = randomToken("ml");
  const now = new Date();
  const expires = new Date(now.getTime() + MAGIC_LINK_MINUTES * 60_000).toISOString();
  await env.DB.prepare(`INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(await sha256Hex(token), email, expires, now.toISOString()).run();
  const url = new URL(request.url);
  return `${url.origin}/auth/callback?token=${encodeURIComponent(token)}`;
}

export async function sendMagicLink(env: Env, to: string, link: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) throw new Error("resend_not_configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM, to, subject: "Your VeracityAPI login link", html: `<p>Click to log in to VeracityAPI:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${MAGIC_LINK_MINUTES} minutes.</p>`, text: `Log in to VeracityAPI: ${link}\n\nThis link expires in ${MAGIC_LINK_MINUTES} minutes.` }),
  });
  if (!res.ok) throw new Error(`resend_failed:${res.status}`);
}

export async function consumeMagicLink(env: Env, token: string): Promise<{ sessionToken: string; accountId: string }> {
  const hash = await sha256Hex(token);
  const now = new Date().toISOString();
  const link = await env.DB.prepare(`SELECT email FROM magic_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`).bind(hash, now).first<{ email: string }>();
  if (!link) throw new Error("bad_magic_link");
  await env.DB.prepare(`UPDATE magic_links SET used_at = ? WHERE token_hash = ?`).bind(now, hash).run();
  const email = link.email.toLowerCase();
  let acct = await env.DB.prepare(`SELECT account_id FROM accounts WHERE email = ? AND deleted_at IS NULL`).bind(email).first<{ account_id: string }>();
  if (!acct) {
    const accountId = `acct_${ulid()}`;
    await env.DB.prepare(`INSERT INTO accounts (account_id, email, balance_cents, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`).bind(accountId, email, now, now).run();
    acct = { account_id: accountId };
  }
  const sessionToken = randomToken("sess");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (session_id, account_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).bind(`ses_${ulid()}`, acct.account_id, await sha256Hex(sessionToken), expires, now).run();
  return { sessionToken, accountId: acct.account_id };
}

export async function createApiKey(env: Env, accountId: string, label: string): Promise<{ key: string; keyId: string; prefix: string }> {
  const secret = randomToken("vap");
  const prefix = secret.slice(0, 12);
  const keyId = `key_${ulid()}`;
  await env.DB.prepare(`INSERT INTO api_keys (key_id, account_id, key_hash, key_prefix, label, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)`).bind(keyId, accountId, await sha256Hex(secret), prefix, label || "default", new Date().toISOString()).run();
  return { key: secret, keyId, prefix };
}

export async function requireAccount(request: Request, env: Env): Promise<{ accountId: string; email: string } | Response> {
  const account = await getSessionAccount(request, env);
  if (!account) return redirect("/account?message=Please+log+in");
  return account;
}

export function sessionCookie(token: string): string { return `vap_session=${token}; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`; }
export function clearSessionCookie(): string { return `vap_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`; }
export function redirect(location: string, headers: Record<string, string> = {}): Response { return new Response(null, { status: 303, headers: { location, ...headers } }); }

export function parseForm(body: string): URLSearchParams { return new URLSearchParams(body); }
export function cleanEmail(value: string): string { return value.trim().toLowerCase().slice(0, 180); }
export function validEmail(email: string): boolean { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email); }

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
function randomToken(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function escapeHtml(value: string): string { return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c)); }
function css(): string { return `:root{color-scheme:dark;--bg:#08090a;--panel:#101114;--text:#f7f8f8;--muted:#a2a8b3;--line:rgba(255,255,255,.1);--accent:#7170ff;--bad:#ef4444}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,rgba(113,112,255,.18),transparent 34rem),var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}.wrap{max-width:1050px;margin:0 auto;padding:24px}nav{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:18px 0}a{color:inherit}.hero h1{font-size:clamp(36px,7vw,70px);line-height:.95;letter-spacing:-.05em}.hero p,.muted{color:var(--muted)}.eyebrow{font:12px ui-monospace,monospace;text-transform:uppercase;color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:16px;padding:20px;margin:18px 0}label{display:grid;gap:8px;color:var(--muted)}input{width:100%;padding:13px;border-radius:10px;border:1px solid var(--line);background:#07080a;color:white}button{border:0;border-radius:10px;background:linear-gradient(135deg,#5e6ad2,#7170ff);color:white;padding:12px 14px;cursor:pointer;margin:4px}.small{padding:8px 10px}.danger{background:var(--bad)}table{width:100%;border-collapse:collapse}td,th{border-top:1px solid var(--line);padding:10px;text-align:left}code{font-family:ui-monospace,monospace}.notice{border:1px solid var(--line);background:rgba(113,112,255,.14);padding:14px;border-radius:12px;margin:16px 0}.buttons{display:flex;flex-wrap:wrap;gap:8px}@media(max-width:760px){.grid{grid-template-columns:1fr}}`; }

interface ApiKeyView { key_id: string; key_prefix: string; label: string; created_at: string }
interface UsageView { created_at: string; chars_analyzed: number; bucket: string; price_cents: number; status: string }
export interface AccountView { account_id: string; email: string; balance_cents: number; apiKeys: ApiKeyView[]; usage: UsageView[] }
