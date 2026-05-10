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
  model_version TEXT NOT NULL
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
