const crypto = require('crypto');
const postgres = require('../db/postgres');
const rbac = require('./rbac');
const { BOOTSTRAP_ORGANIZATION, assertSameOrganization } = require('./tenantContext');

const ACCOUNT_RECOVERY_DAYS = Math.min(
  Math.max(Number.parseInt(process.env.ACCOUNT_RECOVERY_DAYS, 10) || 30, 1),
  365
);

const USER_SUBJECTS = new Set(['ADMIN_USER', 'DRIVER', 'WAREHOUSE_EMPLOYEE']);
const USER_TABLES = Object.freeze({
  ADMIN_USER: {
    table: 'admin_users',
    idColumn: 'username',
    labelColumn: 'display_name',
    activeColumn: 'active',
    sessionTable: null,
    sessionUserColumn: null
  },
  DRIVER: {
    table: 'drivers',
    idColumn: 'driver_id',
    labelColumn: 'driver_name',
    activeColumn: 'active',
    sessionTable: 'driver_sessions',
    sessionUserColumn: 'driver_id'
  },
  WAREHOUSE_EMPLOYEE: {
    table: 'warehouse_employees',
    idColumn: 'employee_id',
    labelColumn: 'employee_name',
    activeColumn: 'active',
    sessionTable: 'warehouse_employee_sessions',
    sessionUserColumn: 'employee_id'
  }
});

const HISTORICAL_TABLES = Object.freeze([
  'daily_route_manifests',
  'daily_route_stops',
  'delivery_settlements',
  'delivery_documents',
  'route_closeout_documents',
  'route_inventory_closeouts',
  'private_hazard_submissions',
  'shared_safety_moderation_candidates',
  'kpi_snapshots',
  'logistics_events',
  'logistics_signals',
  'logistics_findings',
  'logistics_recommendations',
  'fleet_score_snapshots',
  'audit_events'
]);

const EPHEMERAL_TABLES = Object.freeze([
  { table: 'driver_sessions', where: 'expires_at < NOW() OR revoked_at IS NOT NULL' },
  { table: 'warehouse_employee_sessions', where: 'expires_at < NOW() OR revoked_at IS NOT NULL' },
  { table: 'delivery_documents', where: 'expires_at < NOW()' },
  { table: 'route_closeout_documents', where: 'expires_at < NOW()' }
]);

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeSubjectType(value) {
  const subject = cleanText(value, 80).toUpperCase();
  if (!USER_SUBJECTS.has(subject) && subject !== 'ORGANIZATION') {
    const error = new Error('Unsupported lifecycle subject type.');
    error.status = 400;
    error.code = 'UNSUPPORTED_LIFECYCLE_SUBJECT';
    throw error;
  }
  return subject;
}

function actorId(context = {}) {
  return cleanText(context.actorId || context.username || context.internalUserId || 'unknown', 160) || 'unknown';
}

function actorType(context = {}) {
  return cleanText(context.actorType || 'admin_user', 80) || 'admin_user';
}

function requirePermission(context, permission) {
  if (!context?.authenticated) {
    const error = new Error('Authentication required.');
    error.status = 401;
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }
  if (!rbac.hasPermission(context, permission)) {
    const error = new Error('Insufficient permission for lifecycle action.');
    error.status = 403;
    error.code = 'LIFECYCLE_PERMISSION_DENIED';
    throw error;
  }
}

function requireOrganizationScope(context, organizationId) {
  const targetOrg = cleanText(organizationId, 160);
  if (!targetOrg) {
    const error = new Error('organizationId is required.');
    error.status = 400;
    error.code = 'ORGANIZATION_REQUIRED';
    throw error;
  }
  if (context?.approvedRole === rbac.ROLES.PLATFORM_ADMIN && !context.organizationId) return targetOrg;
  assertSameOrganization(context.organizationId, targetOrg);
  return targetOrg;
}

async function tableExists(client, table) {
  const result = await client.query(
    'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1) AS exists',
    [table]
  );
  return Boolean(result.rows[0]?.exists);
}

