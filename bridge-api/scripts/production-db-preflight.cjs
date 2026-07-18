require('dotenv').config();

const { Pool } = require('pg');
const postgres = require('../db/postgres');

const EXPECTED_MIGRATIONS = [
  '001_audit_events.sql',
  '002_driver_sessions.sql',
  '003_multi_tenant_foundation.sql',
  '004_authentication_rbac_foundation.sql',
  '005_shared_safety_foundation.sql',
  '006_bi_kpi_foundation.sql',
  '007_logistics_intelligence_foundation.sql',
  '008_fleet_intelligence_scoring_foundation.sql',
  '009_data_lifecycle_foundation.sql',
  '010_enterprise_identity_foundation.sql'
];

const EXPECTED_TABLES = [
  'organizations',
  'admin_users',
  'drivers',
  'driver_sessions',
  'warehouse_employees',
  'warehouse_employee_sessions',
  'daily_route_manifests',
  'daily_route_stops',
  'delivery_notes',
  'private_hazard_submissions',
  'shared_safety_moderation_candidates',
  'shared_safety_records',
  'kpi_definitions',
  'kpi_formula_versions',
  'kpi_snapshots',
  'logistics_events',
  'logistics_signals',
  'logistics_recommendations',
  'fleet_score_models',
  'fleet_score_snapshots',
  'retention_policies',
  'legal_holds',
  'lifecycle_deletion_requests',
  'data_subject_requests',
  'organization_lifecycle_events',
  'lifecycle_object_references',
  'lifecycle_purge_jobs',
  'lifecycle_tombstones',
  'data_exports',
  'lifecycle_events',
  'organization_memberships',
  'organization_identity_providers',
  'verified_organization_domains',
  'federated_identities',
  'identity_claim_mappings',
  'sso_authentication_transactions',
  'scim_configurations',
  'scim_provisioning_events',
  'enterprise_identity_break_glass_records',
  'identity_security_events'
];

function assertDatabaseConfigured() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for database preflight.');
  }
}

function safeCount(label, rows) {
  return {
    check: label,
    count: Number(rows?.[0]?.count || 0)
  };
}

async function tableExists(client, tableName) {
  const result = await client(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(client, tableName, columnName) {
  const result = await client(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function main() {
  assertDatabaseConfigured();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10) || 5000,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined
  });
  const activeClient = await pool.connect();
  const client = (text, params = []) => activeClient.query(text, params);
  try {
    await client('BEGIN READ ONLY');
    const version = await client('SHOW server_version');
    const postgis = await client("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS enabled");
    const migrationsTableExists = await tableExists(client, 'schema_migrations');
    const applied = migrationsTableExists
      ? await client('SELECT filename, applied_at FROM schema_migrations ORDER BY filename')
      : { rows: [] };

    const tables = [];
    for (const table of EXPECTED_TABLES) {
      tables.push({ table, exists: await tableExists(client, table) });
    }

    const ownershipChecks = [];
    for (const table of ['drivers', 'daily_route_manifests', 'daily_route_stops', 'delivery_notes']) {
      if (await tableExists(client, table) && await columnExists(client, table, 'organization_id')) {
        const result = await client(`SELECT count(*)::int AS count FROM ${table} WHERE organization_id IS NULL`);
        ownershipChecks.push(safeCount(`${table}.organization_id NULL`, result.rows));
      }
    }

    const identityChecks = [];
    if (await tableExists(client, 'drivers')) {
      if (await columnExists(client, 'drivers', 'internal_driver_id')) {
        const result = await client('SELECT count(*)::int AS count FROM drivers WHERE internal_driver_id IS NULL');
        identityChecks.push(safeCount('drivers.internal_driver_id NULL', result.rows));
      }
      if (await columnExists(client, 'drivers', 'organization_id') && await columnExists(client, 'drivers', 'company_driver_number')) {
        const result = await client(`
          SELECT count(*)::int AS count
          FROM (
            SELECT organization_id, lower(company_driver_number) AS company_driver_number
            FROM drivers
            WHERE organization_id IS NOT NULL AND company_driver_number IS NOT NULL
            GROUP BY organization_id, lower(company_driver_number)
            HAVING count(*) > 1
          ) duplicate_driver_numbers
        `);
        identityChecks.push(safeCount('duplicate organization/company driver numbers', result.rows));
      }
    }

    const tableCounts = [];
    for (const table of EXPECTED_TABLES.filter((name) => tables.find((item) => item.table === name && item.exists))) {
      const result = await client(`SELECT count(*)::int AS count FROM ${table}`);
      tableCounts.push(safeCount(table, result.rows));
    }

    await client('ROLLBACK');

    const report = {
      ok: true,
      readOnly: true,
      database: {
        postgresVersion: version.rows[0]?.server_version || 'unknown',
        postgisEnabled: Boolean(postgis.rows[0]?.enabled)
      },
      migrations: {
        schemaMigrationsTableExists: migrationsTableExists,
        expected: EXPECTED_MIGRATIONS,
        applied: applied.rows.map((row) => row.filename),
        missing: EXPECTED_MIGRATIONS.filter((filename) => !applied.rows.some((row) => row.filename === filename))
      },
      tables,
      ownershipChecks,
      identityChecks,
      tableCounts
    };

    const hasMissingTable = tables.some((item) => !item.exists);
    const hasOwnershipGap = ownershipChecks.some((item) => item.count > 0);
    const hasIdentityGap = identityChecks.some((item) => item.count > 0);
    if (hasMissingTable || hasOwnershipGap || hasIdentityGap || !report.database.postgisEnabled) {
      report.ok = false;
    }

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    try {
      await client('ROLLBACK');
    } catch {
      // ignored
    }
    throw error;
  } finally {
    activeClient.release();
    await pool.end();
    await postgres.closePool();
  }
}

main().catch(async (error) => {
  console.error(`[production-db-preflight] ${error.message}`);
  await postgres.closePool();
  process.exit(1);
});
