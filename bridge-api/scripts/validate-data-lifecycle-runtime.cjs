require('dotenv').config();

const crypto = require('crypto');
const postgres = require('../db/postgres');
const dataLifecycle = require('../services/dataLifecycle');
const rbac = require('../services/rbac');
const { BOOTSTRAP_ORGANIZATION } = require('../services/tenantContext');

function assert(condition, message) {
  if (!condition) throw new Error(`[data-lifecycle-runtime] ${message}`);
}

function context(overrides = {}) {
  const role = overrides.approvedRole || rbac.ROLES.ORGANIZATION_ADMIN;
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: overrides.actorId || 'runtime-org-admin',
    organizationId: overrides.organizationId || BOOTSTRAP_ORGANIZATION.id,
    approvedRole: role,
    role,
    permissions: rbac.permissionsForRole(role),
    ...overrides
  };
}

async function seedOrganization(id, name) {
  await postgres.query(
    `INSERT INTO organizations (id, name, slug, status, lifecycle_status)
     VALUES ($1, $2, $1, 'active', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET status = 'active', lifecycle_status = 'ACTIVE', updated_at = NOW()`,
    [id, name]
  );
}

async function seedDriver(organizationId, driverId) {
  await postgres.query(
    `INSERT INTO drivers (
      driver_id, internal_driver_id, organization_id, company_driver_number, driver_name,
      active, lifecycle_status, created_at, updated_at
    ) VALUES ($1, $2, $3, $1, $4, true, 'ACTIVE', NOW(), NOW())
    ON CONFLICT (driver_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      driver_name = EXCLUDED.driver_name,
      active = true,
      lifecycle_status = 'ACTIVE',
      updated_at = NOW()`,
    [driverId, crypto.randomUUID(), organizationId, `Driver ${driverId}`]
  );
}

async function seedWarehouseEmployee(organizationId, employeeId) {
  await postgres.query(
    `INSERT INTO warehouse_employees (
      employee_id, organization_id, company_employee_id, employee_name, pin_hash,
      active, lifecycle_status, created_at, updated_at
    ) VALUES ($1, $2, $1, $3, 'not-used', true, 'ACTIVE', NOW(), NOW())
    ON CONFLICT (employee_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      active = true,
      lifecycle_status = 'ACTIVE',
      updated_at = NOW()`,
    [employeeId, organizationId, `Warehouse ${employeeId}`]
  );
}

async function seedRouteHistory(organizationId, driverId, runId) {
  const manifestId = `${runId}-manifest`;
  const stopId = `${runId}-stop`;
  await postgres.query(
    `INSERT INTO daily_route_manifests (
      id, organization_id, route_date, route_number, assigned_driver_id, status
    ) VALUES ($1, $2, CURRENT_DATE, $3, $4, 'completed')
    ON CONFLICT (id) DO NOTHING`,
    [manifestId, organizationId, `${runId}-route`, driverId]
  );
  await postgres.query(
    `INSERT INTO daily_route_stops (
      id, organization_id, manifest_id, stop_sequence, destination_address, status
    ) VALUES ($1, $2, $3, 1, '100 Runtime St', 'completed')
    ON CONFLICT (id) DO NOTHING`,
    [stopId, organizationId, manifestId]
  );
  await postgres.query(
    `INSERT INTO delivery_settlements (
      id, organization_id, route_stop_id, driver_id, status, planned_quantity, delivered_quantity
    ) VALUES ($1, $2, $3, $4, 'completed', 1, 1)
    ON CONFLICT (id) DO NOTHING`,
    [`${runId}-settlement`, organizationId, stopId, driverId]
  );
  await postgres.query(
    `INSERT INTO audit_events (
      request_id, actor_type, actor_id, organization_id, method, path, status_code, event_type, outcome
    ) VALUES ($1, 'driver', $2, $3, 'POST', '/runtime/data-lifecycle', 200, 'runtime_seed', 'success')`,
    [runId, driverId, organizationId]
  );
}

