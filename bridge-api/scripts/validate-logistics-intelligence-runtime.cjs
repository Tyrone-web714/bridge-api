require('dotenv').config();

const postgres = require('../db/postgres');
const logisticsIntelligence = require('../services/logisticsIntelligence');
const rbac = require('../services/rbac');

function assert(condition, message) {
  if (!condition) throw new Error(`[logistics-intelligence-runtime] ${message}`);
}

function context(overrides = {}) {
  const role = overrides.approvedRole || rbac.ROLES.ORGANIZATION_ADMIN;
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: overrides.actorId || 'runtime-org-admin',
    organizationId: overrides.organizationId || 'demo-fleet-a',
    approvedRole: role,
    role,
    permissions: rbac.permissionsForRole(role),
    ...overrides
  };
}

async function seedOrganization(id, name) {
  await postgres.query(
    `INSERT INTO organizations (id, name, slug, status)
     VALUES ($1, $2, $1, 'active')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active', updated_at = NOW()`,
    [id, name]
  );
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert(/127\.0\.0\.1:5544\d/.test(process.env.DATABASE_URL), 'runtime validation must use isolated local PostgreSQL on a 5544x validation port');
  const runId = `runtime-${Date.now()}`;

  await seedOrganization('demo-fleet-a', 'Demo Fleet A');
  await seedOrganization('demo-fleet-b', 'Demo Fleet B');

  const orgA = context();
  const orgB = context({ organizationId: 'demo-fleet-b', actorId: 'runtime-org-b-admin' });
  const supervisor = context({ approvedRole: rbac.ROLES.SUPERVISOR, actorId: 'runtime-supervisor' });
  const driver = context({ approvedRole: rbac.ROLES.DRIVER, actorId: 'runtime-driver' });

  const event = await logisticsIntelligence.ingestEvent(orgA, {
    eventType: 'route_delay',
    eventCategory: 'route_execution',
    sourceType: 'runtime_validation',
    sourceId: `${runId}-route-delay-1`,
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    routeId: `${runId}-route-1`,
    occurredAt: '2026-07-16T12:00:00.000Z',
    idempotencyKey: `${runId}-route-delay-1`,
    payload: { delayMinutes: 42, severity: 'high' }
  });
  const duplicate = await logisticsIntelligence.ingestEvent(orgA, {
    eventType: 'route_delay',
    sourceType: 'runtime_validation',
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    occurredAt: '2026-07-16T12:05:00.000Z',
    idempotencyKey: `${runId}-route-delay-1`,
    payload: { delayMinutes: 99, severity: 'critical' }
  });
  assert(event.id === duplicate.id, 'event ingestion must be idempotent by Organization and idempotency key');

  await logisticsIntelligence.ingestEvent(orgA, {
    eventType: 'kpi_snapshot_created',
    eventCategory: 'bi_kpi',
    sourceType: 'kpi_snapshot',
    sourceId: `${runId}-kpi-snapshot-1`,
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    occurredAt: '2026-07-16T13:00:00.000Z',
    idempotencyKey: `${runId}-kpi-snapshot-1`,
    payload: { kpiDefinitionId: 'runtime-kpi-definition', formulaVersionId: 'runtime-formula-v1', thresholdStatus: 'critical' }
  });
  await logisticsIntelligence.ingestEvent(orgA, {
    eventType: 'shared_safety_record_published',
    eventCategory: 'shared_safety',
    sourceType: 'shared_safety_record',
    sourceId: `${runId}-shared-safety-1`,
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    occurredAt: '2026-07-16T14:00:00.000Z',
    idempotencyKey: `${runId}-shared-safety-1`,
    payload: { sharedRecordId: `${runId}-shared-safety-1`, hazardType: 'low_bridge', severity: 'high' }
  });

  const processed = await logisticsIntelligence.processIntelligence(supervisor, { limit: 20 });
  assert(processed.signals.length >= 3, 'pipeline should create signals');
  assert(processed.findings.length >= 3, 'pipeline should create findings');
  assert(processed.recommendations.length >= 3, 'pipeline should create recommendations');

  const recommendations = await logisticsIntelligence.listRecommendations(supervisor, { status: 'proposed' });
  const recommendation = recommendations.find((item) => item.subjectId === `${runId}-route-1`);
  assert(recommendation, 'supervisor should see tenant-scoped recommendation');
  assert(recommendation.lineage?.engineVersion === logisticsIntelligence.ENGINE_VERSION, 'recommendation should include engine lineage');

  const decision = await logisticsIntelligence.decideRecommendation(supervisor, recommendation.id, {
    decision: 'marked_reviewed',
    reason: 'Runtime validation review.'
  });
  assert(decision.decision === 'marked_reviewed', 'decision should be recorded');

  const outcome = await logisticsIntelligence.recordOutcome(supervisor, recommendation.id, {
    decisionId: decision.id,
    outcomeType: 'manual_review',
    result: 'no_action_needed',
    effectiveness: 0.75,
    notes: 'Runtime outcome recorded.'
  });
  assert(outcome.recommendationId === recommendation.id, 'outcome should link to recommendation');

  let orgBBlocked = false;
  try {
    await logisticsIntelligence.getRecommendation(orgB, recommendation.id);
  } catch (error) {
    orgBBlocked = error.status === 404;
  }
  assert(orgBBlocked, 'Organization B must not read Organization A recommendation');

  let driverBlocked = false;
  try {
    await logisticsIntelligence.decideRecommendation(driver, recommendation.id, { decision: 'accepted' });
  } catch (error) {
    driverBlocked = error.status === 403;
  }
  assert(driverBlocked, 'Driver must not decide recommendations by default');

  const rerun = await logisticsIntelligence.processIntelligence(supervisor, { limit: 20 });
  const afterRerun = await logisticsIntelligence.listRecommendations(supervisor, { limit: 100 });
  const matching = afterRerun.filter((item) => item.runKey === recommendation.runKey);
  assert(rerun.signals.length >= 3, 'rerun should remain deterministic');
  assert(matching.length === 1, 'scheduled/idempotent run keys should prevent duplicate recommendation rows');

  const outcomes = await logisticsIntelligence.listOutcomes(supervisor, { limit: 20 });
  assert(outcomes.some((item) => item.id === outcome.id), 'outcome should be listable in Organization scope');

  console.log('[logistics-intelligence-runtime] isolated database Logistics Intelligence checks passed');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
