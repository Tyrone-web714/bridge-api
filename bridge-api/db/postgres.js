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

async function withTransaction(callback) {
  const activePool = getPool();
  if (!activePool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  await ensureSchema();
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

    CREATE TABLE IF NOT EXISTS drivers (
      driver_id TEXT PRIMARY KEY,
      driver_name TEXT NOT NULL,
      employee_number TEXT,
      phone_number TEXT,
      route_group TEXT,
      territory TEXT,
      supervisor_username TEXT,
      supervisor_name TEXT,
      team_name TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS supervisor_username TEXT,
      ADD COLUMN IF NOT EXISTS supervisor_name TEXT,
      ADD COLUMN IF NOT EXISTS team_name TEXT;
    CREATE INDEX IF NOT EXISTS drivers_active_idx ON drivers(active);
    CREATE INDEX IF NOT EXISTS drivers_route_group_idx ON drivers(route_group);
    CREATE INDEX IF NOT EXISTS drivers_territory_idx ON drivers(territory);
    CREATE INDEX IF NOT EXISTS drivers_supervisor_idx ON drivers(supervisor_username);
    CREATE INDEX IF NOT EXISTS drivers_team_name_idx ON drivers(team_name);
    CREATE INDEX IF NOT EXISTS drivers_name_idx ON drivers(driver_name);

    CREATE TABLE IF NOT EXISTS operational_distribution_centers (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state_code TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS operational_distribution_centers_state_idx
      ON operational_distribution_centers(state_code, active);

    CREATE TABLE IF NOT EXISTS operational_territories (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      distribution_center_code TEXT,
      state_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      cities JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS operational_territories_center_idx
      ON operational_territories(distribution_center_code, active);

    CREATE TABLE IF NOT EXISTS operational_route_groups (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      territory_code TEXT,
      distribution_center_code TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS operational_route_groups_territory_idx
      ON operational_route_groups(territory_code, active);
    CREATE INDEX IF NOT EXISTS operational_route_groups_center_idx
      ON operational_route_groups(distribution_center_code, active);

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

    CREATE TABLE IF NOT EXISTS daily_route_manifests (
      id TEXT PRIMARY KEY,
      route_date DATE NOT NULL,
      route_number TEXT NOT NULL,
      route_name TEXT,
      start_location TEXT,
      planned_start_at TIMESTAMPTZ,
      planned_end_at TIMESTAMPTZ,
      planned_duration_minutes INTEGER,
      total_stops INTEGER NOT NULL DEFAULT 0,
      total_pallets INTEGER NOT NULL DEFAULT 0,
      total_cases INTEGER NOT NULL DEFAULT 0,
      assigned_driver_id TEXT,
      assigned_driver_name TEXT,
      assigned_at TIMESTAMPTZ,
      assigned_by TEXT,
      status TEXT NOT NULL DEFAULT 'unassigned',
      source_file_name TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (route_date, route_number)
    );

    CREATE INDEX IF NOT EXISTS daily_route_manifests_route_date_idx ON daily_route_manifests(route_date DESC);
    CREATE INDEX IF NOT EXISTS daily_route_manifests_route_number_idx ON daily_route_manifests(route_number);
    CREATE INDEX IF NOT EXISTS daily_route_manifests_assigned_driver_idx ON daily_route_manifests(assigned_driver_id, route_date DESC);
    CREATE INDEX IF NOT EXISTS daily_route_manifests_status_idx ON daily_route_manifests(status);

    CREATE TABLE IF NOT EXISTS daily_route_stops (
      id TEXT PRIMARY KEY,
      manifest_id TEXT NOT NULL REFERENCES daily_route_manifests(id) ON DELETE CASCADE,
      stop_sequence INTEGER NOT NULL,
      account_number TEXT,
      account_name TEXT,
      destination_address TEXT NOT NULL,
      city TEXT,
      state_code TEXT,
      postal_code TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      planned_arrival_at TIMESTAMPTZ,
      planned_departure_at TIMESTAMPTZ,
      planned_service_minutes INTEGER,
      drive_minutes_to_next INTEGER,
      pallet_count INTEGER NOT NULL DEFAULT 0,
      case_count INTEGER NOT NULL DEFAULT 0,
      item_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      actual_arrival_at TIMESTAMPTZ,
      actual_service_started_at TIMESTAMPTZ,
      actual_completed_at TIMESTAMPTZ,
      actual_departure_at TIMESTAMPTZ,
      driver_notes TEXT,
      non_delivery_reason TEXT,
      non_delivery_notes TEXT,
      non_delivery_reported_at TIMESTAMPTZ,
      redelivery_status TEXT NOT NULL DEFAULT 'none',
      redelivery_date DATE,
      redelivery_notes TEXT,
      redelivery_updated_by TEXT,
      redelivery_updated_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manifest_id, stop_sequence)
    );

    CREATE INDEX IF NOT EXISTS daily_route_stops_manifest_idx ON daily_route_stops(manifest_id, stop_sequence);
    CREATE INDEX IF NOT EXISTS daily_route_stops_account_number_idx ON daily_route_stops(account_number);
    CREATE INDEX IF NOT EXISTS daily_route_stops_status_idx ON daily_route_stops(status);
    ALTER TABLE daily_route_stops
      ADD COLUMN IF NOT EXISTS non_delivery_reason TEXT,
      ADD COLUMN IF NOT EXISTS non_delivery_notes TEXT,
      ADD COLUMN IF NOT EXISTS non_delivery_reported_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS redelivery_status TEXT NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS redelivery_date DATE,
      ADD COLUMN IF NOT EXISTS redelivery_notes TEXT,
      ADD COLUMN IF NOT EXISTS redelivery_updated_by TEXT,
      ADD COLUMN IF NOT EXISTS redelivery_updated_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS daily_route_stops_non_delivery_idx ON daily_route_stops(status, non_delivery_reason);
    CREATE INDEX IF NOT EXISTS daily_route_stops_redelivery_status_idx ON daily_route_stops(redelivery_status);

    CREATE TABLE IF NOT EXISTS customer_accounts (
      account_number TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state_code TEXT,
      postal_code TEXT,
      phone TEXT,
      territory TEXT,
      route_group TEXT,
      distribution_center TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS customer_accounts_name_idx ON customer_accounts(account_name);
    CREATE INDEX IF NOT EXISTS customer_accounts_location_idx ON customer_accounts(state_code, city);
    CREATE INDEX IF NOT EXISTS customer_accounts_territory_idx ON customer_accounts(territory);
    CREATE INDEX IF NOT EXISTS customer_accounts_route_group_idx ON customer_accounts(route_group);
    CREATE INDEX IF NOT EXISTS customer_accounts_distribution_center_idx ON customer_accounts(distribution_center);
    CREATE INDEX IF NOT EXISTS customer_accounts_active_idx ON customer_accounts(active);

    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      brand TEXT,
      package_size TEXT,
      category TEXT,
      unit_price NUMERIC(12,2),
      active BOOLEAN NOT NULL DEFAULT true,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS products_name_idx ON products(product_name);
    CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand);
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
    CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);

    CREATE TABLE IF NOT EXISTS account_orders (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      account_name TEXT,
      order_date DATE,
      delivery_date DATE,
      invoice_number TEXT,
      route_manifest_id TEXT REFERENCES daily_route_manifests(id) ON DELETE SET NULL,
      route_stop_id TEXT REFERENCES daily_route_stops(id) ON DELETE SET NULL,
      subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS account_orders_invoice_number_idx
      ON account_orders(invoice_number)
      WHERE invoice_number IS NOT NULL AND invoice_number <> '';
    CREATE INDEX IF NOT EXISTS account_orders_account_idx ON account_orders(account_number, delivery_date DESC);
    CREATE INDEX IF NOT EXISTS account_orders_route_stop_idx ON account_orders(route_stop_id);
    CREATE INDEX IF NOT EXISTS account_orders_status_idx ON account_orders(status);

    CREATE TABLE IF NOT EXISTS account_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES account_orders(id) ON DELETE CASCADE,
      sku TEXT,
      product_name TEXT NOT NULL,
      brand TEXT,
      package_size TEXT,
      category TEXT,
      quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      deduction_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS account_order_items_order_idx ON account_order_items(order_id);
    CREATE INDEX IF NOT EXISTS account_order_items_sku_idx ON account_order_items(sku);
    CREATE INDEX IF NOT EXISTS account_order_items_product_name_idx ON account_order_items(product_name);

    CREATE TABLE IF NOT EXISTS delivery_deductions (
      id TEXT PRIMARY KEY,
      order_id TEXT REFERENCES account_orders(id) ON DELETE CASCADE,
      order_item_id TEXT REFERENCES account_order_items(id) ON DELETE SET NULL,
      account_number TEXT NOT NULL,
      route_stop_id TEXT REFERENCES daily_route_stops(id) ON DELETE SET NULL,
      sku TEXT,
      product_name TEXT,
      reason TEXT NOT NULL,
      quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS delivery_deductions_account_idx ON delivery_deductions(account_number, created_at DESC);
    CREATE INDEX IF NOT EXISTS delivery_deductions_order_idx ON delivery_deductions(order_id);
    CREATE INDEX IF NOT EXISTS delivery_deductions_route_stop_idx ON delivery_deductions(route_stop_id);
    CREATE INDEX IF NOT EXISTS delivery_deductions_reason_idx ON delivery_deductions(reason);

    CREATE TABLE IF NOT EXISTS delivery_settlements (
      id TEXT PRIMARY KEY,
      route_stop_id TEXT NOT NULL UNIQUE REFERENCES daily_route_stops(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES account_orders(id) ON DELETE SET NULL,
      driver_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      completion_status TEXT,
      non_delivery_reason TEXT,
      planned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      delivered_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      rejected_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      missing_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      added_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      planned_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      final_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      supervisor_review_required BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      completed_at TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS delivery_settlements_driver_idx
      ON delivery_settlements(driver_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS delivery_settlements_status_idx
      ON delivery_settlements(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS delivery_settlements_order_idx
      ON delivery_settlements(order_id);

    CREATE TABLE IF NOT EXISTS delivery_settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES delivery_settlements(id) ON DELETE CASCADE,
      order_item_id TEXT REFERENCES account_order_items(id) ON DELETE SET NULL,
      sku TEXT,
      product_name TEXT NOT NULL,
      brand TEXT,
      package_size TEXT,
      category TEXT,
      planned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      delivered_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      rejected_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      missing_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      added_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      final_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      adjustment_reason TEXT,
      notes TEXT,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS delivery_settlement_items_settlement_idx
      ON delivery_settlement_items(settlement_id);
    CREATE INDEX IF NOT EXISTS delivery_settlement_items_order_item_idx
      ON delivery_settlement_items(order_item_id);
    CREATE INDEX IF NOT EXISTS delivery_settlement_items_sku_idx
      ON delivery_settlement_items(sku);

    CREATE TABLE IF NOT EXISTS account_ai_insights (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      insight_type TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      source_period_start DATE,
      source_period_end DATE,
      generated_by TEXT NOT NULL DEFAULT 'rules_engine_v1',
      status TEXT NOT NULL DEFAULT 'active',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      review_notes TEXT,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS account_ai_insights_account_idx ON account_ai_insights(account_number, created_at DESC);
    CREATE INDEX IF NOT EXISTS account_ai_insights_type_idx ON account_ai_insights(insight_type);
    CREATE INDEX IF NOT EXISTS account_ai_insights_status_idx ON account_ai_insights(status);

    CREATE TABLE IF NOT EXISTS data_import_batches (
      id TEXT PRIMARY KEY,
      import_type TEXT NOT NULL,
      source_file_name TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      row_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      imported_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS data_import_batches_type_idx
      ON data_import_batches(import_type, created_at DESC);

    ALTER TABLE account_ai_insights ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
    ALTER TABLE account_ai_insights ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE account_ai_insights ADD COLUMN IF NOT EXISTS review_notes TEXT;

    CREATE TABLE IF NOT EXISTS ai_interaction_logs (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      requester_type TEXT,
      requester_id TEXT,
      account_number TEXT,
      route_manifest_id TEXT,
      route_stop_id TEXT,
      model TEXT,
      status TEXT NOT NULL,
      input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_message TEXT,
      latency_ms INTEGER,
      provider_request_id TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd NUMERIC(12,6),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ai_interaction_logs_endpoint_idx ON ai_interaction_logs(endpoint, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_interaction_logs_requester_idx ON ai_interaction_logs(requester_type, requester_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_interaction_logs_account_idx ON ai_interaction_logs(account_number, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_interaction_logs_status_idx ON ai_interaction_logs(status);

    ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS provider_request_id TEXT;
    ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS input_tokens INTEGER;
    ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS output_tokens INTEGER;
    ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
    ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6);

    CREATE TABLE IF NOT EXISTS prediction_runs (
      id TEXT PRIMARY KEY,
      prediction_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      route_date DATE,
      source_period_start DATE,
      source_period_end DATE,
      sample_count INTEGER NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL DEFAULT 'low',
      engine_version TEXT NOT NULL,
      features JSONB NOT NULL DEFAULT '{}'::jsonb,
      prediction JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS prediction_runs_type_idx
      ON prediction_runs(prediction_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS prediction_runs_entity_idx
      ON prediction_runs(entity_type, entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS prediction_runs_route_date_idx
      ON prediction_runs(route_date DESC, prediction_type);

    CREATE TABLE IF NOT EXISTS supervisor_alerts (
      id TEXT PRIMARY KEY,
      alert_key TEXT NOT NULL UNIQUE,
      supervisor_username TEXT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      route_date DATE,
      status TEXT NOT NULL DEFAULT 'open',
      source TEXT NOT NULL DEFAULT 'rules_engine',
      source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_by TEXT,
      acknowledged_at TIMESTAMPTZ,
      resolved_by TEXT,
      resolved_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS supervisor_alerts_status_idx
      ON supervisor_alerts(status, severity, last_detected_at DESC);
    CREATE INDEX IF NOT EXISTS supervisor_alerts_supervisor_idx
      ON supervisor_alerts(supervisor_username, status, last_detected_at DESC);
    CREATE INDEX IF NOT EXISTS supervisor_alerts_route_date_idx
      ON supervisor_alerts(route_date DESC, alert_type);

    CREATE TABLE IF NOT EXISTS scheduled_report_schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      report_type TEXT NOT NULL DEFAULT 'supervisor_daily_brief',
      supervisor_username TEXT,
      cadence TEXT NOT NULL DEFAULT 'daily',
      local_hour INTEGER NOT NULL DEFAULT 6,
      timezone TEXT NOT NULL DEFAULT 'America/Chicago',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      next_run_at TIMESTAMPTZ NOT NULL,
      last_run_at TIMESTAMPTZ,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS scheduled_report_schedules_due_idx
      ON scheduled_report_schedules(enabled, next_run_at);

    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id TEXT PRIMARY KEY,
      schedule_id TEXT REFERENCES scheduled_report_schedules(id) ON DELETE SET NULL,
      report_type TEXT NOT NULL,
      supervisor_username TEXT,
      route_date DATE,
      status TEXT NOT NULL DEFAULT 'completed',
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_by TEXT NOT NULL DEFAULT 'rules_engine',
      error_message TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS scheduled_reports_supervisor_idx
      ON scheduled_reports(supervisor_username, generated_at DESC);
    CREATE INDEX IF NOT EXISTS scheduled_reports_schedule_idx
      ON scheduled_reports(schedule_id, generated_at DESC);
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
  if (postgisReady === true) return true;

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
  rawQuery,
  withTransaction
};