async function sessionCount(driverId) {
  const result = await postgres.query(
    'SELECT COUNT(*)::int AS count FROM driver_sessions WHERE driver_id = $1 AND revoked_at IS NULL',
    [driverId]
  );
  return Number(result.rows[0]?.count) || 0;
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert(/127\.0\.0\.1:5544\d/.test(process.env.DATABASE_URL), 'runtime validation must use isolated local PostgreSQL on a 5544x validation port');

  const runId = `lifecycle-${Date.now()}`;
  const orgA = 'demo-lifecycle-a';
  const orgB = 'demo-lifecycle-b';
  const driverA = `${runId}-driver-a`;
  const driverB = `${runId}-driver-b`;
  const warehouseA = `${runId}-wh-a`;

  await seedOrganization(orgA, 'Demo Lifecycle A');
  await seedOrganization(orgB, 'Demo Lifecycle B');
  await seedDriver(orgA, driverA);
  await seedDriver(orgB, driverB);
  await seedWarehouseEmployee(orgA, warehouseA);
  await seedRouteHistory(orgA, driverA, runId);

  await postgres.query(
    `INSERT INTO driver_sessions (id, driver_id, organization_id, internal_driver_id, device_id, token_hash, expires_at)
     SELECT $1, driver_id, organization_id, internal_driver_id, 'runtime-device', $2, NOW() + INTERVAL '1 hour'
     FROM drivers WHERE driver_id = $3`,
    [crypto.randomUUID(), `${runId}-token`, driverA]
  );
  assert(await sessionCount(driverA) === 1, 'driver session seed failed');

  const orgAdminA = context({ organizationId: orgA, actorId: 'lifecycle-org-a-admin' });
  const orgAdminB = context({ organizationId: orgB, actorId: 'lifecycle-org-b-admin' });
  const platformAdmin = context({ organizationId: null, actorId: 'lifecycle-platform-admin', approvedRole: rbac.ROLES.PLATFORM_ADMIN });
  const supervisor = context({ organizationId: orgA, actorId: 'lifecycle-supervisor', approvedRole: rbac.ROLES.SUPERVISOR });

  const preview = await dataLifecycle.previewUserPurgeImpact(orgAdminA, {
    organizationId: orgA,
    subjectType: 'DRIVER',
    subjectId: driverA
  });
  assert(preview.dryRun === true, 'purge preview must be dry-run');
  assert(preview.recordsToRetain.some((item) => item.table === 'daily_route_manifests' && item.count >= 1), 'route history must be retained in preview');
  assert(preview.sharedSafetyGlobalRecordsPreserved === true, 'Shared Safety global preservation must be explicit');

  const deactivated = await dataLifecycle.deactivateUser(orgAdminA, {
    organizationId: orgA,
    subjectType: 'DRIVER',
    subjectId: driverA,
    reason: 'runtime validation'
  });
  assert(deactivated.lifecycleStatus === 'DEACTIVATED', 'driver lifecycle status must become deactivated');
  assert(await sessionCount(driverA) === 0, 'deactivation must revoke active driver sessions');

  const retained = await postgres.query('SELECT COUNT(*)::int AS count FROM daily_route_manifests WHERE assigned_driver_id = $1', [driverA]);
  assert(Number(retained.rows[0].count) === 1, 'deactivation must not delete route history');

  const deletion = await dataLifecycle.requestUserDeletion(orgAdminA, {
    organizationId: orgA,
    subjectType: 'WAREHOUSE_EMPLOYEE',
    subjectId: warehouseA,
    reason: 'runtime deletion request'
  });
  assert(deletion.deletionRequest.recovery_window_days === 30, 'account recovery window default must be 30 days');

  const hold = await dataLifecycle.applyLegalHold(platformAdmin, {
    organizationId: orgA,
    scopeType: 'DRIVER',
    scopeId: driverA,
    reason: 'runtime legal hold'
  });
  assert(hold.legalHold.status === 'ACTIVE', 'legal hold must be active');
  const blockedPreview = await dataLifecycle.previewUserPurgeImpact(orgAdminA, {
    organizationId: orgA,
    subjectType: 'DRIVER',
    subjectId: driverA
  });
  assert(blockedPreview.blockedByLegalHold === true, 'legal hold must block purge preview delete/anonymize actions');

  let tenantBlocked = false;
  try {
    await dataLifecycle.deactivateUser(orgAdminB, {
      organizationId: orgA,
      subjectType: 'DRIVER',
      subjectId: driverA
    });
  } catch (error) {
    tenantBlocked = error.code === 'TENANT_ISOLATION_VIOLATION' || error.status === 403;
  }
  assert(tenantBlocked, 'cross-tenant lifecycle action must be blocked');

  let supervisorBlocked = false;
  try {
    await dataLifecycle.deactivateUser(supervisor, {
      organizationId: orgA,
      subjectType: 'DRIVER',
      subjectId: driverA
    });
  } catch (error) {
    supervisorBlocked = error.status === 403;
  }
  assert(supervisorBlocked, 'supervisor must not receive destructive lifecycle authority by default');

  const orgTermination = await dataLifecycle.requestOrganizationTermination(platformAdmin, {
    organizationId: orgA,
    reason: 'runtime termination preview'
  });
  assert(orgTermination.organization.lifecycle_status === 'TERMINATION_REQUESTED', 'organization termination must be staged');
  const orgPreview = await dataLifecycle.previewOrganizationPurgeImpact(platformAdmin, { organizationId: orgA });
  assert(orgPreview.dryRun === true && orgPreview.recordsToRetain.length > 0, 'organization purge preview must be non-destructive and retain history');

  const dsr = await dataLifecycle.submitDataSubjectRequest(orgAdminA, {
    organizationId: orgA,
    requestType: 'ACCESS',
    subjectType: 'DRIVER',
    subjectId: driverA,
    reason: 'runtime access request'
  });
  assert(dsr.dataSubjectRequest.status === 'SUBMITTED', 'DSR should be recorded');

  const exportRequest = await dataLifecycle.createDataExportRequest(platformAdmin, {
    organizationId: orgA,
    exportType: 'organization_data_exit'
  });
  assert(exportRequest.dataExport.manifest.format === 'OWNER_DECISION_REQUIRED', 'export format must remain owner decision');

  let unpreviewedPurgeBlocked = false;
  try {
    await dataLifecycle.executeEphemeralPurge(platformAdmin, { organizationId: orgA });
  } catch (error) {
    unpreviewedPurgeBlocked = error.code === 'PURGE_PREVIEW_REQUIRED';
  }
  assert(unpreviewedPurgeBlocked, 'ephemeral purge execution must require a preview-linked purge job');

  await dataLifecycle.releaseLegalHold(platformAdmin, hold.legalHold.id, 'runtime release before ephemeral purge');
  const purgePreview = await dataLifecycle.previewEphemeralPurge(platformAdmin, { organizationId: orgA });
  assert(purgePreview.purgeJobId, 'ephemeral purge preview must create a purge job');
  const purgeExecution = await dataLifecycle.executeEphemeralPurge(platformAdmin, {
    organizationId: orgA,
    previewJobId: purgePreview.purgeJobId
  });
  assert(purgeExecution.purgeJobId === purgePreview.purgeJobId, 'ephemeral purge execution must link to preview job');

  let auditImmutable = false;
  try {
    await postgres.query('DELETE FROM audit_events WHERE request_id = $1', [runId]);
  } catch {
    auditImmutable = true;
  }
  assert(auditImmutable, 'audit event deletion must be blocked by lifecycle trigger');

  console.log('[data-lifecycle-runtime] isolated database lifecycle checks passed');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