async function countWhere(client, table, where, params = []) {
  if (!(await tableExists(client, table))) return 0;
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}`, params);
  return Number(result.rows[0]?.count) || 0;
}

async function hasColumn(client, table, column) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [table, column]
  );
  return Boolean(result.rows[0]?.exists);
}

async function recordLifecycleEvent(client, context, targetType, targetId, eventType, metadata = {}, organizationId = null) {
  await client.query(
    `INSERT INTO lifecycle_events (
      organization_id, target_type, target_id, event_type, actor_type, actor_id, outcome, metadata, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'success', $7::jsonb, NOW())`,
    [
      organizationId || context.organizationId || null,
      targetType,
      targetId,
      eventType,
      actorType(context),
      actorId(context),
      JSON.stringify(metadata)
    ]
  );
}

async function getLifecyclePolicy(dataClass, organizationId = null) {
  const result = await postgres.query(
    `SELECT *
     FROM retention_policies
     WHERE data_class = $1
       AND (organization_id = $2 OR organization_id IS NULL)
     ORDER BY organization_id NULLS LAST
     LIMIT 1`,
    [cleanText(dataClass, 120), organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    return {
      dataClass,
      action: 'POLICY_DECISION_REQUIRED',
      decisionStatus: 'POLICY_DECISION_REQUIRED',
      retentionDays: null,
      recoveryDays: dataClass === 'account_recovery' ? ACCOUNT_RECOVERY_DAYS : null,
      legalHoldEligible: true
    };
  }
  return {
    id: row.id,
    organizationId: row.organization_id || null,
    dataClass: row.data_class,
    policyScope: row.policy_scope,
    retentionDays: row.retention_days,
    recoveryDays: row.recovery_days,
    action: row.action,
    decisionStatus: row.decision_status,
    legalHoldEligible: row.legal_hold_eligible,
    metadata: row.metadata || {}
  };
}

async function hasActiveLegalHold({ organizationId, scopeType, scopeId }) {
  const result = await postgres.query(
    `SELECT id
     FROM legal_holds
     WHERE status = 'ACTIVE'
       AND (organization_id = $1 OR organization_id IS NULL)
       AND (
         scope_type = 'GLOBAL'
         OR (scope_type = $2 AND COALESCE(scope_id, '') = COALESCE($3, ''))
         OR (scope_type = 'ORGANIZATION' AND COALESCE(scope_id, '') = COALESCE($1, ''))
       )
     LIMIT 1`,
    [organizationId || null, cleanText(scopeType, 80).toUpperCase(), cleanText(scopeId, 160) || null]
  );
  return Boolean(result.rows[0]);
}

async function loadUserSubject(client, subjectType, subjectId, organizationId) {
  const config = USER_TABLES[subjectType];
  if (!config) return null;
  const result = await client.query(
    `SELECT * FROM ${config.table}
     WHERE ${config.idColumn} = $1
       AND organization_id = $2
     LIMIT 1`,
    [subjectId, organizationId]
  );
  return result.rows[0] || null;
}

async function buildUserImpactPreview(client, subjectType, subjectId, organizationId) {
  const direct = USER_TABLES[subjectType];
  const retain = [];
  const anonymize = [];
  const hardDelete = [];
  const policyDecisions = [];
  const objectImpacts = [];

  if (direct?.sessionTable && await tableExists(client, direct.sessionTable)) {
    hardDelete.push({
      table: direct.sessionTable,
      action: 'HARD DELETE',
      count: await countWhere(client, direct.sessionTable, `${direct.sessionUserColumn} = $1`, [subjectId]),
      rationale: 'Session/auth artifact is ephemeral and is revoked on deactivation.'
    });
  }

  if (subjectType === 'DRIVER') {
    for (const table of ['daily_route_manifests', 'daily_route_stops', 'delivery_settlements', 'delivery_documents', 'route_closeout_documents', 'route_inventory_closeouts', 'route_truck_inventory_additions', 'route_truck_inventory_allocations']) {
      if (!(await tableExists(client, table))) continue;
      let count;
      if (table === 'daily_route_stops') {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM daily_route_stops AS stop
           JOIN daily_route_manifests AS manifest ON manifest.id = stop.manifest_id
           WHERE stop.organization_id = $1 AND manifest.assigned_driver_id = $2`,
          [organizationId, subjectId]
        );
        count = Number(result.rows[0]?.count) || 0;
      } else {
        const column = table === 'daily_route_manifests' ? 'assigned_driver_id' : 'driver_id';
        count = await countWhere(client, table, `organization_id = $1 AND ${column} = $2`, [organizationId, subjectId]);
      }
      retain.push({
        table,
        action: 'RETAIN',
        count,
        rationale: 'Driver operational history survives user lifecycle under ODR-019.'
      });
    }
  }

  if (subjectType === 'ADMIN_USER') {
    for (const table of ['audit_events', 'account_ai_insights', 'supervisor_alerts', 'scheduled_report_schedules', 'scheduled_reports']) {
      if (!(await tableExists(client, table))) continue;
      retain.push({
        table,
        action: 'RETAIN',
        count: table === 'audit_events'
          ? await countWhere(client, table, 'organization_id = $1 AND actor_id = $2', [organizationId, subjectId])
          : await countWhere(client, table, 'organization_id = $1', [organizationId]),
        rationale: 'Supervisor/admin historical and audit records are retained or pseudonymized, not cascaded.'
      });
    }
  }

  if (subjectType === 'WAREHOUSE_EMPLOYEE') {
    for (const table of ['route_departure_inventory_confirmations', 'audit_events']) {
      if (!(await tableExists(client, table))) continue;
      retain.push({
        table,
        action: 'RETAIN',
        count: table === 'audit_events'
          ? await countWhere(client, table, 'organization_id = $1 AND actor_id = $2', [organizationId, subjectId])
          : await countWhere(client, table, 'organization_id = $1 AND warehouse_employee_id = $2', [organizationId, subjectId]),
        rationale: 'Warehouse confirmations and audit evidence survive employee lifecycle.'
      });
    }
  }

  if (await tableExists(client, 'lifecycle_object_references')) {
    const objects = await countWhere(
      client,
      'lifecycle_object_references',
      'organization_id = $1 AND owner_id = $2 AND legal_hold_eligible = true',
      [organizationId, subjectId]
    );
    objectImpacts.push({
      table: 'lifecycle_object_references',
      action: 'POLICY_DECISION_REQUIRED',
      count: objects,
      rationale: 'Object-storage deletion requires retention policy and legal-hold evaluation.'
    });
  }

  anonymize.push({
    table: direct.table,
    action: 'PSEUDONYMIZE',
    count: 1,
    rationale: 'Direct personal identifiers may be pseudonymized after approved deletion workflow.'
  });
  policyDecisions.push('Operational, analytical, backup, and object-storage retention durations remain POLICY_DECISION_REQUIRED.');

  return { retain, anonymize, hardDelete, objectImpacts, policyDecisions };
}

