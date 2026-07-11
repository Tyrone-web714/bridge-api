const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  BOOTSTRAP_ORGANIZATION,
  assertSameOrganization,
  createBootstrapDevelopmentTenantContext,
  createLegacyDriverStorageId,
  createTenantContext,
  resolveTenantContext,
  scopedCacheKey
} = require('../services/tenantContext');

const repoRoot = path.resolve(__dirname, '..');
const migrationPath = path.join(repoRoot, 'migrations', '003_multi_tenant_foundation.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

function assertContains(haystack, needle, label) {
  assert(
    haystack.includes(needle),
    `${label} missing expected text: ${needle}`
  );
}

function assertNotContains(haystack, needle, label) {
  assert(
    !haystack.includes(needle),
    `${label} should not contain: ${needle}`
  );
}

assert.strictEqual(BOOTSTRAP_ORGANIZATION.name, 'Truck-Safe Routing Development');
assert.strictEqual(BOOTSTRAP_ORGANIZATION.slug, 'truck-safe-routing-development');
assert.strictEqual(createBootstrapDevelopmentTenantContext().organizationId, BOOTSTRAP_ORGANIZATION.id);

assert.throws(
  () => createTenantContext({}),
  /organizationId is required/,
  'Organization-private tenant context should be required'
);

assert.strictEqual(
  resolveTenantContext({}, { allowDevelopmentFallback: true }).organizationId,
  BOOTSTRAP_ORGANIZATION.id
);

assert.strictEqual(assertSameOrganization('org-a', { organizationId: 'org-a' }), true);
assert.throws(
  () => assertSameOrganization({ organizationId: 'org-a' }, { organizationId: 'org-b' }),
  /Cross-Organization access/,
  'Cross-Organization access should be blocked'
);

const cacheA = scopedCacheKey({ organizationId: 'demo-fleet-a' }, ['routes', 'today']);
const cacheB = scopedCacheKey({ organizationId: 'demo-fleet-b' }, ['routes', 'today']);
assert.notStrictEqual(cacheA, cacheB, 'Cache keys must include Organization scope');

const bootstrapStorageId = createLegacyDriverStorageId(BOOTSTRAP_ORGANIZATION.id, '827826');
assert.strictEqual(
  bootstrapStorageId,
  '827826',
  'Bootstrap compatibility must preserve company driver number as the legacy driver_id'
);
assert.notStrictEqual(
  createLegacyDriverStorageId('demo-fleet-a', '827826'),
  createLegacyDriverStorageId('demo-fleet-b', '827826'),
  'Different Organizations may reuse the same company driver number with distinct storage ids'
);
assert.strictEqual(
  createLegacyDriverStorageId('demo-fleet-a', '827826'),
  createLegacyDriverStorageId('demo-fleet-a', '827826'),
  'The same Organization and company driver number must resolve consistently'
);

assertContains(migrationSql, 'CREATE TABLE IF NOT EXISTS organizations', 'Organization migration');
assertContains(migrationSql, 'Truck-Safe Routing Development', 'Bootstrap Organization migration');
assertContains(migrationSql, 'CREATE TABLE IF NOT EXISTS tenant_backfill_exceptions', 'Backfill exception migration');
assertContains(migrationSql, 'ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id)', 'Tenant ownership migration');
assertContains(migrationSql, 'ADD COLUMN IF NOT EXISTS internal_driver_id TEXT', 'Driver internal ID migration');
assertContains(migrationSql, 'ADD COLUMN IF NOT EXISTS company_driver_number TEXT', 'Company driver number migration');
assertContains(
  migrationSql,
  'ON drivers(organization_id, LOWER(company_driver_number))',
  'Driver Organization-scoped uniqueness migration'
);

for (const tableName of [
  'low_clearance_bridges',
  'truck_restricted_zones',
  'static_hazard_location_backfill_queue'
]) {
  assertNotContains(
    migrationSql,
    `ALTER TABLE ${tableName}\n  ADD COLUMN IF NOT EXISTS organization_id`,
    `${tableName} must remain platform-global or operationally separate in this phase`
  );
}

for (const realCompanyName of [
  'Arca Continental',
  'Sysco',
  'Sigma'
]) {
  assertNotContains(
    migrationSql,
    realCompanyName,
    'Migration must not create real customer Organizations'
  );
}

console.log('Multi-tenant foundation checks passed.');
