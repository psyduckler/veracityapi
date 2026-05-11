import { describe, expect, it } from "vitest";
import { debitForBatchRequest, getBalanceSummary } from "../src/billing";
import { parseAnalyzeBatchRequest, ValidationError } from "../src/validate";

function req(body: unknown) {
  return new Request("https://example.com/v1/analyze-batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private db: FakeDb, private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.values); }
  async run() { return this.db.run(this.sql, this.values); }
  async all<T>() { return this.db.all<T>(this.sql, this.values); }
}

class FakeDb {
  accounts = new Map<string, { balance_cents: number }>();
  ledger: Array<{ type: string; amount_cents: number; balance_after_cents: number; metadata: Record<string, unknown> }> = [];
  usage: Array<{ analysis_id: string; chars_analyzed: number; bucket: string; price_cents: number; status: string; created_at: string }> = [];

  prepare(sql: string) { return new FakeStatement(this, sql); }

  async first<T>(sql: string, values: unknown[]): Promise<T | null> {
    if (sql.includes("SELECT balance_cents FROM accounts")) {
      const account = this.accounts.get(String(values[0]));
      return account ? ({ balance_cents: account.balance_cents } as T) : null;
    }
    if (sql.includes("MAX(created_at) AS last_usage_at")) {
      const accountId = String(values[0]);
      const rows = this.usage.filter((u) => accountId === "acct_1" && u.status === "debited");
      return ({ last_usage_at: rows.map((u) => u.created_at).sort().at(-1) || null } as T);
    }
    return null;
  }

  async all<T>(sql: string, values: unknown[]): Promise<{ results: T[] }> {
    if (sql.includes("SUM(price_cents) AS cents")) {
      const accountId = String(values[0]);
      const since = String(values[1]);
      const cents = accountId === "acct_1" ? this.usage.filter((u) => u.status === "debited" && u.created_at >= since).reduce((sum, u) => sum + u.price_cents, 0) : 0;
      return { results: [{ cents } as T] };
    }
    return { results: [] };
  }

  async run(sql: string, values: unknown[]) {
    if (sql.startsWith("UPDATE accounts SET balance_cents = balance_cents -")) {
      const price = Number(values[0]);
      const accountId = String(values[2]);
      const account = this.accounts.get(accountId);
      if (!account || account.balance_cents < price) return { meta: { changes: 0 } };
      account.balance_cents -= price;
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO credit_ledger")) {
      this.ledger.push({ type: String(values[2]), amount_cents: Number(values[3]), balance_after_cents: Number(values[4]), metadata: JSON.parse(String(values[6])) });
    } else if (sql.startsWith("INSERT INTO usage_events")) {
      this.usage.push({ analysis_id: String(values[3]), chars_analyzed: Number(values[4]), bucket: String(values[5]), price_cents: Number(values[6]), status: "debited", created_at: String(values[7]) });
    }
    return { meta: { changes: 1 } };
  }
}

describe("parseAnalyzeBatchRequest", () => {
  it("accepts up to 25 text items with ids and shared context", async () => {
    const parsed = await parseAnalyzeBatchRequest(req({
      items: [
        { id: "post_001", text: "This is a sufficiently long first item for scoring." },
        { id: "post_002", text: "This is a sufficiently long second item for scoring." },
      ],
      context: { format: "social_post", intended_use: "publish", domain: "travel_safety" },
      privacy_mode: true,
    }));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].id).toBe("post_001");
    expect(parsed.context).toEqual({ format: "social_post", intended_use: "publish", domain: "travel_safety" });
  });

  it("rejects more than 25 items, items over 4k chars, and batches over 50k chars", async () => {
    const text = "a".repeat(20);
    await expect(parseAnalyzeBatchRequest(req({ items: Array.from({ length: 26 }, (_, i) => ({ id: `item_${i}`, text })) }))).rejects.toBeInstanceOf(ValidationError);
    await expect(parseAnalyzeBatchRequest(req({ items: [{ id: "too_long", text: "a".repeat(4001) }] }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("batch billing and balance summary", () => {
  it("debits one cent per short batch item and records account usage", async () => {
    const db = new FakeDb();
    db.accounts.set("acct_1", { balance_cents: 150 });
    const parsed = await parseAnalyzeBatchRequest(req({ items: [
      { id: "post_1", text: "This is a sufficiently long first item for scoring." },
      { id: "post_2", text: "This is a sufficiently long second item for scoring." },
    ] }));

    const billing = await debitForBatchRequest({ DB: db } as any, "acct_1", "key_1", "batch_1", parsed);

    expect(billing).toEqual({ units_analyzed: 2, chars_analyzed: 103, bucket: "batch_text_v0", price_cents: 2, remaining_balance_cents: 148 });
    expect(db.accounts.get("acct_1")?.balance_cents).toBe(148);
    expect(db.ledger[0]).toMatchObject({ type: "batch_usage_debit", amount_cents: -2, balance_after_cents: 148 });
    expect(db.ledger[0].metadata).toMatchObject({ api_key_id: "key_1", units_analyzed: 2, bucket: "batch_text_v0" });
    expect(db.usage[0]).toMatchObject({ analysis_id: "batch_1", chars_analyzed: 103, bucket: "batch_text_v0", price_cents: 2 });
  });

  it("returns balance, last usage, and recent usage windows", async () => {
    const db = new FakeDb();
    db.accounts.set("acct_1", { balance_cents: 842 });
    db.usage.push({ analysis_id: "ana_1", chars_analyzed: 100, bucket: "up_to_4k", price_cents: 1, status: "debited", created_at: new Date().toISOString() });

    const summary = await getBalanceSummary({ DB: db } as any, "acct_1");

    expect(summary.account_id).toBe("acct_1");
    expect(summary.balance_cents).toBe(842);
    expect(summary.currency).toBe("USD");
    expect(summary.last_usage_at).toBeTruthy();
    expect(summary.recent_usage.today_cents).toBe(1);
    expect(summary.recent_usage.last_7_days_cents).toBe(1);
    expect(summary.recent_usage.last_30_days_cents).toBe(1);
  });
});