async function deactivateUser(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_DEACTIVATE);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || 'DRIVER');
  if (!USER_SUBJECTS.has(subjectType)) {
    const error = new Error('Only user subjects can be deactivated.');
    error.status = 400;
    throw error;
  }
  const subjectId = cleanText(input.subjectId || input.subject_id, 160);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const config = USER_TABLES[subjectType];

  return postgres.withTransaction(async (client) => {
    const subject = await loadUserSubject(client, subjectType, subjectId, organizationId);
    if (!subject) {
      const error = new Error('Lifecycle subject not found.');
      error.status = 404;
      throw error;
    }

    const result = await client.query(
      `UPDATE ${config.table}
       SET ${config.activeColumn} = false,
           lifecycle_status = 'DEACTIVATED',
           deactivated_at = COALESCE(deactivated_at, NOW()),
           deactivated_by = COALESCE(deactivated_by, $3),
           updated_at = NOW()
       WHERE ${config.idColumn} = $1
         AND organization_id = $2
       RETURNING *`,
      [subjectId, organizationId, actorId(context)]
    );

    if (config.sessionTable) {
      await client.query(
        `UPDATE ${config.sessionTable}
         SET revoked_at = NOW(), revoked_reason = 'lifecycle_deactivation'
         WHERE ${config.sessionUserColumn} = $1
           AND revoked_at IS NULL`,
        [subjectId]
      );
    }
    if (subjectType === 'ADMIN_USER') {
      await client.query(
        `UPDATE admin_users
         SET session_version = session_version + 1
         WHERE username = $1 AND organization_id = $2`,
        [subjectId, organizationId]
      );
    }
    await recordLifecycleEvent(client, context, subjectType, subjectId, 'deactivation', { reason: cleanText(input.reason, 500) || null }, organizationId);
    return { ok: true, subjectType, subjectId, organizationId, lifecycleStatus: result.rows[0].lifecycle_status };
  });
}

