import { ulid } from "ulid";
import { createApiKey, getSessionAccount, redirect } from "./account";
import { sha256Hex } from "./auth";
import type { Env } from "./types";

const EXCHANGE_CODE_MINUTES = 10;
const MAX_REDIRECT_URI_LENGTH = 500;
const MAX_STATE_LENGTH = 300;

export class ExtensionAuthError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
  }
}

export function extensionConnectHtml(args: { redirectUri: string; state: string; loggedInEmail?: string; message?: string }): string {
  const { redirectUri, state, loggedInEmail, message } = args;
  const hidden = `<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}"/><input type="hidden" name="state" value="${escapeHtml(state)}"/>`;
  const connectForm = loggedInEmail
    ? `<p class="muted">Signed in as ${escapeHtml(loggedInEmail)}</p><form method="post" action="/extension/connect/authorize" data-extension-connect-form>${hidden}<button>Connect extension</button></form><p class="status" data-extension-status></p>`
    : `<form method="post" action="/extension/connect/login">${hidden}<label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"/></label><button>Email me a secure link</button></form><p class="muted">No password needed. New accounts include starter credit.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Connect Veracity</title><style>${css()}</style></head><body><main class="wrap"><section class="card"><div class="eyebrow">Veracity Chrome Extension</div><h1>Connect Veracity</h1><p>Connect your account so the Chrome extension can check selected text when you choose “Check with Veracity.”</p>${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}${connectForm}<p class="fineprint">The extension only sends text you explicitly select and check. Veracity provides workflow-risk triage, not proof of AI authorship or truth.</p></section></main><script>${extensionConnectScript(redirectUri, state)}</script></body></html>`;
}

export function validateExtensionRedirectUri(value: string): string {
  const redirectUri = value.trim();
  if (!redirectUri || redirectUri.length > MAX_REDIRECT_URI_LENGTH) throw new ExtensionAuthError("bad_redirect_uri", "redirect_uri is required");
  let parsed: URL;
  try { parsed = new URL(redirectUri); } catch { throw new ExtensionAuthError("bad_redirect_uri", "redirect_uri must be a valid URL"); }
  if (parsed.protocol !== "https:" || !/^[a-p]{32}\.chromiumapp\.org$/.test(parsed.hostname)) {
    throw new ExtensionAuthError("bad_redirect_uri", "redirect_uri must be a Chrome extension identity redirect URL");
  }
  return redirectUri;
}

export function validateExtensionState(value: string): string {
  const state = value.trim();
  if (!state || state.length > MAX_STATE_LENGTH) throw new ExtensionAuthError("bad_state", "state is required");
  return state;
}

export function safeExtensionNextPath(redirectUri: string, state: string): string {
  return `/extension/connect?redirect_uri=${encodeURIComponent(validateExtensionRedirectUri(redirectUri))}&state=${encodeURIComponent(validateExtensionState(state))}`;
}

