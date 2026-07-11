const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rbac = require('../services/rbac');
const authorization = require('../middleware/authorization');

const repoRoot = path.resolve(__dirname, '..');
const migrationSql = fs.readFileSync(path.join(repoRoot, 'migrations', '004_authentication_rbac_foundation.sql'), 'utf8');
const driverAuthSource = fs.readFileSync(path.join(repoRoot, 'services', 'driverAuth.js'), 'utf8');
const adminAuthSource = fs.readFileSync(path.join(repoRoot, 'services', 'adminAuth.js'), 'utf8');
const warehouseAuthSource = fs.readFileSync(path.join(repoRoot, 'services', 'warehouseAuth.js'), 'utf8');
const routeManifestSource = fs.readFileSync(path.join(repoRoot, 'routes', 'routeManifests.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8');

function assertContains(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} missing expected text: ${needle}`);
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

assert.deepStrictEqual(Object.keys(rbac.ROLES).sort(), [
  'DRIVER',
  'ORGANIZATION_ADMIN',
  'PLATFORM_ADMIN',
  'SUPERVISOR',
  'WAREHOUSE_EMPLOYEE'
]);
assert.strictEqual(rbac.normalizeRole('admin'), rbac.ROLES.PLATFORM_ADMIN);
assert.strictEqual(rbac.normalizeRole('regional_admin'), rbac.ROLES.ORGANIZATION_ADMIN);
assert.strictEqual(rbac.normalizeRole('warehouse employee'), rbac.ROLES.WAREHOUSE_EMPLOYEE);
assert.throws(() => rbac.assertApprovedRole('dispatcher'), /Unsupported role/);
assert(rbac.hasPermission({ approvedRole: rbac.ROLES.DRIVER }, rbac.PERMISSIONS.DELIVERY_OPERATE));
assert(!rbac.hasPermission({ approvedRole: rbac.ROLES.DRIVER }, rbac.PERMISSIONS.USERS_MANAGE));

{
  const req = {};
  const res = createMockResponse();
  let called = false;
  authorization.requirePermission(rbac.PERMISSIONS.USERS_MANAGE)(req, res, () => {
    called = true;
  });
  assert.strictEqual(called, false, 'Unauthenticated permission checks must deny by default');
  assert.strictEqual(res.statusCode, 401);
}

{
  const req = {
    adminSession: {
      username: 'supervisor',
      role: 'supervisor',
      approvedRole: rbac.ROLES.SUPERVISOR,
      organizationId: 'org-a',
      permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR)
    }
  };
  authorization.attachAuthContext(req, createMockResponse(), () => {});
  assert.strictEqual(req.authContext.organizationId, 'org-a');
  assert.strictEqual(req.authContext.approvedRole, rbac.ROLES.SUPERVISOR);
}

assertContains(migrationSql, 'CREATE TABLE IF NOT EXISTS role_permissions', 'RBAC migration');
assertContains(migrationSql, 'CREATE TABLE IF NOT EXISTS warehouse_employee_sessions', 'Warehouse session migration');
assertContains(migrationSql, 'ADD COLUMN IF NOT EXISTS approved_role TEXT', 'Admin approved role migration');
assertContains(migrationSql, 'ADD COLUMN IF NOT EXISTS organization_id TEXT', 'Audit organization migration');
assertContains(migrationSql, 'revoked_reason', 'Session revocation migration');

assertContains(adminAuthSource, 'approvedRole', 'Admin auth claims');
assertContains(adminAuthSource, 'permissionsForRole', 'Admin permissions');
assertContains(driverAuthSource, 'organizationId: session.organization_id', 'Driver organization claim');
assertContains(driverAuthSource, 'internalDriverId: session.internal_driver_id', 'Driver internal identity claim');
assertContains(driverAuthSource, 'companyDriverNumber', 'Driver company number compatibility');
assertContains(warehouseAuthSource, 'Warehouse employee ID and PIN are required.', 'Warehouse two-factor requirement');
assertContains(warehouseAuthSource, 'requireWarehouseAuth', 'Warehouse session middleware');
assertContains(routeManifestSource, 'warehouseAuth.authenticateWarehouseEmployee', 'Route manifest warehouse auth service');
assertContains(routeManifestSource, 'warehouseEmployeePin', 'Warehouse employee PIN management');
assertContains(serverSource, "app.use('/api', authorization.attachAuthContext);", 'Authorization context middleware');

console.log('Auth/RBAC foundation checks passed');