async function reactivateUser(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REACTIVATE);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || 'DRIVER');
  const subjectId = cleanText(input.subjectId || input.subject_id, 160);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const config = USER_TABLES[subjectType];
  if (!config) {
    const error = new Error('Only user subjects can be reactivated.');
    error.status = 400;
    throw error;
  }

  return postgres.withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE ${config.table}
       SET ${config.activeColumn} = true,
           lifecycle_status = 'ACTIVE',
           reactivated_at = NOW(),
           reactivated_by = $3,
           updated_at = NOW()
       WHERE ${config.idColumn} = $1
         AND organization_id = $2
         AND lifecycle_status IN ('SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED', 'SOFT_DELETED')
       RETURNING *`,
      [subjectId, organizationId, actorId(context)]
    );
    if (!result.rows[0]) {
      const error = new Error('Lifecycle subject is not eligible for reactivation.');
      error.status = 409;
      throw error;
    }
    await recordLifecycleEvent(client, context, subjectType, subjectId, 'reactivation', {}, organizationId);
    return { ok: true, subjectType, subjectId, organizationId, lifecycleStatus: result.rows[0].lifecycle_status };
  });
}

async function requestUserDeletion(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REQUEST_DELETE);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || 'DRIVER');
  const subjectId = cleanText(input.subjectId || input.subject_id, 160);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const config = USER_TABLES[subjectType];
  if (!config) {
    const error = new Error('Only user subjects can enter the user deletion workflow.');
    error.status = 400;
    throw error;
  }
  const reason = cleanText(input.reason || input.deletionReason || input.deletion_reason, 1000);

  return postgres.withTransaction(async (client) => {
    const subject = await loadUserSubject(client, subjectType, subjectId, organizationId);
    if (!subject) {
      const error = new Error('Lifecycle subject not found.');
      error.status = 404;
      throw error;
    }
    const recovery = await getLifecyclePolicy('account_recovery', organizationId);
    const recoveryDays = Number(recovery.recoveryDays) || ACCOUNT_RECOVERY_DAYS;
    const request = await client.query(
      `INSERT INTO lifecycle_deletion_requests (
        organization_id, subject_type, subject_id, requester_actor_type, requester_actor_id,
        request_type, status, recovery_window_days, recovery_deadline_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, 'DELETION', 'REQUESTED', $6::integer, NOW() + ($6::integer * INTERVAL '1 day'), $7::jsonb)
      RETURNING *`,
      [organizationId, subjectType, subjectId, actorType(context), actorId(context), recoveryDays, JSON.stringify({ reason })]
    );
    await client.query(
      `UPDATE ${config.table}
       SET ${config.activeColumn} = false,
           lifecycle_status = 'DELETION_REQUESTED',
           deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
           deletion_requested_by = COALESCE(deletion_requested_by, $3),
           deletion_reason = $4,
           scheduled_purge_at = NOW() + ($5::integer * INTERVAL '1 day'),
           updated_at = NOW()
       WHERE ${config.idColumn} = $1 AND organization_id = $2`,
      [subjectId, organizationId, actorId(context), reason || null, recoveryDays]
    );
    if (config.sessionTable) {
      await client.query(
        `UPDATE ${config.sessionTable}
         SET revoked_at = NOW(), revoked_reason = 'lifecycle_deletion_requested'
         WHERE ${config.sessionUserColumn} = $1 AND revoked_at IS NULL`,
        [subjectId]
      );
    }
    await recordLifecycleEvent(client, context, subjectType, subjectId, 'deletion_request', { requestId: request.rows[0].id }, organizationId);
    return { ok: true, deletionRequest: request.rows[0] };
  });
}

async function cancelDeletionRequest(context, requestId) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE);
  const id = cleanText(requestId, 160);
  return postgres.withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM lifecycle_deletion_requests WHERE id = $1 LIMIT 1', [id]);
    const request = existing.rows[0];
    if (!request) {
      const error = new Error('Deletion request not found.');
      error.status = 404;
      throw error;
    }
    requireOrganizationScope(context, request.organization_id);
    if (new Date(request.recovery_deadline_at).getTime() < Date.now()) {
      const error = new Error('Recovery window has expired.');
      error.status = 409;
      error.code = 'RECOVERY_WINDOW_EXPIRED';
      throw error;
    }
    await client.query(
      `UPDATE lifecycle_deletion_requests
       SET status = 'CANCELED', canceled_by = $2, canceled_at = NOW()
       WHERE id = $1`,
      [id, actorId(context)]
    );
    const config = USER_TABLES[request.subject_type];
    if (config) {
      await client.query(
        `UPDATE ${config.table}
         SET lifecycle_status = 'ACTIVE',
             ${config.activeColumn} = true,
             scheduled_purge_at = NULL,
             updated_at = NOW()
         WHERE ${config.idColumn} = $1 AND organization_id = $2`,
        [request.subject_id, request.organization_id]
      );
    }
    await recordLifecycleEvent(client, context, request.subject_type, request.subject_id, 'cancellation', { requestId: id }, request.organization_id);
    return { ok: true, requestId: id, status: 'CANCELED' };
  });
}

async function previewUserPurgeImpact(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || 'DRIVER');
  const subjectId = cleanText(input.subjectId || input.subject_id, 160);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);

  return postgres.withTransaction(async (client) => {
    const subject = await loadUserSubject(client, subjectType, subjectId, organizationId);
    if (!subject) {
      const error = new Error('Lifecycle subject not found.');
      error.status = 404;
      throw error;
    }
    const legalHold = await hasActiveLegalHold({ organizationId, scopeType: subjectType, scopeId: subjectId });
    const impact = await buildUserImpactPreview(client, subjectType, subjectId, organizationId);
    const preview = {
      targetType: subjectType,
      targetId: subjectId,
      organizationId,
      blockedByLegalHold: legalHold,
      recordsToDelete: legalHold ? [] : impact.hardDelete,
      recordsToAnonymize: legalHold ? [] : impact.anonymize,
      recordsToRetain: impact.retain,
      objectStorageFilesAffected: legalHold ? [] : impact.objectImpacts,
      policyDecisions: impact.policyDecisions,
      sharedSafetyGlobalRecordsPreserved: true,
      dryRun: true
    };
    await recordLifecycleEvent(client, context, subjectType, subjectId, 'impact_preview', { preview }, organizationId);
    return preview;
  });
}

async function anonymizeUser(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || 'DRIVER');
  const subjectId = cleanText(input.subjectId || input.subject_id, 160);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const config = USER_TABLES[subjectType];
  if (!config) {
    const error = new Error('Only user subjects can be anonymized.');
    error.status = 400;
    throw error;
  }
  if (await hasActiveLegalHold({ organizationId, scopeType: subjectType, scopeId: subjectId })) {
    const error = new Error('Legal hold blocks anonymization.');
    error.status = 409;
    error.code = 'LEGAL_HOLD_BLOCKS_ACTION';
    throw error;
  }
  const pseudonym = `anon_${crypto.createHash('sha256').update(`${organizationId}:${subjectType}:${subjectId}`).digest('hex').slice(0, 20)}`;
  return postgres.withTransaction(async (client) => {
    const labelAssignment = config.labelColumn
      ? `${config.labelColumn} = 'Anonymized User',`
      : '';
    const result = await client.query(
      `UPDATE ${config.table}
       SET ${labelAssignment}
           lifecycle_status = 'ANONYMIZED',
           anonymized_at = NOW(),
           pseudonymous_actor_id = $3,
           updated_at = NOW()
       WHERE ${config.idColumn} = $1
         AND organization_id = $2
       RETURNING lifecycle_status, pseudonymous_actor_id`,
      [subjectId, organizationId, pseudonym]
    );
    if (!result.rows[0]) {
      const error = new Error('Lifecycle subject not found.');
      error.status = 404;
      throw error;
    }
    await recordLifecycleEvent(client, context, subjectType, subjectId, 'anonymization', { pseudonymousActorId: pseudonym }, organizationId);
    return { ok: true, subjectType, subjectId, organizationId, pseudonymousActorId: pseudonym };
  });
}

async function applyLegalHold(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_LEGAL_HOLD_MANAGE);
  const scopeType = cleanText(input.scopeType || input.scope_type, 80).toUpperCase();
  const scopeId = cleanText(input.scopeId || input.scope_id, 160) || null;
  const organizationId = input.organizationId || input.organization_id || context.organizationId || null;
  if (organizationId) requireOrganizationScope(context, organizationId);
  const reason = cleanText(input.reason, 1000);
  if (!reason) {
    const error = new Error('Legal hold reason is required.');
    error.status = 400;
    throw error;
  }
  const result = await postgres.query(
    `INSERT INTO legal_holds (
      organization_id, scope_type, scope_id, reason, status, authorized_by, metadata
    ) VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6::jsonb)
    RETURNING *`,
    [organizationId || null, scopeType, scopeId, reason, actorId(context), JSON.stringify(input.metadata || {})]
  );
  return { ok: true, legalHold: result.rows[0] };
}

async function releaseLegalHold(context, id, reason) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_LEGAL_HOLD_MANAGE);
  const result = await postgres.query(
    `UPDATE legal_holds
     SET status = 'RELEASED', released_by = $2, released_at = NOW(), release_reason = $3
     WHERE id = $1
       AND status = 'ACTIVE'
     RETURNING *`,
    [cleanText(id, 160), actorId(context), cleanText(reason, 1000) || null]
  );
  if (!result.rows[0]) {
    const error = new Error('Active legal hold not found.');
    error.status = 404;
    throw error;
  }
  if (result.rows[0].organization_id) {
    requireOrganizationScope(context, result.rows[0].organization_id);
  } else if (context?.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    const error = new Error('Platform Admin is required to release a platform-global legal hold.');
    error.status = 403;
    throw error;
  }
  return { ok: true, legalHold: result.rows[0] };
}

async function requestOrganizationTermination(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_TERMINATE);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const reason = cleanText(input.reason, 1000);
  return postgres.withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE organizations
       SET lifecycle_status = 'TERMINATION_REQUESTED',
           status = CASE WHEN status = 'active' THEN 'suspended' ELSE status END,
           termination_requested_at = COALESCE(termination_requested_at, NOW()),
           termination_requested_by = COALESCE(termination_requested_by, $2),
           termination_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [organizationId, actorId(context), reason || null]
    );
    if (!result.rows[0]) {
      const error = new Error('Organization not found.');
      error.status = 404;
      throw error;
    }
    await client.query(`UPDATE admin_users SET session_version = session_version + 1 WHERE organization_id = $1`, [organizationId]);
    await client.query(`UPDATE driver_sessions SET revoked_at = NOW(), revoked_reason = 'organization_termination_requested' WHERE organization_id = $1 AND revoked_at IS NULL`, [organizationId]);
    await client.query(`UPDATE warehouse_employee_sessions SET revoked_at = NOW(), revoked_reason = 'organization_termination_requested' WHERE organization_id = $1 AND revoked_at IS NULL`, [organizationId]);
    await client.query(
      `INSERT INTO organization_lifecycle_events (organization_id, event_type, actor_type, actor_id, reason, metadata)
       VALUES ($1, 'termination_requested', $2, $3, $4, $5::jsonb)`,
      [organizationId, actorType(context), actorId(context), reason || null, JSON.stringify({ operationalShutdown: 'access_revoked' })]
    );
    return { ok: true, organization: result.rows[0] };
  });
}

async function previewOrganizationPurgeImpact(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_REVIEW);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  return postgres.withTransaction(async (client) => {
    const legalHold = await hasActiveLegalHold({ organizationId, scopeType: 'ORGANIZATION', scopeId: organizationId });
    const recordsToRetain = [];
    for (const table of HISTORICAL_TABLES) {
      if (!(await tableExists(client, table))) continue;
      if (!(await hasColumn(client, table, 'organization_id'))) continue;
      recordsToRetain.push({
        table,
        action: table === 'shared_safety_records' ? 'PLATFORM-GLOBAL PRESERVE' : 'RETAIN',
        count: await countWhere(client, table, 'organization_id = $1', [organizationId]),
        rationale: 'Organization-private historical data remains retained until approved policy permits purge.'
      });
    }
    const ephemeral = [];
    for (const candidate of EPHEMERAL_TABLES) {
      if (!(await tableExists(client, candidate.table))) continue;
      if (!(await hasColumn(client, candidate.table, 'organization_id'))) continue;
      ephemeral.push({
        table: candidate.table,
        action: legalHold ? 'LEGAL HOLD' : 'HARD DELETE',
        count: await countWhere(client, candidate.table, `organization_id = $1 AND (${candidate.where})`, [organizationId])
      });
    }
    return {
      targetType: 'ORGANIZATION',
      targetId: organizationId,
      organizationId,
      blockedByLegalHold: legalHold,
      recordsToDelete: legalHold ? [] : ephemeral,
      recordsToRetain,
      sharedSafetyGlobalRecordsPreserved: true,
      objectStorageFilesAffected: [],
      policyDecisions: ['Organization data exit format, delivery method, and final retention durations are POLICY_DECISION_REQUIRED.'],
      dryRun: true
    };
  });
}

async function submitDataSubjectRequest(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const result = await postgres.query(
    `INSERT INTO data_subject_requests (
      organization_id, request_type, requester_actor_type, requester_actor_id,
      subject_type, subject_id, status, reason, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7, $8::jsonb)
    RETURNING *`,
    [
      organizationId,
      cleanText(input.requestType || input.request_type, 80).toUpperCase(),
      actorType(context),
      actorId(context),
      cleanText(input.subjectType || input.subject_type, 80).toUpperCase(),
      cleanText(input.subjectId || input.subject_id, 160),
      cleanText(input.reason, 1000) || null,
      JSON.stringify(input.metadata || {})
    ]
  );
  return { ok: true, dataSubjectRequest: result.rows[0] };
}

async function reviewDataSubjectRequest(context, id, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE);
  const result = await postgres.query(
    `UPDATE data_subject_requests
     SET status = $2,
         decision = $3,
         reason = $4,
         reviewer_actor_id = $5,
         reviewed_at = NOW(),
         completed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE completed_at END
     WHERE id = $1
     RETURNING *`,
    [
      cleanText(id, 160),
      cleanText(input.status, 80).toUpperCase() || 'IN_REVIEW',
      cleanText(input.decision, 80).toUpperCase() || null,
      cleanText(input.reason, 1000) || null,
      actorId(context)
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Data subject request not found.');
    error.status = 404;
    throw error;
  }
  requireOrganizationScope(context, result.rows[0].organization_id);
  return { ok: true, dataSubjectRequest: result.rows[0] };
}

async function createDataExportRequest(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_EXPORT);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const result = await postgres.query(
    `INSERT INTO data_exports (organization_id, export_type, status, requested_by, manifest, metadata)
     VALUES ($1, $2, 'REQUESTED', $3, $4::jsonb, $5::jsonb)
     RETURNING *`,
    [
      organizationId,
      cleanText(input.exportType || input.export_type || 'organization_data_exit', 120),
      actorId(context),
      JSON.stringify({
        format: 'OWNER_DECISION_REQUIRED',
        deliveryMethod: 'OWNER_DECISION_REQUIRED',
        bounded: true,
        tenantScoped: true
      }),
      JSON.stringify(input.metadata || {})
    ]
  );
  return { ok: true, dataExport: result.rows[0] };
}

async function previewEphemeralPurge(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  return postgres.withTransaction(async (client) => {
    const legalHold = await hasActiveLegalHold({ organizationId, scopeType: 'ORGANIZATION', scopeId: organizationId });
    const recordsToDelete = [];
    for (const candidate of EPHEMERAL_TABLES) {
      if (!(await tableExists(client, candidate.table))) continue;
      if (!(await hasColumn(client, candidate.table, 'organization_id'))) continue;
      const rows = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${candidate.table} WHERE organization_id = $1 AND (${candidate.where})`,
        [organizationId]
      );
      recordsToDelete.push({
        table: candidate.table,
        action: legalHold ? 'LEGAL HOLD' : 'HARD DELETE',
        count: Number(rows.rows[0]?.count) || 0
      });
    }
    const preview = {
      targetType: 'EPHEMERAL_RECORDS',
      targetId: organizationId,
      organizationId,
      blockedByLegalHold: legalHold,
      recordsToDelete: legalHold ? [] : recordsToDelete,
      recordsBlockedByLegalHold: legalHold ? recordsToDelete : [],
      recordsToRetain: [],
      recordsToAnonymize: [],
      objectStorageFilesAffected: [],
      sharedSafetyGlobalRecordsPreserved: true,
      policyDecisions: [],
      dryRun: true
    };
    const job = await client.query(
      `INSERT INTO lifecycle_purge_jobs (
        organization_id, target_type, target_id, preview, status, dry_run, requested_by, metadata
      ) VALUES ($1, 'EPHEMERAL_RECORDS', $1, $2::jsonb, $3, true, $4, $5::jsonb)
      RETURNING id, status`,
      [
        organizationId,
        JSON.stringify(preview),
        legalHold ? 'BLOCKED' : 'PREVIEWED',
        actorId(context),
        JSON.stringify({ previewLinked: true })
      ]
    );
    await recordLifecycleEvent(client, context, 'EPHEMERAL_RECORDS', organizationId, 'impact_preview', { purgeJobId: job.rows[0].id, preview }, organizationId);
    return { ...preview, purgeJobId: job.rows[0].id, purgeJobStatus: job.rows[0].status };
  });
}

