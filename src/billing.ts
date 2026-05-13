import { ulid } from "ulid";
import { sha256Hex } from "./auth";
import type { AnalyzeBatchRequest, AnalyzeRequest, BalanceSummary, BillingMetadata, Env } from "./types";

export const CREDIT_PACKS: Record<string, { amountCents: number; label: string }> = {
  starter: { amountCents: 1000, label: "$10 credits" },
  growth: { amountCents: 5000, label: "$50 credits" },
  scale: { amountCents: 20000, label: "$200 credits" },
};

export const TEXT_UNIT_CHARS = 1_000;
export const TEXT_UNIT_PRICE_CENTS = 0.5; // $0.005 per 1,000 characters
export const TEXT_REVISE_UNIT_PRICE_CENTS = 1; // $0.010 per 1,000 characters for analyze + revise

export function priceForChars(chars: number, autoRevise = false): { bucket: string; priceCents: number; billableUnits: number } {
  const billableUnits = Math.max(1, Math.ceil(chars / TEXT_UNIT_CHARS));
  const unitPrice = autoRevise ? TEXT_REVISE_UNIT_PRICE_CENTS : TEXT_UNIT_PRICE_CENTS;
  return { bucket: autoRevise ? "text_revise_1k_units" : "text_1k_units", priceCents: billableUnits * unitPrice, billableUnits };
}

export function priceForImage(): { bucket: string; priceCents: number } {
  return { bucket: "image_v0", priceCents: 2 };
}

export function priceForAudio(): { bucket: string; priceCents: number } {
  return { bucket: "audio_v0", priceCents: 1 };
}

export function priceForVideo(): { bucket: string; priceCents: number } {
  return { bucket: "video_v0", priceCents: 5 };
}


export async function authenticateUsageKey(request: Request, env: Env): Promise<{ accountId: string; apiKeyId: string; apiKeyHash: string; legacy: false }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!token) throw new BillingAuthError();

  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT key_id, account_id, status FROM api_keys WHERE key_hash = ? AND status = 'active'`).bind(hash).first<{ key_id: string; account_id: string; status: string }>();
  if (row) return { accountId: row.account_id, apiKeyId: row.key_id, apiKeyHash: hash, legacy: false };

  throw new BillingAuthError();
}

export async function debitForRequest(env: Env, accountId: string, apiKeyId: string, analysisId: string, parsed: AnalyzeRequest): Promise<BillingMetadata> {
  const chars = parsed.text.length;
  const { bucket, priceCents, billableUnits } = priceForChars(chars, parsed.auto_revise === true);
  const updated = await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL AND balance_cents >= ?`)
    .bind(priceCents, new Date().toISOString(), accountId, priceCents)
    .run();
  if (!updated.meta || updated.meta.changes < 1) {
    const account = await getAccountBalance(env, accountId);
    throw new InsufficientBalanceError(priceCents, account.balanceCents);
  }
  const account = await getAccountBalance(env, accountId);
  const usageId = `use_${ulid()}`;
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'usage_debit', ?, ?, ?, ?, ?)`).bind(`led_${ulid()}`, accountId, -priceCents, account.balanceCents, analysisId, JSON.stringify({ api_key_id: apiKeyId, chars_analyzed: chars, billable_units: billableUnits, unit_chars: TEXT_UNIT_CHARS, unit_price_cents: parsed.auto_revise === true ? TEXT_REVISE_UNIT_PRICE_CENTS : TEXT_UNIT_PRICE_CENTS, auto_revise: parsed.auto_revise === true, bucket }), new Date().toISOString()).run();
  await env.DB.prepare(`INSERT INTO usage_events (usage_id, account_id, api_key_id, analysis_id, chars_analyzed, bucket, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'debited', ?)`).bind(usageId, accountId, apiKeyId, analysisId, chars, bucket, priceCents, new Date().toISOString()).run();
  return { chars_analyzed: chars, units_analyzed: billableUnits, bucket, price_cents: priceCents, remaining_balance_cents: account.balanceCents };
}

export async function debitForBatchRequest(env: Env, accountId: string, apiKeyId: string, batchId: string, parsed: AnalyzeBatchRequest): Promise<BillingMetadata> {
  const totalChars = parsed.items.reduce((sum, item) => sum + item.text.length, 0);
  const itemPrices = parsed.items.map((item) => priceForChars(item.text.length));
  const priceCents = itemPrices.reduce((sum, price) => sum + price.priceCents, 0);
  const billableUnits = itemPrices.reduce((sum, price) => sum + price.billableUnits, 0);
  const bucket = "batch_text_1k_units";
  const updated = await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL AND balance_cents >= ?`)
    .bind(priceCents, new Date().toISOString(), accountId, priceCents)
    .run();
  if (!updated.meta || updated.meta.changes < 1) {
    const account = await getAccountBalance(env, accountId);
    throw new InsufficientBalanceError(priceCents, account.balanceCents);
  }
  const account = await getAccountBalance(env, accountId);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, "batch_usage_debit", -priceCents, account.balanceCents, batchId, JSON.stringify({ api_key_id: apiKeyId, units_analyzed: parsed.items.length, billable_units: billableUnits, chars_analyzed: totalChars, unit_chars: TEXT_UNIT_CHARS, unit_price_cents: TEXT_UNIT_PRICE_CENTS, auto_revise: false, bucket }), now)
    .run();
  await env.DB.prepare(`INSERT INTO usage_events (usage_id, account_id, api_key_id, analysis_id, chars_analyzed, bucket, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'debited', ?)`)
    .bind(`use_${ulid()}`, accountId, apiKeyId, batchId, totalChars, bucket, priceCents, now)
    .run();
  return { units_analyzed: parsed.items.length, billable_units: billableUnits, chars_analyzed: totalChars, bucket, price_cents: priceCents, remaining_balance_cents: account.balanceCents } as BillingMetadata & { billable_units: number };
}

