const assert = require('assert');
const crypto = require('crypto');

const adminAuth = require('../services/adminAuth');
const authorization = require('../middleware/authorization');
const postgres = require('../db/postgres');
const repositories = require('../db/repositories');
const rbac = require('../services/rbac');
const warehouseAuth = require('../services/warehouseAuth');

const ORG_A = '10000000-0000-4000-8000-0000000000aa';
const ORG_B = '10000000-0000-4000-8000-0000000000bb';

function assertResponseStatus(middleware, req, expectedStatus) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.strictEqual(res.statusCode, expectedStatus);
  return nextCalled;
}

async function seedOrganizations() {
  await postgres.rawQuery(`
    INSERT INTO organizations (id, name, slug, status)
    VALUES
      ($1, 'Auth Validation Org A', 'auth-validation-org-a', 'active'),
      ($2, 'Auth Validation Org B', 'auth-validation-org-b', 'active')
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `, [ORG_A, ORG_B]);
}

async function validateSchema() {
  const result = await postgres.rawQuery(`
    SELECT
      to_regclass('role_permissions') IS NOT NULL AS has_role_permissions,
      to_regclass('warehouse_employee_sessions') IS NOT NULL AS has_warehouse_sessions,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_users' AND column_name = 'approved_role'
      ) AS has_approved_role,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_events' AND column_name = 'organization_id'
      ) AS has_audit_organization,
      EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_approved_role_check'
      ) AS has_admin_role_constraint,
      EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_check'
      ) AS has_role_permission_constraint,
      (SELECT COUNT(*)::int FROM role_permissions) AS role_permission_count
  `);
  const row = result.rows[0];
  assert.strictEqual(row.has_role_permissions, true);
  assert.strictEqual(row.has_warehouse_sessions, true);
  assert.strictEqual(row.has_approved_role, true);
  assert.strictEqual(row.has_audit_organization, true);
  assert.strictEqual(row.has_admin_role_constraint, true);
  assert.strictEqual(row.has_role_permission_constraint, true);
  assert(row.role_permission_count >= 60, 'Default role permission mappings should be seeded');
}

async function validateAdminTenantIsolation() {
  await repositories.upsertAdminUser({
    username: 'auth-org-a-admin',
    organizationId: ORG_A,
    passwordHash: adminAuth.hashPassword('validation-password-a'),
    role: 'regional_admin',
    approvedRole: rbac.ROLES.ORGANIZATION_ADMIN,
    active: true
  });
  await repositories.upsertAdminUser({
    username: 'auth-org-b-admin',
    organizationId: ORG_B,
    passwordHash: adminAuth.hashPassword('validation-password-b'),
    role: 'regional_admin',
    approvedRole: rbac.ROLES.ORGANIZATION_ADMIN,
    active: true
  });

  const orgAUsers = await repositories.listAdminUsers({ organizationId: ORG_A });
  assert(orgAUsers.some((user) => user.username === 'auth-org-a-admin'));
  assert(!orgAUsers.some((user) => user.username === 'auth-org-b-admin'));

  assert.throws(
    () => rbac.assertApprovedRole('dispatcher'),
    /Unsupported role/
  );
  assert(!rbac.hasPermission({ approvedRole: rbac.ROLES.ORGANIZATION_ADMIN }, rbac.PERMISSIONS.PLATFORM_CONFIGURE));
  assert(!rbac.hasPermission({ approvedRole: rbac.ROLES.SUPERVISOR }, rbac.PERMISSIONS.BILLING_MANAGE));
  assert(!rbac.hasPermission({ approvedRole: rbac.ROLES.WAREHOUSE_EMPLOYEE }, rbac.PERMISSIONS.USERS_MANAGE));

  const orgAdminReq = {
    adminSession: {
      username: 'auth-org-a-admin',
      role: 'regional_admin',
      approvedRole: rbac.ROLES.ORGANIZATION_ADMIN,
      organizationId: ORG_A,
      permissions: rbac.permissionsForRole(rbac.ROLES.ORGANIZATION_ADMIN)
    }
  };
  assert.strictEqual(assertResponseStatus(authorization.requirePlatformAdmin, orgAdminReq, 403), false);
}

