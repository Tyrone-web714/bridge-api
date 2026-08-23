const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const APPROVED_MIGRATION_SEQUENCE = Object.freeze([
  '001_audit_events.sql',
  '002_driver_sessions.sql',
  '003_multi_tenant_foundation.sql',
  '004_authentication_rbac_foundation.sql',
  '005_shared_safety_foundation.sql',
  '006_bi_kpi_foundation.sql',
  '007_logistics_intelligence_foundation.sql',
  '008_fleet_intelligence_scoring_foundation.sql',
  '009_data_lifecycle_foundation.sql',
  '010_enterprise_identity_foundation.sql',
  '011_driver_copilot_permission_repair.sql',
  '012_intelligence_execution_foundation.sql'
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[production-rollout] ${message}`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function existsRepo(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function listMigrationFiles() {
  return fs.readdirSync(path.join(root, 'migrations'))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort();
}

function validateMigrationFileSequence(actual, expected = APPROVED_MIGRATION_SEQUENCE) {
  const errors = [];
  const seen = new Set();
  for (const name of actual) {
    if (seen.has(name)) errors.push(`duplicate migration detected: ${name}`);
    seen.add(name);
  }

  const actualNumbers = actual.map((name) => Number.parseInt(name.slice(0, 3), 10));
  for (let index = 0; index < actualNumbers.length; index += 1) {
    const current = actualNumbers[index];
    if (!Number.isInteger(current)) errors.push(`invalid migration number: ${actual[index]}`);
    if (index > 0 && current <= actualNumbers[index - 1]) {
      errors.push(`migration sequence is out of order near ${actual[index]}`);
    }
    if (index > 0 && current !== actualNumbers[index - 1] + 1) {
      errors.push(`migration numbering gap before ${actual[index]}`);
    }
  }

  for (const name of expected) {
    if (!seen.has(name)) errors.push(`missing approved migration: ${name}`);
  }
  const approved = new Set(expected);
  for (const name of actual) {
    if (!approved.has(name)) errors.push(`unapproved migration file: ${name}`);
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`migration files must match approved sequence ${expected[0]} through ${expected[expected.length - 1]}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateMigrations() {
  const actual = listMigrationFiles();
  const sequence = validateMigrationFileSequence(actual);
  assert(sequence.valid, sequence.errors.join('; '));

  const migrationRunner = read('scripts/run-migrations.cjs');
  assert(migrationRunner.includes('schema_migrations'), 'migration runner must record schema_migrations');
  assert(migrationRunner.includes('checksum'), 'migration runner must checksum applied migrations');

  const m003 = read('migrations/003_multi_tenant_foundation.sql');
  assert(m003.includes('organizations'), 'migration 003 must create organizations');
  assert(m003.includes('drivers_org_company_driver_number_unique_idx'), 'migration 003 must enforce org-scoped company driver number uniqueness');

  const m006 = read('migrations/006_bi_kpi_foundation.sql');
  assert(m006.includes('prevent_kpi_snapshot_mutation'), 'migration 006 must protect KPI snapshot immutability');

  const m007 = read('migrations/007_logistics_intelligence_foundation.sql');
  assert(m007.includes('logistics_recommendations'), 'migration 007 must create Logistics recommendations');
  assert(m007.includes('ON DELETE RESTRICT'), 'migration 007 must avoid destructive recommendation cascades');

  const m008 = read('migrations/008_fleet_intelligence_scoring_foundation.sql');
  assert(m008.includes('prevent_fleet_score_snapshot_mutation'), 'migration 008 must protect FISS snapshot immutability');

  const m009 = read('migrations/009_data_lifecycle_foundation.sql');
  assert(m009.includes('CREATE TABLE IF NOT EXISTS legal_holds'), 'migration 009 must create legal holds');
  assert(m009.includes('CREATE TABLE IF NOT EXISTS lifecycle_deletion_requests'), 'migration 009 must create deletion requests');
  assert(m009.includes('prevent_audit_events_delete_without_lifecycle_override'), 'migration 009 must protect audit evidence');

  const m010 = read('migrations/010_enterprise_identity_foundation.sql');
  assert(m010.includes('CREATE TABLE IF NOT EXISTS organization_identity_providers'), 'migration 010 must create tenant IdP configuration');
  assert(m010.includes('CREATE TABLE IF NOT EXISTS federated_identities'), 'migration 010 must create federated identity mapping');
  assert(m010.includes('CREATE TABLE IF NOT EXISTS sso_authentication_transactions'), 'migration 010 must create SSO transactions');
  assert(m010.includes('ON DELETE RESTRICT'), 'migration 010 must avoid destructive identity cascades into Organization-owned history');

  const m011 = read('migrations/011_driver_copilot_permission_repair.sql');
  assert(m011.includes("'DRIVER', 'ai.driver_copilot.use'"), 'migration 011 must repair Driver Copilot role permissions');

  const m012 = read('migrations/012_intelligence_execution_foundation.sql');
  assert(m012.includes('CREATE TABLE IF NOT EXISTS intelligence_requests'), 'migration 012 must create Intelligence Execution requests');
  assert(m012.includes('CREATE TABLE IF NOT EXISTS intelligence_execution_attempts'), 'migration 012 must create Intelligence Execution attempts');
  assert(m012.includes('CREATE TABLE IF NOT EXISTS intelligence_usage_records'), 'migration 012 must create Intelligence Execution usage records');
  assert(m012.includes('CREATE TABLE IF NOT EXISTS intelligence_policy_versions'), 'migration 012 must create Intelligence Execution policy versions');
  assert(m012.includes('CREATE TABLE IF NOT EXISTS intelligence_prompt_versions'), 'migration 012 must create Intelligence Execution prompt versions');
}

function validateDeployment() {
  const render = read('render.yaml');
  assert(render.includes('truck-safe-routing-api'), 'render.yaml must target truck-safe-routing-api service');
  assert(render.includes('env: docker'), 'render.yaml must use Docker deployment');
  assert(render.includes('healthCheckPath: /health'), 'render.yaml must keep /health as Render health check');

  const dockerfile = read('Dockerfile');
  assert(dockerfile.includes('WORKDIR /app'), 'Dockerfile must set /app workdir');
  assert(dockerfile.includes('npm ci --omit=dev'), 'Dockerfile must install production dependencies only');
  assert(dockerfile.includes('CMD ["npm", "start"]'), 'Dockerfile must start through npm start');

  const server = read('server.js');
  assert(server.includes("app.get('/health'"), 'server must expose /health');
  assert(server.includes("app.get('/ready'"), 'server must expose /ready');
  assert(server.includes('databaseReachable'), '/ready must check database reachability');
  assert(server.includes('durablePhotoStorage'), '/ready must check durable photo storage');
  assert(server.includes('driverAuth'), '/ready must check driver authentication configuration');
}

function validateEnvironmentDocs() {
  const envExample = read('.env.example');
  const productionExample = read('.env.production.example');
  const deployment = read('DEPLOYMENT.md');
  const render = read('render.yaml');
  const required = [
    'GOOGLE_MAPS_API_KEY',
    'DATABASE_URL',
    'DATABASE_SSL',
    'ADMIN_DASHBOARD_PASSWORD',
    'ADMIN_DASHBOARD_SECRET',
    'CORS_ORIGIN',
    'PHOTO_STORAGE_PROVIDER',
    'PHOTO_STORAGE_BUCKET',
    'PHOTO_STORAGE_REGION',
    'PHOTO_STORAGE_PUBLIC_BASE_URL',
    'ALLOW_LEGACY_DRIVER_API_TOKEN'
  ];
  for (const key of required) {
    assert(envExample.includes(key), `.env.example must document ${key}`);
    assert(productionExample.includes(key), `.env.production.example must document ${key}`);
    assert(deployment.includes(key), `DEPLOYMENT.md must document ${key}`);
  }
  for (const key of ['GOOGLE_MAPS_API_KEY', 'DATABASE_URL', 'ADMIN_DASHBOARD_PASSWORD', 'ADMIN_DASHBOARD_SECRET']) {
    assert(render.includes(key), `render.yaml must declare ${key}`);
  }
  assert(productionExample.includes('ALLOW_LEGACY_DRIVER_API_TOKEN=false'), 'production example must disable legacy driver token fallback');
}

function validateDocs() {
  const docs = [
    'README.md',
    'CURRENT_PRODUCTION_ARCHITECTURE_AUDIT.md',
    'PRODUCTION_MIGRATION_INVENTORY.md',
    'MIGRATION_DEPENDENCY_GRAPH.md',
    'PRODUCTION_DATABASE_PREFLIGHT.md',
    'BACKUP_REQUIREMENTS.md',
    'BACKUP_RESTORE_REHEARSAL.md',
    'PRODUCTION_ROLLBACK_STRATEGY.md',
    'PRODUCTION_RELEASE_SEQUENCE.md',
    'PRODUCTION_ENVIRONMENT_INVENTORY.md',
    'DEPLOYMENT_CONFIGURATION_REVIEW.md',
    'HEALTH_AND_READINESS_CONTRACT.md',
    'POST_DEPLOYMENT_SMOKE_TEST_PLAN.md',
    'OBSERVABILITY_REQUIREMENTS.md',
    'PRODUCTION_RELEASE_GATES.md',
    'PRODUCTION_GO_NO_GO_MATRIX.md',
    'PRODUCTION_ROLLOUT_RUNBOOK.md',
    'REMAINING_PRODUCTION_RISKS.md',
    'ODR_019_020_IMPLEMENTATION_HANDOFF.md',
    'FINAL_PRODUCTION_ROLLOUT_PLANNING_REPORT.md',
    'FINAL_VALIDATION_REPORT.md'
  ];
  for (const doc of docs) {
    assert(existsRepo(path.join('docs', 'implementation', 'production-rollout-planning', doc)), `missing production rollout doc ${doc}`);
  }
}

function validateScripts() {
  const packageJson = JSON.parse(read('package.json'));
  assert(packageJson.scripts['validate:production-rollout'] === 'node scripts/validate-production-rollout.cjs', 'package script validate:production-rollout must be registered');
  assert(packageJson.scripts['production:db:preflight'] === 'node scripts/production-db-preflight.cjs', 'package script production:db:preflight must be registered');
  for (const script of [
    'validate:auth-rbac',
    'validate:shared-safety',
    'validate:bi-kpi',
    'validate:logistics-intelligence',
    'validate:fleet-intelligence-scoring',
    'validate:pilot-integration',
    'verify:production',
    'verify:secrets'
  ]) {
    assert(Boolean(packageJson.scripts[script]), `required validation script ${script} must be registered`);
  }
}

function runSecretAudit() {
  const result = spawnSync(process.execPath, ['scripts/audit-secrets.cjs'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert(result.status === 0, 'secret audit must pass');
}

function main() {
  validateMigrations();
  validateDeployment();
  validateEnvironmentDocs();
  validateDocs();
  validateScripts();
  runSecretAudit();
  console.log('[production-rollout] non-destructive rollout planning checks passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  APPROVED_MIGRATION_SEQUENCE,
  listMigrationFiles,
  validateMigrationFileSequence
};
