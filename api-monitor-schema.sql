CREATE TABLE IF NOT EXISTS api_events (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  chain TEXT NOT NULL,
  status INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  source TEXT NOT NULL,
  cached INTEGER NOT NULL DEFAULT 0,
  rpc_code INTEGER,
  error_kind TEXT,
  retry_after INTEGER
);
CREATE INDEX IF NOT EXISTS api_events_at ON api_events(at DESC, id DESC);
CREATE TABLE IF NOT EXISTS api_hourly (
  hour INTEGER NOT NULL,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  limited INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(hour, provider, source)
);
CREATE TABLE IF NOT EXISTS api_budgets (
  provider TEXT PRIMARY KEY,
  daily_limit INTEGER,
  alert_percent INTEGER NOT NULL DEFAULT 80,
  updated_at INTEGER NOT NULL
);
-- Application alert thresholds only; these are not provider subscription quotas.
INSERT OR IGNORE INTO api_budgets(provider,daily_limit,alert_percent,updated_at) VALUES
('helius',10000,80,unixepoch()*1000),
('alchemy',10000,80,unixepoch()*1000),
('solana-rpc',5000,80,unixepoch()*1000),
('dexscreener',2000,80,unixepoch()*1000),
('gecko',1000,80,unixepoch()*1000),
('goplus',1000,80,unixepoch()*1000),
('worker',2000,80,unixepoch()*1000);
