import { describe, expect, it } from "vitest";
import { consumeMagicLink, SIGNUP_CREDIT_CENTS } from "../src/account";
import { sha256Hex } from "../src/auth";

class FakeStatement {
  private values: unknown[] = [];
  constructor(private db: FakeDb, private sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.values); }
  async run() { return this.db.run(this.sql, this.values); }
  async all<T>() { return { results: [] as T[] }; }
}

class FakeDb {
  magicLinks = new Map<string, { email: string; used_at?: string }>();
  accounts = new Map<string, { account_id: string; email: string; balance_cents: number }>();
  ledger: Array<{ account_id: string; type: string; amount_cents: number; balance_after_cents: number }> = [];
  sessions: Array<{ account_id: string }> = [];

  prepare(sql: string) { return new FakeStatement(this, sql); }
  async batch(statements: FakeStatement[]) { for (const stmt of statements) await stmt.run(); return []; }

  async first<T>(sql: string, values: unknown[]): Promise<T | null> {
    if (sql.includes("FROM magic_links")) {
      const row = this.magicLinks.get(String(values[0]));
      return row && !row.used_at ? ({ email: row.email } as T) : null;
    }
    if (sql.includes("FROM accounts WHERE email")) {
      const email = String(values[0]);
      const acct = [...this.accounts.values()].find((a) => a.email === email);
      return acct ? ({ account_id: acct.account_id } as T) : null;
    }
    return null;
  }

  async run(sql: string, values: unknown[]) {
    if (sql.startsWith("UPDATE magic_links")) {
      const row = this.magicLinks.get(String(values[1]));
      if (row) row.used_at = String(values[0]);
    } else if (sql.startsWith("INSERT INTO accounts")) {
      this.accounts.set(String(values[0]), { account_id: String(values[0]), email: String(values[1]), balance_cents: Number(values[2]) });
    } else if (sql.startsWith("INSERT INTO credit_ledger")) {
      this.ledger.push({ account_id: String(values[1]), type: "signup_credit", amount_cents: Number(values[2]), balance_after_cents: Number(values[3]) });
    } else if (sql.startsWith("INSERT INTO sessions")) {
      this.sessions.push({ account_id: String(values[1]) });
    }
    return { meta: { changes: 1 } };
  }
}

describe("account signup credit", () => {
  it("credits new accounts with $1.50 and records a ledger row", async () => {
    const db = new FakeDb();
    const token = "ml_test_token";
    db.magicLinks.set(await sha256Hex(token), { email: "new@example.com" });

    const result = await consumeMagicLink({ DB: db } as any, token);
    const account = db.accounts.get(result.accountId);

    expect(account?.balance_cents).toBe(SIGNUP_CREDIT_CENTS);
    expect(db.ledger).toEqual([{ account_id: result.accountId, type: "signup_credit", amount_cents: SIGNUP_CREDIT_CENTS, balance_after_cents: SIGNUP_CREDIT_CENTS }]);
    expect(db.sessions).toHaveLength(1);
  });

  it("does not re-credit existing accounts on later logins", async () => {
    const db = new FakeDb();
    db.accounts.set("acct_existing", { account_id: "acct_existing", email: "existing@example.com", balance_cents: 42 });
    const token = "ml_existing_token";
    db.magicLinks.set(await sha256Hex(token), { email: "existing@example.com" });

    const result = await consumeMagicLink({ DB: db } as any, token);

    expect(result.accountId).toBe("acct_existing");
    expect(db.accounts.get("acct_existing")?.balance_cents).toBe(42);
    expect(db.ledger).toHaveLength(0);
  });
});
