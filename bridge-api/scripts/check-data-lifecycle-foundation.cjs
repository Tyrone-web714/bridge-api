const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[data-lifecycle] ${message}`);
}

function assertContains(content, pattern, message) {
  assert(content.includes(pattern), `${message}: missing ${pattern}`);
}

const migration = read('migrations/009_data_lifecycle_foundation.sql');
const service = read('services/dataLifecycle.js');
const routes = read('routes/dataLifecycle.js');
const rbac = read('services/rbac.js');
const auth = read('middleware/authorization.js');
const driverAuthRoutes = read('routes/driverSessions.js');
const repositories = read('db/repositories.js');
const server = read('server.js');
const packageJson = JSON.parse(read('package.json'));
const docsDir = path.join(repoRoot, 'docs', 'implementation', 'data-lifecycle-foundation');

[
  'CREATE TABLE IF NOT EXISTS retention_policies',
  'CREATE TABLE IF NOT EXISTS legal_holds',
  'CREATE TABLE IF NOT EXISTS lifecycle_deletion_requests',
  'CREATE TABLE IF NOT EXISTS data_subject_requests',
  'CREATE TABLE IF NOT EXISTS organization_lifecycle_events',
  'CREATE TABLE IF NOT EXISTS lifecycle_object_references',
  'CREATE TABLE IF NOT EXISTS lifecycle_purge_jobs',
  'CREATE TABLE IF NOT EXISTS lifecycle_tombstones',
  'CREATE TABLE IF NOT EXISTS data_exports',
  'CREATE TABLE IF NOT EXISTS lifecycle_events',
  'organizations_lifecycle_status_check',
  'admin_users_lifecycle_status_check',
  'drivers_lifecycle_status_check',
  'warehouse_employees_lifecycle_status_check',
  'prevent_audit_events_delete_without_lifecycle_override',
  'ON DELETE RESTRICT'
].forEach((pattern) => assertContains(migration, pattern, 'migration contract'));

[
  "LIFECYCLE_USER_DEACTIVATE: 'lifecycle.user.deactivate'",
  "LIFECYCLE_USER_REACTIVATE: 'lifecycle.user.reactivate'",
  "LIFECYCLE_USER_REQUEST_DELETE: 'lifecycle.user.request_delete'",
  "LIFECYCLE_USER_REVIEW_DELETE: 'lifecycle.user.review_delete'",
  "LIFECYCLE_USER_PURGE: 'lifecycle.user.purge'",
  "LIFECYCLE_ORGANIZATION_TERMINATE: 'lifecycle.organization.terminate'",
  "LIFECYCLE_LEGAL_HOLD_MANAGE: 'lifecycle.legal_hold.manage'",
  "LIFECYCLE_DSR_MANAGE: 'lifecycle.dsr.manage'",
  "PLATFORM_LIFECYCLE_SUPPORT: 'platform.lifecycle.support'"
].forEach((pattern) => assertContains(rbac, pattern, 'RBAC permissions'));

[
  'deactivateUser',
  'reactivateUser',
  'requestUserDeletion',
  'cancelDeletionRequest',
  'previewUserPurgeImpact',
  'anonymizeUser',
  'applyLegalHold',
  'releaseLegalHold',
  'requestOrganizationTermination',
  'previewOrganizationPurgeImpact',
  'submitDataSubjectRequest',
  'reviewDataSubjectRequest',
  'createDataExportRequest',
  'executeEphemeralPurge',
  'POLICY_DECISION_REQUIRED',
  'hasActiveLegalHold'
].forEach((pattern) => assertContains(service, pattern, 'service contract'));

assert(!/DROP TABLE\s+(?!IF EXISTS schema_migrations)/i.test(migration), 'migration must not drop lifecycle-relevant tables.');
assert(!/DELETE FROM\s+(daily_route|audit_events|kpi_snapshots|logistics_|fleet_score_|shared_safety_records)/i.test(service), 'service must not hard-delete historically significant records.');
assert(!/\beval\s*\(/.test(service), 'service must not use eval().');
assert(!/new Function\s*\(/.test(service), 'service must not use new Function().');

[
  "router.post('/users/deactivate'",
  "router.post('/users/reactivate'",
  "router.post('/users/deletion-requests'",
  "router.post('/users/purge-preview'",
  "router.post('/users/anonymize'",
  "router.post('/legal-holds'",
  "router.post('/organizations/termination-requests'",
  "router.post('/organizations/purge-preview'",
  "router.post('/exports'",
  "router.post('/data-subject-requests'",
  "router.post('/purge/ephemeral-preview'",
  "router.post('/purge/ephemeral-execute'",
  'requireAdminCsrfIfCookie',
  'requireJsonMutation'
].forEach((pattern) => assertContains(routes, pattern, 'route contract'));

assertContains(auth, "path.startsWith('/api/data-lifecycle')", 'private-by-default lifecycle mapping');
assertContains(server, "const dataLifecycleRoutes = require('./routes/dataLifecycle')", 'server route import');
assertContains(server, "app.use('/api/data-lifecycle', dataLifecycleRoutes)", 'server route mount');
assertContains(driverAuthRoutes, "driver.lifecycle_status", 'driver login lifecycle state check');
assertContains(repositories, "COALESCE(driver.lifecycle_status, 'ACTIVE') = 'ACTIVE'", 'driver session lifecycle state check');
assertContains(repositories, "COALESCE(org.lifecycle_status, 'ACTIVE') = 'ACTIVE'", 'organization lifecycle state check');
assertContains(packageJson.scripts.test, 'test:data-lifecycle', 'full test suite must include lifecycle contracts');
assert(packageJson.scripts['validate:data-lifecycle'], 'runtime lifecycle validation script must be defined.');

const requiredDocs = [
  'README.md',
  'CURRENT_DATA_LIFECYCLE_AUDIT.md',
  'IMPLEMENTED_CASCADE_MAP.md',
  'DATA_CLASSIFICATION.md',
  'USER_LIFECYCLE.md',
  'USER_DELETION_WORKFLOW.md',
  'RETENTION_POLICY_ENGINE.md',
  'LEGAL_HOLD_IMPLEMENTATION.md',
  'ORGANIZATION_TERMINATION.md',
  'DATA_EXIT_EXPORT.md',
  'DATA_SUBJECT_REQUESTS.md',
  'HISTORICAL_PRESERVATION.md',
  'AUDIT_IMMUTABILITY.md',
  'SHARED_SAFETY_LIFECYCLE.md',
  'OFFLINE_DEACTIVATION_SECURITY.md',
  'OBJECT_STORAGE_LIFECYCLE.md',
  'BACKUP_RESTORE_IMPLICATIONS.md',
  'API_AND_PERMISSIONS.md',
  'DATABASE_MIGRATION.md',
  'TEST_RESULTS.md',
  'ROLLBACK_PROCEDURE.md',
  'POLICY_DECISIONS_REQUIRED.md',
  'LEGAL_REVIEW_REQUIRED.md',
  'REMAINING_DATA_LIFECYCLE_WORK.md',
  'FINAL_VALIDATION_REPORT.md'
];
for (const file of requiredDocs) {
  assert(fs.existsSync(path.join(docsDir, file)), `required implementation doc missing: ${file}`);
}

console.log('[test:data-lifecycle] foundation schema, service, route, permission, and documentation contracts verified.');
