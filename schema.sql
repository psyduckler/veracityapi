CREATE TABLE IF NOT EXISTS analysis_logs (
  analysis_id   TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  api_key_hash  TEXT,
  privacy_mode  INTEGER NOT NULL,
  text_hash     TEXT NOT NULL,
  text          TEXT,
  context_json  TEXT,
  response_json TEXT NOT NULL,
  latency_ms    INTEGER NOT NULL,
  model_version TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'text',
  image_url_domain TEXT
);

CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_key_hash ON analysis_logs(api_key_hash);

CREATE TABLE IF NOT EXISTS access_requests (
  request_id   TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  company      TEXT,
  use_case     TEXT NOT NULL,
  volume       TEXT,
  source       TEXT,
  ip_hash      TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_created ON access_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);

CREATE TABLE IF NOT EXISTS site_events (
  event_id    TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  path        TEXT NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_events_created ON site_events(created_at);
CREATE INDEX IF NOT EXISTS idx_site_events_name ON site_events(event_name);

CREATE TABLE IF NOT EXISTS accounts (
  account_id    TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);

CREATE TABLE IF NOT EXISTS api_keys (
  key_id     TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label      TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id);

CREATE TABLE IF NOT EXISTS extension_exchange_codes (
  code_hash    TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_extension_exchange_account ON extension_exchange_codes(account_id);
CREATE INDEX IF NOT EXISTS idx_extension_exchange_expires ON extension_exchange_codes(expires_at);

CREATE TABLE IF NOT EXISTS credit_ledger (
  ledger_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_account_created ON credit_ledger(account_id, created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  usage_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  api_key_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  chars_analyzed INTEGER NOT NULL,
  bucket TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_account_created ON usage_events(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_analysis ON usage_events(analysis_id);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  checkout_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY(account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_account ON checkout_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe ON checkout_sessions(stripe_session_id);