export async function debitForVideo(env: Env, accountId: string, apiKeyId: string, analysisId: string): Promise<BillingMetadata> {
  const { bucket, priceCents } = priceForVideo();
  const updated = await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL AND balance_cents >= ?`)
    .bind(priceCents, new Date().toISOString(), accountId, priceCents)
    .run();
  if (!updated.meta || updated.meta.changes < 1) {
    const account = await getAccountBalance(env, accountId);
    throw new InsufficientBalanceError(priceCents, account.balanceCents);
  }
  const account = await getAccountBalance(env, accountId);
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'video_analysis_debit', ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, -priceCents, account.balanceCents, analysisId, JSON.stringify({ api_key_id: apiKeyId, units_analyzed: 1, bucket }), new Date().toISOString())
    .run();
  await env.DB.prepare(`INSERT INTO usage_events (usage_id, account_id, api_key_id, analysis_id, chars_analyzed, bucket, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'debited', ?)`)
    .bind(`use_${ulid()}`, accountId, apiKeyId, analysisId, 1, bucket, priceCents, new Date().toISOString())
    .run();
  return { units_analyzed: 1, bucket, price_cents: priceCents, remaining_balance_cents: account.balanceCents };
}

export async function debitForAudio(env: Env, accountId: string, apiKeyId: string, analysisId: string): Promise<BillingMetadata> {
  const { bucket, priceCents } = priceForAudio();
  const updated = await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL AND balance_cents >= ?`)
    .bind(priceCents, new Date().toISOString(), accountId, priceCents)
    .run();
  if (!updated.meta || updated.meta.changes < 1) {
    const account = await getAccountBalance(env, accountId);
    throw new InsufficientBalanceError(priceCents, account.balanceCents);
  }
  const account = await getAccountBalance(env, accountId);
  const usageId = `use_${ulid()}`;
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'audio_analysis_debit', ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, -priceCents, account.balanceCents, analysisId, JSON.stringify({ api_key_id: apiKeyId, units_analyzed: 1, bucket }), new Date().toISOString())
    .run();
  await env.DB.prepare(`INSERT INTO usage_events (usage_id, account_id, api_key_id, analysis_id, chars_analyzed, bucket, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'debited', ?)`)
    .bind(usageId, accountId, apiKeyId, analysisId, 1, bucket, priceCents, new Date().toISOString())
    .run();
  return { units_analyzed: 1, bucket, price_cents: priceCents, remaining_balance_cents: account.balanceCents };
}

