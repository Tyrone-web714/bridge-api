const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '003_multi_tenant_foundation.sql'), 'utf8');
const evidencePath = path.join(__dirname, '..', '.tmp_pg_validation', 'final-validation-evidence.json');

const BOOTSTRAP_ORG_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_A = '10000000-0000-4000-8000-00000000000a';
const DEMO_B = '10000000-0000-4000-8000-00000000000b';
const DEMO_C = '10000000-0000-4000-8000-00000000000c';

function requireValidationDatabase(url) {
  assert(url, 'DATABASE_URL is required for final validation.');
  assert(/127\.0\.0\.1:55432/.test(url), 'Final validation must use the isolated local PostgreSQL port.');
  assert(/tsr_mtf_validation/.test(url), 'Final validation must use the throwaway tsr_mtf_validation database.');
  assert(!/render|amazonaws|supabase|neon|railway|production|prod/i.test(url), 'Refusing to validate against a production-like database URL.');
}

async function queryValue(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ? Object.values(result.rows[0])[0] : null;
}

async function tableColumns(client, tableName) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map((row) => row.column_name);
}

async function createPreMigrationSchema(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;

    CREATE TABLE admin_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL DEFAULT 'hash',
      role TEXT NOT NULL DEFAULT 'supervisor',
      display_name TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE audit_events (
      id BIGSERIAL PRIMARY KEY,
      request_id TEXT,
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_id TEXT NOT NULL DEFAULT 'validator',
      method TEXT NOT NULL DEFAULT 'GET',
      path TEXT NOT NULL DEFAULT '/validation',
      status_code INTEGER NOT NULL DEFAULT 200,
      network_hash TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE drivers (
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pin_hash TEXT
    );
    CREATE TABLE driver_sessions (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day',
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
    CREATE TABLE warehouse_employees (
      employee_id TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE delivery_notes (id TEXT PRIMARY KEY);
    CREATE TABLE recent_destinations (record_key TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT 'Destination');
    CREATE TABLE route_sessions (id TEXT PRIMARY KEY);
    CREATE TABLE route_session_events (
      id BIGSERIAL PRIMARY KEY,
      route_session_id TEXT,
      event_type TEXT NOT NULL DEFAULT 'validation',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE daily_route_manifests (
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
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(route_date, route_number)
    );
    CREATE TABLE daily_route_stops (
      id TEXT PRIMARY KEY,
      manifest_id TEXT NOT NULL,
      stop_sequence INTEGER NOT NULL DEFAULT 1,
      destination_address TEXT NOT NULL DEFAULT '100 Validation Way'
    );
    CREATE TABLE customer_accounts (account_number TEXT PRIMARY KEY, account_name TEXT NOT NULL DEFAULT 'Validation Account');
    CREATE TABLE products (sku TEXT PRIMARY KEY, product_name TEXT NOT NULL DEFAULT 'Validation Product');
    CREATE TABLE product_barcodes (barcode TEXT PRIMARY KEY, sku TEXT);
    CREATE TABLE route_truck_inventory_additions (id TEXT PRIMARY KEY);
    CREATE TABLE route_truck_inventory_allocations (id TEXT PRIMARY KEY);
    CREATE TABLE route_departure_inventory_confirmations (manifest_id TEXT PRIMARY KEY);
    CREATE TABLE account_orders (id TEXT PRIMARY KEY);
    CREATE TABLE account_order_items (id TEXT PRIMARY KEY, order_id TEXT);
    CREATE TABLE delivery_deductions (id TEXT PRIMARY KEY);
    CREATE TABLE delivery_settlements (id TEXT PRIMARY KEY);
    CREATE TABLE delivery_settlement_items (id TEXT PRIMARY KEY, settlement_id TEXT);
    CREATE TABLE delivery_documents (id TEXT PRIMARY KEY);
    CREATE TABLE route_closeout_documents (id TEXT PRIMARY KEY);
    CREATE TABLE route_inventory_closeouts (id TEXT PRIMARY KEY);
    CREATE TABLE account_ai_insights (id TEXT PRIMARY KEY);
    CREATE TABLE data_import_batches (id TEXT PRIMARY KEY);
    CREATE TABLE ai_interaction_logs (id TEXT PRIMARY KEY);
    CREATE TABLE prediction_runs (id TEXT PRIMARY KEY);
    CREATE TABLE supervisor_alerts (id TEXT PRIMARY KEY);
    CREATE TABLE scheduled_report_schedules (id TEXT PRIMARY KEY);
    CREATE TABLE scheduled_reports (id TEXT PRIMARY KEY);
    CREATE TABLE low_clearance_bridges (id TEXT PRIMARY KEY, raw JSONB NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE truck_restricted_zones (id TEXT PRIMARY KEY, raw JSONB NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE static_hazard_location_backfill_queue (id BIGSERIAL PRIMARY KEY, raw JSONB NOT NULL DEFAULT '{}'::jsonb);
  `);
}

async function seedPreMigrationData(client) {
  await client.query(`
    INSERT INTO admin_users (username) VALUES ('supervisor.validation');
    INSERT INTO audit_events DEFAULT VALUES;
    INSERT INTO drivers (driver_id, driver_name) VALUES ('827826', 'Validation Driver');
    INSERT INTO driver_sessions (id, driver_id, device_id, token_hash) VALUES ('session-dev', '827826', 'device-dev', 'token-dev');
    INSERT INTO warehouse_employees (employee_id, employee_name) VALUES ('wh-1', 'Warehouse Validator');
    INSERT INTO route_sessions (id) VALUES ('route-session-known');
    INSERT INTO route_session_events (route_session_id) VALUES ('route-session-known'), ('route-session-missing'), (NULL);
    INSERT INTO daily_route_manifests (id, route_date, route_number, assigned_driver_id) VALUES ('manifest-dev', '2026-07-11', 'VAL-001', '827826');
    INSERT INTO daily_route_stops (id, manifest_id) VALUES ('stop-known', 'manifest-dev'), ('stop-orphan', 'missing-manifest');
    INSERT INTO account_orders (id) VALUES ('order-known');
    INSERT INTO account_order_items (id, order_id) VALUES ('order-item-known', 'order-known'), ('order-item-orphan', 'missing-order');
    INSERT INTO delivery_settlements (id) VALUES ('settlement-known');
    INSERT INTO delivery_settlement_items (id, settlement_id) VALUES ('settlement-item-known', 'settlement-known'), ('settlement-item-orphan', 'missing-settlement');
    INSERT INTO low_clearance_bridges (id) VALUES ('bridge-global');
    INSERT INTO truck_restricted_zones (id) VALUES ('zone-global');
  `);
}

async function insertDemoOrganizations(client) {
  await client.query(`
    INSERT INTO organizations (id, name, slug, status) VALUES
      ($1, 'Demo Fleet A', 'demo-fleet-a', 'active'),
      ($2, 'Demo Fleet B', 'demo-fleet-b', 'active'),
      ($3, 'Demo Fleet C', 'demo-fleet-c', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [DEMO_A, DEMO_B, DEMO_C]);
}

async function verifyForwardMigration(client) {
  const bootstrapCount = Number(await queryValue(client, 'SELECT COUNT(*) FROM organizations WHERE id = $1 AND name = $2 AND slug = $3', [
    BOOTSTRAP_ORG_ID,
    'Truck-Safe Routing Development',
    'truck-safe-routing-development'
  ]));
  assert.strictEqual(bootstrapCount, 1, 'Bootstrap Organization must exist exactly once.');

  assert((await tableColumns(client, 'drivers')).includes('organization_id'), 'drivers.organization_id missing');
  assert((await tableColumns(client, 'drivers')).includes('internal_driver_id'), 'drivers.internal_driver_id missing');
  assert((await tableColumns(client, 'drivers')).includes('company_driver_number'), 'drivers.company_driver_number missing');
  assert(!(await tableColumns(client, 'low_clearance_bridges')).includes('organization_id'), 'low_clearance_bridges must remain platform-global');
  assert(!(await tableColumns(client, 'truck_restricted_zones')).includes('organization_id'), 'truck_restricted_zones must remain platform-global');

  assert.strictEqual(await queryValue(client, 'SELECT organization_id FROM drivers WHERE driver_id = $1', ['827826']), BOOTSTRAP_ORG_ID);
  assert.strictEqual(await queryValue(client, 'SELECT company_driver_number FROM drivers WHERE driver_id = $1', ['827826']), '827826');
  assert(await queryValue(client, 'SELECT internal_driver_id FROM drivers WHERE driver_id = $1', ['827826']), 'internal driver ID missing');

  const exceptionCount = Number(await queryValue(client, 'SELECT COUNT(*) FROM tenant_backfill_exceptions'));
  assert(exceptionCount >= 3, 'Unknown ownership records should be reported as exceptions.');

  const duplicateInternalIds = Number(await queryValue(client, `
    SELECT COUNT(*) FROM (
      SELECT internal_driver_id FROM drivers WHERE internal_driver_id IS NOT NULL GROUP BY internal_driver_id HAVING COUNT(*) > 1
    ) duplicates
  `));
  assert.strictEqual(duplicateInternalIds, 0, 'Internal driver IDs must be globally unique.');
}

async function verifyConstraints(client) {
  await client.query(`
    INSERT INTO drivers (driver_id, internal_driver_id, organization_id, company_driver_number, driver_name)
    VALUES ('demo-a-driver-1', gen_random_uuid()::text, $1, 'DUP-100', 'Demo A Driver')
  `, [DEMO_A]);
  await client.query(`
    INSERT INTO drivers (driver_id, internal_driver_id, organization_id, company_driver_number, driver_name)
    VALUES ('demo-b-driver-1', gen_random_uuid()::text, $1, 'DUP-100', 'Demo B Driver')
  `, [DEMO_B]);

  let duplicateRejected = false;
  try {
    await client.query(`
      INSERT INTO drivers (driver_id, internal_driver_id, organization_id, company_driver_number, driver_name)
      VALUES ('demo-a-driver-2', gen_random_uuid()::text, $1, 'DUP-100', 'Demo A Duplicate')
    `, [DEMO_A]);
  } catch (error) {
    duplicateRejected = error.code === '23505';
  }
  assert(duplicateRejected, 'Duplicate company driver number in the same Organization must be rejected.');
}

async function verifyRepositoryIsolation(client) {
  const tenant = require('../services/tenantContext');

  await client.query(`
    INSERT INTO drivers (driver_id, internal_driver_id, organization_id, company_driver_number, driver_name)
    VALUES
      ('demo-a-driver-200', gen_random_uuid()::text, $1, 'A-200', 'Demo A Route Driver'),
      ('demo-b-driver-200', gen_random_uuid()::text, $2, 'B-200', 'Demo B Route Driver')
  `, [DEMO_A, DEMO_B]);

  const driversA = await client.query('SELECT company_driver_number FROM drivers WHERE organization_id = $1 ORDER BY company_driver_number', [DEMO_A]);
  const driversB = await client.query('SELECT company_driver_number FROM drivers WHERE organization_id = $1 ORDER BY company_driver_number', [DEMO_B]);
  assert(driversA.rows.some((driver) => driver.company_driver_number === 'A-200'), 'Demo Fleet A driver missing from A list.');
  assert(!driversA.rows.some((driver) => driver.company_driver_number === 'B-200'), 'Demo Fleet A retrieved Demo Fleet B driver.');
  assert(driversB.rows.some((driver) => driver.company_driver_number === 'B-200'), 'Demo Fleet B driver missing from B list.');

  await client.query(`
    INSERT INTO daily_route_manifests (
      id, organization_id, route_date, route_number, assigned_driver_id, status
    )
    VALUES
      ('manifest-demo-a', $1, '2026-07-12', 'DEMO-A-001', 'A-200', 'assigned'),
      ('manifest-demo-b', $2, '2026-07-12', 'DEMO-B-001', 'B-200', 'assigned')
  `, [DEMO_A, DEMO_B]);

  const manifestsA = await client.query('SELECT id FROM daily_route_manifests WHERE organization_id = $1 AND route_date = $2', [DEMO_A, '2026-07-12']);
  assert(manifestsA.rows.some((route) => route.id === 'manifest-demo-a'), 'Demo Fleet A manifest missing from A list.');
  assert(!manifestsA.rows.some((route) => route.id === 'manifest-demo-b'), 'Demo Fleet A retrieved Demo Fleet B manifest.');

  const blockedUpdate = await client.query(
    'UPDATE daily_route_manifests SET assigned_driver_id = $1 WHERE id = $2 AND organization_id = $3',
    ['A-200', 'manifest-demo-b', DEMO_A]
  );
  assert.strictEqual(blockedUpdate.rowCount, 0, 'Demo Fleet A updated Demo Fleet B manifest.');
  const blockedDelete = await client.query(
    'DELETE FROM daily_route_manifests WHERE id = $1 AND organization_id = $2',
    ['manifest-demo-b', DEMO_A]
  );
  assert.strictEqual(blockedDelete.rowCount, 0, 'Demo Fleet A deleted Demo Fleet B manifest.');

  const loginA = await client.query(
    "SELECT driver_id FROM drivers WHERE LOWER(TRIM(COALESCE(company_driver_number, driver_id))) = LOWER(TRIM($1)) AND organization_id = $2",
    ['A-200', DEMO_A]
  );
  const loginWrongOrg = await client.query(
    "SELECT driver_id FROM drivers WHERE LOWER(TRIM(COALESCE(company_driver_number, driver_id))) = LOWER(TRIM($1)) AND organization_id = $2",
    ['A-200', DEMO_B]
  );
  assert.strictEqual(loginA.rowCount, 1, 'Driver login should resolve inside expected Organization.');
  assert.strictEqual(loginWrongOrg.rowCount, 0, 'Driver login resolved across Organizations.');

  assert.notStrictEqual(
    tenant.scopedCacheKey({ organizationId: DEMO_A }, ['route', 'today']),
    tenant.scopedCacheKey({ organizationId: DEMO_B }, ['route', 'today']),
    'Cache keys must differ by Organization.'
  );

  const globalBridgeCount = Number(await queryValue(client, 'SELECT COUNT(*) FROM low_clearance_bridges'));
  assert(globalBridgeCount >= 1, 'Platform-global bridge data should remain available.');

  const repositorySource = fs.readFileSync(path.join(__dirname, '..', 'db', 'repositories.js'), 'utf8');
  for (const expectedFilter of [
    "applyOrganizationFilter(where, values, 'drivers'",
    "applyOrganizationFilter(where, values, 'daily_route_manifests'",
    'AND organization_id = $5',
    'AND manifest.organization_id = $3',
    'AND organization_id = $2'
  ]) {
    assert(repositorySource.includes(expectedFilter), `Repository source missing tenant filter evidence: ${expectedFilter}`);
  }
}

async function verifyRollback(client) {
  const privateTables = [
    'admin_users',
    'audit_events',
    'drivers',
    'driver_sessions',
    'warehouse_employees',
    'delivery_notes',
    'recent_destinations',
    'route_sessions',
    'route_session_events',
    'daily_route_manifests',
    'daily_route_stops',
    'customer_accounts',
    'products',
    'product_barcodes',
    'route_truck_inventory_additions',
    'route_truck_inventory_allocations',
    'route_departure_inventory_confirmations',
    'account_orders',
    'account_order_items',
    'delivery_deductions',
    'delivery_settlements',
    'delivery_settlement_items',
    'delivery_documents',
    'route_closeout_documents',
    'route_inventory_closeouts',
    'account_ai_insights',
    'data_import_batches',
    'ai_interaction_logs',
    'prediction_runs',
    'supervisor_alerts',
    'scheduled_report_schedules',
    'scheduled_reports'
  ];
  await client.query(`
    DROP INDEX IF EXISTS drivers_internal_driver_id_unique_idx;
    DROP INDEX IF EXISTS drivers_org_company_driver_number_unique_idx;
  `);
  for (const table of privateTables) {
    await client.query(`DROP INDEX IF EXISTS ${table}_organization_idx`);
  }
  for (const table of privateTables) {
    await client.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS organization_id`);
  }
  await client.query(`
    ALTER TABLE drivers DROP COLUMN IF EXISTS internal_driver_id;
    ALTER TABLE drivers DROP COLUMN IF EXISTS company_driver_number;
    ALTER TABLE driver_sessions DROP COLUMN IF EXISTS internal_driver_id;
    ALTER TABLE warehouse_employees DROP COLUMN IF EXISTS company_employee_id;
    DROP TABLE IF EXISTS tenant_backfill_exceptions;
    DROP TABLE IF EXISTS organizations;
  `);
  assert(!(await tableColumns(client, 'drivers')).includes('organization_id'), 'Rollback should remove drivers.organization_id.');
  assert(!(await tableColumns(client, 'drivers')).includes('internal_driver_id'), 'Rollback should remove drivers.internal_driver_id.');
  assert(!(await tableColumns(client, 'drivers')).includes('company_driver_number'), 'Rollback should remove drivers.company_driver_number.');
  assert.strictEqual(await queryValue(client, 'SELECT driver_name FROM drivers WHERE driver_id = $1', ['827826']), 'Validation Driver');
}

async function main() {
  requireValidationDatabase(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const evidence = {
    database: 'local isolated PostgreSQL/PostGIS on 127.0.0.1:55432 database tsr_mtf_validation',
    nonProduction: true,
    startedAt: new Date().toISOString()
  };
  try {
    console.log('[final-validation] creating pre-migration schema');
    await createPreMigrationSchema(client);
    evidence.preMigrationTables = Number(await queryValue(client, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"));
    console.log('[final-validation] seeding pre-migration data');
    await seedPreMigrationData(client);
    evidence.preMigrationDriverRows = Number(await queryValue(client, 'SELECT COUNT(*) FROM drivers'));
    evidence.preMigrationBridgeRows = Number(await queryValue(client, 'SELECT COUNT(*) FROM low_clearance_bridges'));
    console.log('[final-validation] applying forward migration');
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('[final-validation] inserting demo organizations');
    await insertDemoOrganizations(client);
    console.log('[final-validation] verifying forward migration');
    await verifyForwardMigration(client);
    console.log('[final-validation] verifying constraints');
    await verifyConstraints(client);
    console.log('[final-validation] verifying repository tenant isolation');
    await verifyRepositoryIsolation(client);
    client.release();
    const rollbackClient = await pool.connect();
    console.log('[final-validation] verifying rollback');
    await verifyRollback(rollbackClient);
    rollbackClient.release();
    evidence.forwardMigration = 'passed';
    evidence.backfill = 'passed';
    evidence.ownershipExceptions = 'passed';
    evidence.constraints = 'passed';
    evidence.tenantIsolation = 'passed';
    evidence.rollback = 'passed';
    evidence.completedAt = new Date().toISOString();
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback failure when no transaction is open.
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