async function executeEphemeralPurge(context, input = {}) {
  requirePermission(context, rbac.PERMISSIONS.LIFECYCLE_USER_PURGE);
  const organizationId = requireOrganizationScope(context, input.organizationId || input.organization_id || context.organizationId);
  const previewJobId = cleanText(input.previewJobId || input.preview_job_id || input.purgeJobId || input.purge_job_id, 160);
  if (!previewJobId) {
    const error = new Error('A preview-linked lifecycle purge job is required before purge execution.');
    error.status = 400;
    error.code = 'PURGE_PREVIEW_REQUIRED';
    throw error;
  }
  if (process.env.ALLOW_PRODUCTION_LIFECYCLE_PURGE !== 'true' && process.env.NODE_ENV === 'production') {
    const error = new Error('Production lifecycle purge execution requires explicit owner-approved ALLOW_PRODUCTION_LIFECYCLE_PURGE=true.');
    error.status = 403;
    error.code = 'PRODUCTION_PURGE_NOT_APPROVED';
    throw error;
  }
  if (await hasActiveLegalHold({ organizationId, scopeType: 'ORGANIZATION', scopeId: organizationId })) {
    const error = new Error('Legal hold blocks purge execution.');
    error.status = 409;
    error.code = 'LEGAL_HOLD_BLOCKS_PURGE';
    throw error;
  }
  return postgres.withTransaction(async (client) => {
    const jobResult = await client.query(
      `SELECT *
       FROM lifecycle_purge_jobs
       WHERE id = $1
         AND organization_id = $2
         AND target_type = 'EPHEMERAL_RECORDS'
       FOR UPDATE`,
      [previewJobId, organizationId]
    );
    const job = jobResult.rows[0];
    if (!job) {
      const error = new Error('Preview-linked purge job not found for this Organization.');
      error.status = 404;
      error.code = 'PURGE_PREVIEW_NOT_FOUND';
      throw error;
    }
    if (job.status !== 'PREVIEWED' && job.status !== 'APPROVED') {
      const error = new Error('Purge job is not eligible for execution.');
      error.status = 409;
      error.code = 'PURGE_JOB_NOT_EXECUTABLE';
      throw error;
    }
    if (job.preview?.blockedByLegalHold === true) {
      const error = new Error('Preview-linked purge job is blocked by legal hold.');
      error.status = 409;
      error.code = 'LEGAL_HOLD_BLOCKS_PURGE';
      throw error;
    }
    await client.query(
      `UPDATE lifecycle_purge_jobs
       SET status = 'RUNNING', dry_run = false, confirmed_by = $2, executed_at = NOW()
       WHERE id = $1`,
      [previewJobId, actorId(context)]
    );
    const results = [];
    try {
      for (const candidate of EPHEMERAL_TABLES) {
        if (!(await tableExists(client, candidate.table))) continue;
        if (!(await hasColumn(client, candidate.table, 'organization_id'))) continue;
        const deleted = await client.query(`DELETE FROM ${candidate.table} WHERE organization_id = $1 AND (${candidate.where})`, [organizationId]);
        results.push({ table: candidate.table, deletedCount: deleted.rowCount });
      }
      await client.query(
        `UPDATE lifecycle_purge_jobs
         SET status = 'COMPLETED', completed_at = NOW(), metadata = metadata || $2::jsonb
         WHERE id = $1`,
        [previewJobId, JSON.stringify({ results })]
      );
    } catch (error) {
      await client.query(
        `UPDATE lifecycle_purge_jobs
         SET status = 'FAILED', failed_at = NOW(), error_message = $2
         WHERE id = $1`,
        [previewJobId, cleanText(error.message, 1000)]
      );
      throw error;
    }
    await recordLifecycleEvent(client, context, 'EPHEMERAL_RECORDS', organizationId, 'purge_execution', { purgeJobId: previewJobId, results }, organizationId);
    return { ok: true, organizationId, purgeJobId: previewJobId, results };
  });
}

module.exports = {
  ACCOUNT_RECOVERY_DAYS,
  anonymizeUser,
  applyLegalHold,
  cancelDeletionRequest,
  createDataExportRequest,
  deactivateUser,
  executeEphemeralPurge,
  getLifecyclePolicy,
  hasActiveLegalHold,
  previewEphemeralPurge,
  previewOrganizationPurgeImpact,
  previewUserPurgeImpact,
  reactivateUser,
  releaseLegalHold,
  requestOrganizationTermination,
  requestUserDeletion,
  reviewDataSubjectRequest,
  submitDataSubjectRequest
};
