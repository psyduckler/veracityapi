import { logoMarkHtml } from "./brand";
import { ulid } from "ulid";
import { sha256Hex } from "./auth";
import { CREDIT_PACKS } from "./billing";
import type { Env } from "./types";

const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 20;
export const SIGNUP_CREDIT_CENTS = 150;

export function accountHtml(account: AccountView | null, message = ""): string {
  const loggedOut = !account;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>VeracityAPI Account</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"/><link rel="shortcut icon" href="/favicon.ico"/><style>${css()}</style></head><body><main class="wrap"><nav><a class="brand" href="/">${logoMarkHtml()}<span>VeracityAPI</span></a><span>Prepaid API console</span></nav>${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}${loggedOut ? loginPanel() : dashboard(account, message)}</main></body></html>`;
}

function loginPanel(): string { return `<section class="hero"><div class="eyebrow">Account</div><h1>Email login. $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests. API keys for agents.</h1><p>Enter your email and we’ll send a magic login link. New accounts start with $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests. No passwords, no subscriptions.</p></section><form method="post" action="/auth/login" class="card"><label>Email<input name="email" type="email" required autocomplete="email" placeholder="hello@company.com"/></label><button>Send login link</button></form>`; }

function dashboard(account: AccountView, message = ""): string {
  const keyRows = account.apiKeys.length ? account.apiKeys.map((k) => `<tr><td><code>${escapeHtml(k.key_prefix)}…</code></td><td>${escapeHtml(k.label || "default")}</td><td>${escapeHtml(k.created_at.slice(0,10))}</td><td><form method="post" action="/api-keys/${k.key_id}/revoke"><button class="small">Revoke</button></form></td></tr>`).join("") : `<tr><td colspan="4">No API keys yet.</td></tr>`;
  const usageRows = account.usage.length ? account.usage.map((u) => `<tr><td>${escapeHtml(u.created_at.slice(0,19).replace("T"," "))}</td><td>${u.chars_analyzed}</td><td>${escapeHtml(u.bucket)}</td><td>$${(u.price_cents/100).toFixed(3)}</td><td>${escapeHtml(u.status)}</td></tr>`).join("") : `<tr><td colspan="5">No usage yet.</td></tr>`;
  const checkoutButtons = Object.entries(CREDIT_PACKS).map(([id, pack]) => `<form method="post" action="/billing/checkout"><input type="hidden" name="pack" value="${id}"/><button>${pack.label}</button></form>`).join("");
  const createdKey = extractCreatedKey(message);
  const visibleKey = createdKey || "YOUR_VERACITY_API_KEY";
  const equivalentShortChecks = Math.floor(account.balance_cents / 0.5);
  const starterPercent = Math.max(0, Math.min(100, Math.round((account.balance_cents / SIGNUP_CREDIT_CENTS) * 100)));
  const hasKey = account.apiKeys.length > 0 || !!createdKey;
  const hasUsage = account.usage.length > 0;
  const curl = `curl https://api.veracityapi.com/v1/analyze \\
  -H "Authorization: Bearer ${visibleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","content":"At Shinjuku Station east exit, a stranger claims ticket machines are broken and asks tourists for cash for a Narita Express fare.","context":{"format":"article","intended_use":"publish","domain":"travel scam report"},"store_content":false}'`;
  const imageCurl = `curl https://api.veracityapi.com/v1/analyze \\
  -H "Authorization: Bearer ${visibleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"image","content":"https://veracityapi.com/demo/influencer-beauty-tonic.jpg","context":{"format":"social_post","intended_use":"publish","domain":"image UGC moderation"},"store_content":false}'`;
  return `<section class="hero"><div class="eyebrow">Logged in as ${escapeHtml(account.email)}</div><h1>Activate your first VeracityAPI call.</h1><p>$${(account.balance_cents/100).toFixed(2)} balance available. New accounts include $1.50 free credit — enough for 300 analyze-only 1k-character text requests or 150 Analyze + revise requests.</p></section>
<section class="card"><h2>Onboarding checklist</h2><ol><li><strong>Log in</strong> <span class="good">done</span></li><li><strong>Create API key</strong> ${hasKey ? `<span class="good">done</span>` : `<span class="muted">next</span>`}</li><li><strong>Run first request</strong> ${hasUsage ? `<span class="good">done</span>` : `<span class="muted">pending</span>`}</li></ol><p class="muted">Goal: create a key, run the curl below, then come back here to see Recent usage populated.</p></section>
<section class="card"><h2>Current balance</h2><p><strong>$${(account.balance_cents/100).toFixed(2)} available</strong> · Equivalent to ~${equivalentShortChecks} analyze-only 1k-character text requests or ~${Math.floor(equivalentShortChecks / 2)} Analyze + revise requests, ~${Math.floor(account.balance_cents / 2)} image checks, or ~${Math.floor(account.balance_cents / 1)} audio checks.</p><div role="progressbar" aria-valuemin="0" aria-valuemax="300" aria-valuenow="${account.balance_cents}" style="height:12px;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:#050608"><div style="height:100%;width:${starterPercent}%;background:linear-gradient(135deg,#10b981,#7170ff)"></div></div><p class="muted">Progress is shown against the $1.50 starter-credit benchmark; purchased credits can raise the balance above this bar.</p></section>
<section class="grid"><div class="card"><h2>Create API key</h2><form method="post" action="/api-keys"><label>Label<input name="label" maxlength="80" placeholder="production agent"/></label><button>Create key</button></form><p class="muted">Full API keys are shown once after creation. Store them in your secret manager.</p></div><div class="card"><h2>Buy credits</h2><div class="buttons">${checkoutButtons}</div></div></section>
<section class="card activation"><h2>Run this first request</h2><p class="muted">Copy your API key into the command, run it locally, and confirm the response includes <code>recommended_action</code>. Full keys are shown once after creation.</p>${createdKey ? `<p><button class="small" type="button" data-copy-key="${escapeHtml(createdKey)}">Copy API key</button></p>` : `<p class="muted">Create an API key to reveal a one-time Copy API key button.</p>`}<div class="terminal"><div class="eyebrow">Text request</div><pre>${escapeHtml(curl)}</pre></div><div class="terminal"><div class="eyebrow">Image request</div><pre>${escapeHtml(imageCurl)}</pre></div><p><a href="/docs">Docs</a> · <a href="/ai-image-detection-api">Image demo</a> · <a href="/ai-audio-detection-api">Audio demo</a> · <a href="/openapi.json">OpenAPI</a></p></section>
<section class="card"><h2>API keys</h2><table><tr><th>Prefix</th><th>Label</th><th>Created</th><th></th></tr>${keyRows}</table></section>
<section class="card"><h2>Recent usage</h2><table><tr><th>When</th><th>Chars</th><th>Bucket</th><th>Price</th><th>Status</th></tr>${usageRows}</table></section>
<section class="grid"><div class="card"><h2>Edit email</h2><form method="post" action="/account/email"><label>New email<input name="email" type="email" required/></label><button>Update email</button></form></div><div class="card"><h2>Session / account</h2><form method="post" action="/auth/logout"><button>Log out</button></form><form method="post" action="/account/delete" onsubmit="return confirm('Delete account, revoke keys, and expire sessions?')"><button class="danger">Delete account</button></form></div></section><script>document.querySelectorAll('[data-copy-key]').forEach((b)=>b.addEventListener('click',async()=>{await navigator.clipboard.writeText(b.dataset.copyKey);b.textContent='Copied'}));</script>`;
}

