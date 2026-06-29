ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

CREATE TABLE IF NOT EXISTS driver_sessions (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS driver_sessions_driver_idx
  ON driver_sessions(driver_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS driver_sessions_token_idx
  ON driver_sessions(token_hash);