async function validateDriverTenantIsolation() {
  const driverA = await repositories.upsertDriver({
    organizationId: ORG_A,
    companyDriverNumber: '827826',
    driverName: 'Validation Driver A',
    active: true
  }, 'validation');
  const driverB = await repositories.upsertDriver({
    organizationId: ORG_B,
    companyDriverNumber: '827826',
    driverName: 'Validation Driver B',
    active: true
  }, 'validation');

  assert.notStrictEqual(driverA.legacyDriverId, driverB.legacyDriverId);
  assert.strictEqual(driverA.companyDriverNumber, driverB.companyDriverNumber);
  assert.strictEqual((await repositories.listDrivers({ organizationId: ORG_A })).some((driver) => driver.legacyDriverId === driverB.legacyDriverId), false);
  assert.strictEqual((await repositories.getDriver(driverB.legacyDriverId, { organizationId: ORG_A })), null);

  const tokenHash = crypto.createHash('sha256').update(`auth-validation-driver-token-${crypto.randomUUID()}`).digest('hex');
  const session = await repositories.createDriverSession({
    id: crypto.randomUUID(),
    driverId: driverA.companyDriverNumber,
    organizationId: ORG_A,
    internalDriverId: driverA.internalDriverId,
    deviceId: 'validation-device',
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  assert(session);
  const activeSession = await repositories.getActiveDriverSession(tokenHash);
  assert.strictEqual(activeSession.company_driver_number, '827826');
  assert.strictEqual(activeSession.organization_id, ORG_A);
  assert(await repositories.revokeDriverSession(tokenHash));
  assert.strictEqual(await repositories.getActiveDriverSession(tokenHash), null);
}

async function validateRouteManifestIsolation() {
  await repositories.upsertDailyRouteManifest({
    id: 'auth-validation-route-a',
    organizationId: ORG_A,
    routeDate: '2026-07-11',
    routeNumber: 'AUTH-A',
    routeName: 'Auth Validation A',
    totalStops: 0,
    status: 'unassigned'
  });
  await repositories.upsertDailyRouteManifest({
    id: 'auth-validation-route-b',
    organizationId: ORG_B,
    routeDate: '2026-07-11',
    routeNumber: 'AUTH-B',
    routeName: 'Auth Validation B',
    totalStops: 0,
    status: 'unassigned'
  });

  assert(await repositories.getDailyRouteManifest('auth-validation-route-a', { organizationId: ORG_A }));
  assert.strictEqual(await repositories.getDailyRouteManifest('auth-validation-route-b', { organizationId: ORG_A }), null);
  const orgARoutes = await repositories.listDailyRouteManifests({ organizationId: ORG_A, routeDate: '2026-07-11' });
  assert(orgARoutes.some((route) => route.id === 'auth-validation-route-a'));
  assert(!orgARoutes.some((route) => route.id === 'auth-validation-route-b'));
}

async function validateWarehouseAuth() {
  const pin = '864209';
  const employee = await repositories.upsertWarehouseEmployee({
    organizationId: ORG_A,
    employeeId: 'WH-AUTH-1',
    employeeName: 'Warehouse Validation',
    pinHash: adminAuth.hashPassword(pin),
    active: true
  });
  assert(employee);
  await assert.rejects(
    () => warehouseAuth.authenticateWarehouseEmployee('WH-AUTH-1', '', { organizationId: ORG_A }),
    /Warehouse employee ID and PIN are required/
  );
  await assert.rejects(
    () => warehouseAuth.authenticateWarehouseEmployee('WH-AUTH-1', 'bad-pin', { organizationId: ORG_A }),
    /Warehouse employee ID or PIN is invalid/
  );
  const authenticated = await warehouseAuth.authenticateWarehouseEmployee('WH-AUTH-1', pin, { organizationId: ORG_A });
  assert.strictEqual(authenticated.organization_id, ORG_A);
  assert.strictEqual(authenticated.approvedRole, rbac.ROLES.WAREHOUSE_EMPLOYEE);

  const warehouseSession = await warehouseAuth.createWarehouseSession(authenticated, { sessionMs: 60 * 60 * 1000 });
  assert(warehouseSession.token);
  const activeSession = await repositories.getActiveWarehouseEmployeeSession(warehouseAuth.hashSessionToken(warehouseSession.token));
  assert.strictEqual(activeSession.organization_id, ORG_A);
}

async function validateAuthorizationRefresh() {
  const req = {
    driverAuth: {
      driverId: '827826',
      internalDriverId: 'driver-internal-validation',
      organizationId: ORG_A,
      driverName: 'Validation Driver',
      approvedRole: rbac.ROLES.DRIVER,
      permissions: rbac.permissionsForRole(rbac.ROLES.DRIVER)
    }
  };
  assert.strictEqual(assertResponseStatus(authorization.requirePermission(rbac.PERMISSIONS.DELIVERY_OPERATE), req, 200), true);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for final validation.');
  }

  await postgres.ensureSchema();
  await seedOrganizations();
  await validateSchema();
  await validateAdminTenantIsolation();
  await validateDriverTenantIsolation();
  await validateRouteManifestIsolation();
  await validateWarehouseAuth();
  await validateAuthorizationRefresh();
  await postgres.closePool();
  console.log('Final Authentication/RBAC validation passed');
}

main().catch(async (error) => {
  await postgres.closePool().catch(() => {});
  console.error(error);
  process.exit(1);
});