export function safeRelativeNext(value: string): string | null {
  if (!value || value.length > 1200) return null;
  try {
    const url = new URL(value, "https://veracityapi.com");
    if (url.origin !== "https://veracityapi.com") return null;
    if (!url.pathname.startsWith("/extension/connect")) return null;
    validateExtensionRedirectUri(url.searchParams.get("redirect_uri") || "");
    validateExtensionState(url.searchParams.get("state") || "");
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export async function createExtensionExchangeCode(env: Env, accountId: string, redirectUri: string): Promise<string> {
  const code = randomToken("ext");
  const now = new Date();
  const expires = new Date(now.getTime() + EXCHANGE_CODE_MINUTES * 60_000).toISOString();
  await env.DB.prepare(`INSERT INTO extension_exchange_codes (code_hash, account_id, redirect_uri, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).bind(await sha256Hex(code), accountId, redirectUri, expires, now.toISOString()).run();
  return code;
}

export async function exchangeExtensionCode(env: Env, code: string): Promise<{ api_key: string; account_id: string; key_id: string; label: string; created_at: string }> {
  if (!code || code.length > 200) throw new ExtensionAuthError("bad_code", "code is required");
  const hash = await sha256Hex(code);
  const now = new Date().toISOString();
  const row = await env.DB.prepare(`SELECT account_id FROM extension_exchange_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`).bind(hash, now).first<{ account_id: string }>();
  if (!row) throw new ExtensionAuthError("bad_code", "Extension connection code expired or invalid");
  await env.DB.prepare(`UPDATE extension_exchange_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL`).bind(now, hash).run();
  const created = await createApiKey(env, row.account_id, "Chrome Extension");
  return { api_key: created.key, account_id: row.account_id, key_id: created.keyId, label: "Chrome Extension", created_at: now };
}

export async function authorizeExtension(request: Request, env: Env, asJson = false): Promise<Response> {
  const account = await getSessionAccount(request, env);
  if (!account) return redirect("/account?message=Please+log+in");
  const params = new URLSearchParams(await request.text());
  const redirectUri = validateExtensionRedirectUri(params.get("redirect_uri") || "");
  const state = validateExtensionState(params.get("state") || "");
  const code = await createExtensionExchangeCode(env, account.accountId, redirectUri);
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);
  if (asJson) {
    return new Response(JSON.stringify({ redirect_url: target.toString(), state }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return redirect(target.toString());
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function escapeHtml(value: string): string { return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c)); }

function extensionConnectScript(redirectUri: string, state: string): string {
  const hasIntent = Boolean(redirectUri && state);
  if (!hasIntent) return "";
  const expectedState = JSON.stringify(state);
  return `(function(){var key='veracity_extension_redirect';var expected=${expectedState};function go(url){if(url){window.location.href=url;}}window.addEventListener('storage',function(event){if(event.key!==key||!event.newValue)return;try{var data=JSON.parse(event.newValue);if(data&&data.state===expected&&data.redirect_url)go(data.redirect_url);}catch(_){}});var form=document.querySelector('[data-extension-connect-form]');if(!form)return;var status=document.querySelector('[data-extension-status]');var button=form.querySelector('button');form.addEventListener('submit',async function(event){event.preventDefault();try{if(button){button.disabled=true;button.textContent='Connecting…';}if(status)status.textContent='Finishing connection…';var response=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{'accept':'application/json'},credentials:'same-origin'});if(!response.ok)throw new Error('Connection failed. Refresh and try again.');var data=await response.json();if(!data.redirect_url)throw new Error('Connection response was missing redirect URL.');localStorage.setItem(key,JSON.stringify({state:data.state,redirect_url:data.redirect_url,at:Date.now()}));go(data.redirect_url);}catch(error){if(button){button.disabled=false;button.textContent='Connect extension';}if(status)status.textContent=error&&error.message?error.message:'Connection failed. Refresh and try again.';}});})();`;
}

function css(): string { return `:root{color-scheme:dark;--bg:#08090a;--panel:#101114;--text:#f7f8f8;--muted:#a2a8b3;--line:rgba(255,255,255,.12);--accent:#7170ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,rgba(113,112,255,.2),transparent 32rem),var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:560px;border:1px solid var(--line);background:rgba(255,255,255,.045);border-radius:20px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.32)}.eyebrow{font:12px ui-monospace,monospace;text-transform:uppercase;color:var(--muted);letter-spacing:.08em}h1{font-size:42px;line-height:.98;letter-spacing:-.045em;margin:12px 0}p{color:var(--muted);line-height:1.55}label{display:grid;gap:8px;color:var(--muted);margin-top:18px}input{width:100%;padding:14px;border-radius:12px;border:1px solid var(--line);background:#07080a;color:white}button{margin-top:16px;width:100%;border:0;border-radius:12px;background:linear-gradient(135deg,#5e6ad2,#7170ff);color:white;padding:13px 16px;font-weight:700;cursor:pointer}button:disabled{opacity:.72;cursor:wait}.notice{border:1px solid var(--line);background:rgba(113,112,255,.14);padding:12px;border-radius:12px}.status{min-height:1.4em}.fineprint{font-size:13px}`; }