export async function debitForImage(env: Env, accountId: string, apiKeyId: string, analysisId: string): Promise<BillingMetadata> {
  const { bucket, priceCents } = priceForImage();
  const updated = await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ? AND deleted_at IS NULL AND balance_cents >= ?`)
    .bind(priceCents, new Date().toISOString(), accountId, priceCents)
    .run();
  if (!updated.meta || updated.meta.changes < 1) {
    const account = await getAccountBalance(env, accountId);
    throw new InsufficientBalanceError(priceCents, account.balanceCents);
  }
  const account = await getAccountBalance(env, accountId);
  const usageId = `use_${ulid()}`;
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'image_analysis_debit', ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, -priceCents, account.balanceCents, analysisId, JSON.stringify({ api_key_id: apiKeyId, units_analyzed: 1, bucket }), new Date().toISOString())
    .run();
  await env.DB.prepare(`INSERT INTO usage_events (usage_id, account_id, api_key_id, analysis_id, chars_analyzed, bucket, price_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'debited', ?)`)
    .bind(usageId, accountId, apiKeyId, analysisId, 1, bucket, priceCents, new Date().toISOString())
    .run();
  return { units_analyzed: 1, bucket, price_cents: priceCents, remaining_balance_cents: account.balanceCents };
}

export async function refundUsage(env: Env, accountId: string, apiKeyId: string, analysisId: string, billing: BillingMetadata, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?`).bind(billing.price_cents, now, accountId).run();
  const account = await getAccountBalance(env, accountId);
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'usage_refund', ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, billing.price_cents, account.balanceCents, analysisId, JSON.stringify({ api_key_id: apiKeyId, reason }), now)
    .run();
  await env.DB.prepare(`UPDATE usage_events SET status = 'refunded' WHERE analysis_id = ? AND api_key_id = ?`).bind(analysisId, apiKeyId).run();
}

export async function getAccountBalance(env: Env, accountId: string): Promise<{ balanceCents: number }> {
  const row = await env.DB.prepare(`SELECT balance_cents FROM accounts WHERE account_id = ?`).bind(accountId).first<{ balance_cents: number }>();
  return { balanceCents: Number(row?.balance_cents ?? 0) };
}

export async function getBalanceSummary(env: Env, accountId: string): Promise<BalanceSummary> {
  const account = await getAccountBalance(env, accountId);
  const lastUsage = await env.DB.prepare(`SELECT MAX(created_at) AS last_usage_at FROM usage_events WHERE account_id = ? AND status = 'debited'`)
    .bind(accountId)
    .first<{ last_usage_at: string | null }>();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const [today, week, month] = await Promise.all([
    usageSince(env, accountId, new Date(now - day).toISOString()),
    usageSince(env, accountId, new Date(now - 7 * day).toISOString()),
    usageSince(env, accountId, new Date(now - 30 * day).toISOString()),
  ]);
  return {
    account_id: accountId,
    balance_cents: account.balanceCents,
    currency: "USD",
    last_usage_at: lastUsage?.last_usage_at ?? null,
    recent_usage: {
      today_cents: today,
      last_7_days_cents: week,
      last_30_days_cents: month,
    },
  };
}

async function usageSince(env: Env, accountId: string, sinceIso: string): Promise<number> {
  const rows = await env.DB.prepare(`SELECT SUM(price_cents) AS cents FROM usage_events WHERE account_id = ? AND status = 'debited' AND created_at >= ?`)
    .bind(accountId, sinceIso)
    .all<{ cents: number | null }>();
  return Number(rows.results?.[0]?.cents ?? 0);
}

export async function creditCheckoutSession(env: Env, stripeSession: Record<string, unknown>): Promise<void> {
  const stripeSessionId = String(stripeSession.id || "");
  const metadata = (stripeSession.metadata || {}) as Record<string, unknown>;
  const accountId = String(metadata.account_id || "");
  const amountCents = Number(stripeSession.amount_total || metadata.amount_cents || 0);
  if (!stripeSessionId || !accountId || !amountCents) return;

  const existing = await env.DB.prepare(`SELECT status FROM checkout_sessions WHERE stripe_session_id = ?`).bind(stripeSessionId).first<{ status: string }>();
  if (existing?.status === "paid") return;

  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE checkout_sessions SET status = 'paid', paid_at = ? WHERE stripe_session_id = ?`).bind(now, stripeSessionId).run();
  await env.DB.prepare(`UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?`).bind(amountCents, now, accountId).run();
  const account = await getAccountBalance(env, accountId);
  await env.DB.prepare(`INSERT INTO credit_ledger (ledger_id, account_id, type, amount_cents, balance_after_cents, reference_id, metadata_json, created_at) VALUES (?, ?, 'checkout_credit', ?, ?, ?, ?, ?)`)
    .bind(`led_${ulid()}`, accountId, amountCents, account.balanceCents, stripeSessionId, JSON.stringify({ stripe_session_id: stripeSessionId }), now)
    .run();
}

export async function verifyStripeWebhook(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=", 2)).filter((p) => p.length === 2) as [string, string][]);
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;
  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export class BillingAuthError extends Error { constructor() { super("unauthorized"); this.name = "BillingAuthError"; } }
export class InsufficientBalanceError extends Error {
  requiredCents: number;
  balanceCents: number;
  constructor(requiredCents: number, balanceCents: number) {
    super("insufficient_balance");
    this.name = "InsufficientBalanceError";
    this.requiredCents = requiredCents;
    this.balanceCents = balanceCents;
  }
}
