const { Pool } = require('pg');

let pool = null;
let schemaReady = false;
let schemaPromise = null;
let postgisReady = null;

function readIntegerEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isDatabaseConfigured()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: readIntegerEnv('PG_POOL_MAX', 10),
      idleTimeoutMillis: readIntegerEnv('PG_IDLE_TIMEOUT_MS', 30000),
      connectionTimeoutMillis: readIntegerEnv('PG_CONNECTION_TIMEOUT_MS', 5000),
      ssl: process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined
    });

    pool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error.message);
    });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();
  if (!activePool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  await ensureSchema();
  return activePool.query(text, params);
}

async function rawQuery(text, params = []) {
  const activePool = getPool();
  if (!activePool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  return activePool.query(text, params);
}

async function ensureSchema() {
  if (schemaReady || !isDatabaseConfigured()) return;
  if (schemaPromise) return schemaPromise;

  const activePool = getPool();
  schemaPromise = activePool.query(`
    CREATE TABLE IF NOT EXISTS manual_hazards (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      clearance_ft DOUBLE PRECISION,
      restriction TEXT,
      notes TEXT,
      reported_by TEXT,
      source TEXT,
      report_source TEXT,
      status TEXT,
      enabled BOOLEAN,
      driver_id TEXT,
      driver_name TEXT,
      route_destination TEXT,
      reported_at TIMESTAMPTZ,
      reported_speed_mph DOUBLE PRECISION,
      reported_heading DOUBLE PRECISION,
      route_deviation_m DOUBLE PRECISION,
      was_on_route BOOLEAN,
      nearby_address TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      review_notes TEXT,
      rejection_reason TEXT,
      confidence TEXT,
      geometry JSONB NOT NULL DEFAULT '[]'::jsonb,
      polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS manual_hazards_status_idx ON manual_hazards(status);
    CREATE INDEX IF NOT EXISTS manual_hazards_category_idx ON manual_hazards(category);
    CREATE INDEX IF NOT EXISTS manual_hazards_report_source_idx ON manual_hazards(report_source);
    CREATE INDEX IF NOT EXISTS manual_hazards_enabled_idx ON manual_hazards(enabled);

    CREATE TABLE IF NOT EXISTS admin_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'supervisor',
      display_name TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(role);
    CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users(active);

    CREATE TABLE IF NOT EXISTS delivery_notes (
      id TEXT PRIMARY KEY,
      place_id TEXT,
      destination TEXT,
      address TEXT,
      account_name TEXT,
      customer_name TEXT,
      instructions TEXT,
      driver_name TEXT,
      route_context TEXT,
      photos JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS delivery_notes_place_id_idx ON delivery_notes(place_id);
    CREATE INDEX IF NOT EXISTS delivery_notes_destination_idx ON delivery_notes(destination);
    CREATE INDEX IF NOT EXISTS delivery_notes_updated_at_idx ON delivery_notes(updated_at DESC);

    CREATE TABLE IF NOT EXISTS recent_destinations (
      record_key TEXT PRIMARY KEY,
      place_id TEXT,
      description TEXT NOT NULL,
      main_text TEXT,
      secondary_text TEXT,
      photo_url TEXT,
      place_photo_url TEXT,
      street_view_url TEXT,
      photo_source TEXT,
      phone_number TEXT,
      international_phone_number TEXT,
      name TEXT,
      saved_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS recent_destinations_saved_at_idx ON recent_destinations(saved_at DESC);

    CREATE TABLE IF NOT EXISTS low_clearance_bridges (
      id TEXT PRIMARY KEY,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      clearance_ft DOUBLE PRECISION,
      location_address TEXT,
      location_description TEXT,
      location_city TEXT,
      location_state TEXT,
      state_code TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      verification_notes TEXT,
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS low_clearance_bridges_lat_lng_idx ON low_clearance_bridges(latitude, longitude);
    ALTER TABLE low_clearance_bridges
      ADD COLUMN IF NOT EXISTS location_address TEXT,
      ADD COLUMN IF NOT EXISTS location_description TEXT,
      ADD COLUMN IF NOT EXISTS location_city TEXT,
      ADD COLUMN IF NOT EXISTS location_state TEXT,
      ADD COLUMN IF NOT EXISTS state_code TEXT,
      ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS verification_notes TEXT,
      ADD COLUMN IF NOT EXISTS verified_by TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS low_clearance_bridges_verification_status_idx ON low_clearance_bridges(verification_status);
    CREATE INDEX IF NOT EXISTS low_clearance_bridges_active_idx ON low_clearance_bridges(active);
    CREATE INDEX IF NOT EXISTS low_clearance_bridges_state_code_idx ON low_clearance_bridges(state_code);

    CREATE TABLE IF NOT EXISTS truck_restricted_zones (
      id TEXT PRIMARY KEY,
      zone_type TEXT NOT NULL,
      name TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      restriction TEXT,
      geometry JSONB NOT NULL DEFAULT '[]'::jsonb,
      polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
      location_address TEXT,
      location_description TEXT,
      location_city TEXT,
      location_state TEXT,
      state_code TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      verification_notes TEXT,
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS truck_restricted_zones_type_idx ON truck_restricted_zones(zone_type);
    CREATE INDEX IF NOT EXISTS truck_restricted_zones_lat_lng_idx ON truck_restricted_zones(latitude, longitude);
    ALTER TABLE truck_restricted_zones
      ADD COLUMN IF NOT EXISTS location_address TEXT,
      ADD COLUMN IF NOT EXISTS location_description TEXT,
      ADD COLUMN IF NOT EXISTS location_city TEXT,
      ADD COLUMN IF NOT EXISTS location_state TEXT,
      ADD COLUMN IF NOT EXISTS state_code TEXT,
      ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS verification_notes TEXT,
      ADD COLUMN IF NOT EXISTS verified_by TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS truck_restricted_zones_verification_status_idx ON truck_restricted_zones(verification_status);
    CREATE INDEX IF NOT EXISTS truck_restricted_zones_active_idx ON truck_restricted_zones(active);
    CREATE INDEX IF NOT EXISTS truck_restricted_zones_state_code_idx ON truck_restricted_zones(state_code);

    CREATE TABLE IF NOT EXISTS static_hazard_location_backfill_queue (
      id BIGSERIAL PRIMARY KEY,
      hazard_category TEXT NOT NULL,
      hazard_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      priority INTEGER NOT NULL DEFAULT 100,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processing_started_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (hazard_category, hazard_id)
    );

    CREATE INDEX IF NOT EXISTS static_hazard_location_backfill_status_idx
      ON static_hazard_location_backfill_queue(status, priority, queued_at);
    CREATE INDEX IF NOT EXISTS static_hazard_location_backfill_hazard_idx
      ON static_hazard_location_backfill_queue(hazard_category, hazard_id);

    CREATE TABLE IF NOT EXISTS route_sessions (
      id TEXT PRIMARY KEY,
      origin_label TEXT,
      destination_label TEXT,
      origin JSONB NOT NULL DEFAULT '{}'::jsonb,
      destination JSONB NOT NULL DEFAULT '{}'::jsonb,
      chosen_route_index INTEGER,
      route_count INTEGER,
      hazard_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      chosen_route_hazards JSONB NOT NULL DEFAULT '{}'::jsonb,
      used_truck_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      used_tuning JSONB NOT NULL DEFAULT '{}'::jsonb,
      route_options JSONB NOT NULL DEFAULT '[]'::jsonb,
      request JSONB NOT NULL DEFAULT '{}'::jsonb,
      review_status TEXT NOT NULL DEFAULT 'unreviewed',
      supervisor_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      archived_by TEXT,
      archive_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE route_sessions
      ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'unreviewed',
      ADD COLUMN IF NOT EXISTS supervisor_notes TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS archived_by TEXT,
      ADD COLUMN IF NOT EXISTS archive_reason TEXT;

    CREATE INDEX IF NOT EXISTS route_sessions_created_at_idx ON route_sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS route_sessions_destination_label_idx ON route_sessions(destination_label);
    CREATE INDEX IF NOT EXISTS route_sessions_review_status_idx ON route_sessions(review_status);
    CREATE INDEX IF NOT EXISTS route_sessions_archived_at_idx ON route_sessions(archived_at);

    CREATE TABLE IF NOT EXISTS route_session_events (
      id BIGSERIAL PRIMARY KEY,
      route_session_id TEXT REFERENCES route_sessions(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      severity TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS route_session_events_session_idx ON route_session_events(route_session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS route_session_events_type_idx ON route_session_events(event_type, created_at DESC);
  `);

  try {
    await schemaPromise;
    schemaReady = true;
  } finally {
    schemaPromise = null;
  }
}

async function isPostgisEnabled() {
  if (!isDatabaseConfigured()) return false;
  if (postgisReady !== null) return postgisReady;

  try {
    const result = await rawQuery(`
      SELECT
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS has_postgis,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'low_clearance_bridges'
            AND column_name = 'geom'
        ) AS has_bridge_geom,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'truck_restricted_zones'
            AND column_name = 'route_geom'
        ) AS has_zone_geom
    `);
    const row = result.rows[0] || {};
    postgisReady = Boolean(row.has_postgis && row.has_bridge_geom && row.has_zone_geom);
    return postgisReady;
  } catch {
    postgisReady = false;
    return false;
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = false;
    schemaPromise = null;
    postgisReady = null;
  }
}

module.exports = {
  closePool,
  ensureSchema,
  isDatabaseConfigured,
  isPostgisEnabled,
  query,
  rawQuery
};
