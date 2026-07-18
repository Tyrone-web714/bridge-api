require('dotenv').config();

const postgres = require('../db/postgres');
const biKpi = require('../services/biKpi');
const rbac = require('../services/rbac');

function assert(condition, message) {
  if (!condition) throw new Error(`[bi-kpi-runtime] ${message}`);
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
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const formulaEffectiveFrom = new Date(now - 4 * dayMs).toISOString();
  const routePeriodOneStart = new Date(now - 3 * dayMs).toISOString();
  const routePeriodOneEnd = new Date(now - 2 * dayMs).toISOString();
  const routePeriodTwoStart = new Date(now - 2 * dayMs).toISOString();
  const routePeriodTwoEnd = new Date(now - dayMs).toISOString();
  const routePeriodThreeStart = new Date(now - dayMs).toISOString();
  const routePeriodThreeEnd = new Date(now).toISOString();

  await seedOrganization('demo-fleet-a', 'Demo Fleet A');
  await seedOrganization('demo-fleet-b', 'Demo Fleet B');

  const orgA = context();
  const orgB = context({ organizationId: 'demo-fleet-b', actorId: 'runtime-org-b-admin' });
  const supervisor = context({ approvedRole: rbac.ROLES.SUPERVISOR, actorId: 'runtime-supervisor' });
  const driver = context({ approvedRole: rbac.ROLES.DRIVER, actorId: 'runtime-driver' });

  const definition = await biKpi.createKpiDefinition(orgA, {
    key: `route_completion_${Date.now()}`,
    name: 'Runtime Route Completion',
    category: 'route_completion',
    unit: 'percent',
    direction: 'higher_is_better',
    status: 'active'
  });

  const formula = await biKpi.createFormulaVersion(orgA, definition.id, {
    status: 'active',
    expression: {
      op: 'percentage',
      numerator: { op: 'input', name: 'completed_stops' },
      denominator: { op: 'input', name: 'planned_stops' },
      onZero: 'zero'
    },
    inputDefinitions: [
      { name: 'completed_stops', unit: 'count' },
      { name: 'planned_stops', unit: 'count' }
    ],
    thresholds: { good: 95, warning: 80, critical: 60 },
    roundingRules: { decimals: 2 },
    effectiveFrom: formulaEffectiveFrom
  });
  assert(formula.version === 1, 'first formula version should be v1');

  const snapshot = await biKpi.calculateKpi(orgA, definition.id, {
    subjectType: 'route',
    subjectId: 'runtime-route-1',
    periodStart: routePeriodOneStart,
    periodEnd: routePeriodOneEnd,
    inputs: { completed_stops: 9, planned_stops: 10 },
    calculationRunKey: `runtime-${definition.id}-route-1`
  });
  assert(snapshot.calculatedValue === 90, 'percentage formula should calculate 90');
  assert(snapshot.formulaVersionId === formula.id, 'snapshot must store formula version id');
  assert(snapshot.explanationTrace?.steps?.length > 0, 'snapshot must store calculation trace');

  const zero = biKpi.evaluateFormula({
    id: 'zero-formula',
    version: 1,
    expression: {
      op: 'percentage',
      numerator: { op: 'input', name: 'completed' },
      denominator: { op: 'input', name: 'planned' },
      onZero: 'zero'
    },
    roundingRules: { decimals: 2 },
    thresholds: {}
  }, { completed: 0, planned: 0 });
  assert(zero.calculatedValue === 0, 'division-by-zero onZero=zero should be safe');

  let arbitraryBlocked = false;
  try {
    biKpi.evaluateFormula({ expression: { op: 'eval', code: 'process.exit(1)' } }, {});
  } catch (error) {
    arbitraryBlocked = error.code === 'UNSUPPORTED_FORMULA_OPERATION';
  }
  assert(arbitraryBlocked, 'arbitrary formula operations must be rejected');

  let orgBBlocked = false;
  try {
    await biKpi.getKpiDefinition(orgB, definition.id);
  } catch (error) {
    orgBBlocked = error.status === 404;
  }
  assert(orgBBlocked, 'Organization B must not read Organization A KPI definition');

  let driverBlocked = false;
  try {
    await biKpi.calculateKpi(driver, definition.id, {
      inputs: { completed_stops: 1, planned_stops: 1 }
    });
  } catch (error) {
    driverBlocked = error.status === 403;
  }
  assert(driverBlocked, 'Driver must not calculate Organization KPIs by default');

  const dashboard = await biKpi.createDashboard(orgA, {
    name: 'Runtime KPI Dashboard',
    audiencePermission: rbac.PERMISSIONS.DASHBOARD_VIEW
  });
  const widget = await biKpi.addDashboardWidget(orgA, dashboard.id, {
    kpiDefinitionId: definition.id,
    visualizationType: 'card',
    displayOrder: 1
  });
  assert(widget.dashboardId === dashboard.id, 'dashboard widget should be created');
  const visibleDashboard = await biKpi.getDashboard(supervisor, dashboard.id);
  assert(visibleDashboard.widgets.length === 1, 'supervisor should see permitted dashboard widget');

  await biKpi.createAlertRule(orgA, {
    kpiDefinitionId: definition.id,
    severity: 'warning',
    targetPermission: rbac.PERMISSIONS.DASHBOARD_VIEW
  });
  const criticalSnapshot = await biKpi.calculateKpi(orgA, definition.id, {
    subjectType: 'route',
    subjectId: 'runtime-route-2',
    periodStart: routePeriodTwoStart,
    periodEnd: routePeriodTwoEnd,
    inputs: { completed_stops: 5, planned_stops: 10 },
    calculationRunKey: `runtime-${definition.id}-route-2`
  });
  assert(criticalSnapshot.thresholdStatus === 'critical', 'critical threshold should be evaluated');
  const alerts = await biKpi.listAlerts(supervisor, { status: 'open' });
  assert(alerts.some((alert) => alert.kpi_snapshot_id === criticalSnapshot.id), 'threshold alert should be created once');

  const csv = await biKpi.exportSnapshotsCsv(supervisor, { kpiDefinitionId: definition.id, limit: 20 });
  assert(csv.includes('snapshot_id,kpi_definition_id'), 'CSV export should include bounded header');
  assert(csv.includes(snapshot.id), 'CSV export should include tenant-scoped snapshot');

  let snapshotImmutable = false;
  try {
    await postgres.query('UPDATE kpi_snapshots SET calculated_value = 1 WHERE id = $1', [snapshot.id]);
  } catch {
    snapshotImmutable = true;
  }
  assert(snapshotImmutable, 'KPI snapshots must be immutable');

  let formulaImmutable = false;
  try {
    await postgres.query('UPDATE kpi_formula_versions SET expression = $2::jsonb WHERE id = $1', [formula.id, JSON.stringify({ op: 'constant', value: 1 })]);
  } catch {
    formulaImmutable = true;
  }
  assert(formulaImmutable, 'Active formula versions must be immutable');

  const recalculated = await biKpi.calculateKpi(orgA, definition.id, {
    subjectType: 'route',
    subjectId: 'runtime-route-1',
    periodStart: routePeriodThreeStart,
    periodEnd: routePeriodThreeEnd,
    inputs: { completed_stops: 10, planned_stops: 10 },
    calculationRunKey: `runtime-${definition.id}-route-1-recalc`
  });
  assert(recalculated.id !== snapshot.id, 'explicit recalculation should create a new snapshot');
  assert(recalculated.formulaVersionId === formula.id, 'recalculation should still lock formula version');

  console.log('[bi-kpi-runtime] isolated database BI/KPI checks passed');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
