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
