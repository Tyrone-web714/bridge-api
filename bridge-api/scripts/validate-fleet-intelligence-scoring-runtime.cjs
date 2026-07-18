require('dotenv').config();

const postgres = require('../db/postgres');
const logistics = require('../services/logisticsIntelligence');
const fiss = require('../services/fleetIntelligenceScoring');
const rbac = require('../services/rbac');

function assert(condition, message) {
  if (!condition) throw new Error(`[fiss-runtime] ${message}`);
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
  const runId = `fiss-runtime-${Date.now()}`;
  const periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const periodEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await seedOrganization('demo-fleet-a', 'Demo Fleet A');
  await seedOrganization('demo-fleet-b', 'Demo Fleet B');

  const orgA = context();
  const orgB = context({ organizationId: 'demo-fleet-b', actorId: 'runtime-org-b-admin' });
  const supervisor = context({ approvedRole: rbac.ROLES.SUPERVISOR, actorId: 'runtime-supervisor' });
  const driver = context({ approvedRole: rbac.ROLES.DRIVER, actorId: 'runtime-driver' });

  const model = await fiss.createScoreModel(orgA, {
    scoreKey: `${runId}_route_score`,
    name: 'Runtime Route Score',
    subjectType: 'route',
    status: 'active'
  });
  const version = await fiss.createModelVersion(orgA, model.id, {
    status: 'active',
    componentWeights: { safety: 0.25, efficiency: 0.25, reliability: 0.2, risk: 0.15, compliance: 0.05, performance: 0.1 },
    formulaNotes: 'Runtime validation weighted component model.',
    effectiveFrom: periodStart
  });
  assert(version.version === 1, 'first model version should be v1');

  await logistics.ingestEvent(orgA, {
    eventType: 'route_delay',
    eventCategory: 'route_execution',
    sourceType: 'fiss_runtime',
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    routeId: `${runId}-route-1`,
    occurredAt: periodStart,
    idempotencyKey: `${runId}-route-delay`,
    payload: { delayMinutes: 38, severity: 'high' }
  });
  await logistics.ingestEvent(orgA, {
    eventType: 'hazard_encountered',
    eventCategory: 'safety',
    sourceType: 'fiss_runtime',
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    routeId: `${runId}-route-1`,
    occurredAt: periodStart,
    idempotencyKey: `${runId}-hazard`,
    payload: { hazardType: 'low_bridge', severity: 'high' }
  });
  await logistics.processIntelligence(supervisor, { limit: 20 });

  const snapshot = await fiss.calculateScore(supervisor, model.id, {
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    periodStart,
    periodEnd,
    calculationRunKey: `${runId}-score`
  });
  assert(snapshot.scoreValue >= 0 && snapshot.scoreValue <= 100, 'score should be bounded 0-100');
  assert(snapshot.scoreModelVersionId === version.id, 'snapshot must lock model version');
  assert(snapshot.lineage?.logisticsIntelligence?.signalIds?.length >= 2, 'snapshot must preserve Logistics Intelligence signal lineage');
  assert(snapshot.explanation?.largestContributors?.length > 0, 'snapshot must explain largest contributors');

  const duplicate = await fiss.calculateScore(supervisor, model.id, {
    subjectType: 'route',
    subjectId: `${runId}-route-1`,
    periodStart,
    periodEnd,
    calculationRunKey: `${runId}-score`
  });
  assert(duplicate.id === snapshot.id, 'score calculation must be idempotent by Organization and run key');

  const detail = await fiss.getScoreSnapshot(supervisor, snapshot.id);
  assert(detail.components.length >= 6, 'score detail must include component snapshots');

  let orgBBlocked = false;
  try {
    await fiss.getScoreSnapshot(orgB, snapshot.id);
  } catch (error) {
    orgBBlocked = error.status === 404;
  }
  assert(orgBBlocked, 'Organization B must not read Organization A score snapshot');

  let driverBlocked = false;
  try {
    await fiss.calculateScore(driver, model.id, {
      subjectType: 'route',
      subjectId: `${runId}-route-1`,
      calculationRunKey: `${runId}-driver-score`
    });
  } catch (error) {
    driverBlocked = error.status === 403;
  }
  assert(driverBlocked, 'Driver must not calculate fleet scores by default');

  let snapshotImmutable = false;
  try {
    await postgres.query('UPDATE fleet_score_snapshots SET score_value = 100 WHERE id = $1', [snapshot.id]);
  } catch {
    snapshotImmutable = true;
  }
  assert(snapshotImmutable, 'score snapshots must be immutable');

  let versionImmutable = false;
  try {
    await postgres.query('UPDATE fleet_score_model_versions SET component_weights = $2::jsonb WHERE id = $1', [version.id, JSON.stringify({ safety: 1 })]);
  } catch {
    versionImmutable = true;
  }
  assert(versionImmutable, 'active score model versions must be immutable');

  const benchmark = await fiss.createBenchmarkSet(supervisor, {
    name: 'Runtime Private Benchmark',
    subjectType: 'route',
    periodStart,
    periodEnd,
    populationSize: 1,
    metrics: { medianScore: snapshot.scoreValue }
  });
  assert(benchmark.benchmark_scope === 'organization_private', 'benchmark must remain Organization-private by default');
  assert(benchmark.anonymization_status === 'not_shared', 'benchmark must not become shared without approval');

  console.log('[fiss-runtime] isolated database Fleet Intelligence Scoring checks passed');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