function extractCreatedKey(message: string): string | null {
  const match = message.match(/Copy it now:\s*(\S+)/);
  return match?.[1] || null;
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

export async function createMagicLink(email: string, request: Request, env: Env, nextPath?: string): Promise<string> {
  const token = randomToken("ml");
  const now = new Date();
  const expires = new Date(now.getTime() + MAGIC_LINK_MINUTES * 60_000).toISOString();
  await env.DB.prepare(`INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(await sha256Hex(token), email, expires, now.toISOString()).run();
  const url = new URL(request.url);
  const callback = new URL(`${url.origin}/auth/callback`);
  callback.searchParams.set("token", token);
  if (nextPath) callback.searchParams.set("next", nextPath);
  return callback.toString();
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
    const ledgerId = `led_${ulid()}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO accounts (account_id, email, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).bind(accountId, email, SIGNUP_CREDIT_CENTS, now, now),
      env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'signup_credit', ?, ?, ?, ?, ?)`).bind(ledgerId, accountId, SIGNUP_CREDIT_CENTS, SIGNUP_CREDIT_CENTS, accountId, JSON.stringify({ reason: "new_account_free_credit" }), now),
    ]);
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
function css(): string { return `:root{color-scheme:light;--bg:#d8d6d2;--paper:#f0ede7;--panel:#f0ede7;--text:#0a0a0a;--muted:#4b4640;--line:#0a0a0a;--accent:#ff2d8a;--bad:#b42318;--good:#087f4f;--cyber-cyan:#00d4ff;--acid-green:#b8ff00}*{box-sizing:border-box}body{margin:0;background:linear-gradient(90deg,rgba(10,10,10,.045) 1px,transparent 1px),linear-gradient(180deg,rgba(10,10,10,.04) 1px,transparent 1px),radial-gradient(circle at 12% -8%,rgba(255,45,138,.20),transparent 24rem),radial-gradient(circle at 88% 8%,rgba(0,212,255,.18),transparent 26rem),linear-gradient(180deg,#efede7 0,var(--bg) 48%,#c9c6bf 100%);background-size:28px 28px,28px 28px,auto,auto,auto;color:var(--text);font-family:Inter,system-ui,sans-serif}.wrap{max-width:1050px;margin:0 auto;padding:24px}nav{display:flex;justify-content:space-between;border-bottom:2px solid var(--line);padding:18px 0}.brand{display:flex;gap:8px;align-items:center;text-decoration:none;font-weight:700}.mark{width:28px;height:28px;border:1px solid var(--line);border-radius:8px;background:#fff7d8;display:inline-grid;place-items:center;font-size:18px;line-height:1}a{color:inherit}.hero h1{font-size:clamp(36px,7vw,70px);line-height:.95;letter-spacing:-.05em}.hero p,.muted{color:var(--muted)}.good{color:var(--good);font-weight:700}.eyebrow{font:12px ui-monospace,monospace;text-transform:uppercase;color:var(--muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:3px solid var(--line);background:var(--panel);border-radius:0;padding:20px;margin:18px 0;box-shadow:5px 5px 0 var(--line)}label{display:grid;gap:8px;color:var(--muted)}input{width:100%;padding:13px;border-radius:0;border:2px solid var(--line);background:#fffefa;color:var(--text);box-shadow:inset 2px 2px #d8d0c2}button{border:2px solid var(--line);border-radius:0;background:linear-gradient(180deg,var(--accent),#d0186c);color:white;padding:12px 14px;cursor:pointer;margin:4px;box-shadow:3px 3px 0 var(--line);font-weight:800}.small{padding:8px 10px}.danger{background:var(--bad)}table{width:100%;border-collapse:collapse}td,th{border-top:1px solid var(--line);padding:10px;text-align:left}code{font-family:ui-monospace,monospace}.notice{border:1px solid var(--line);background:rgba(113,112,255,.14);padding:14px;border-radius:12px;margin:16px 0}.buttons{display:flex;flex-wrap:wrap;gap:8px}.terminal{border:3px solid var(--line);border-radius:0;background:#0b0c10;color:#f7f3df;padding:14px;box-shadow:4px 4px 0 var(--line)}.terminal pre{white-space:pre-wrap;overflow:auto;font-family:ui-monospace,monospace;color:#dfffe8}.activation{border-color:rgba(113,112,255,.4)}strong{color:#fff}@media(max-width:760px){.grid{grid-template-columns:1fr}}`; }

interface ApiKeyView { key_id: string; key_prefix: string; label: string; created_at: string }
interface UsageView { created_at: string; chars_analyzed: number; bucket: string; price_cents: number; status: string }
export interface AccountView { account_id: string; email: string; balance_cents: number; apiKeys: ApiKeyView[]; usage: UsageView[] }
