const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[bi-kpi] ${message}`);
}

function assertContains(content, pattern, message) {
  assert(content.includes(pattern), `${message}: missing ${pattern}`);
}

const migration = read('migrations/006_bi_kpi_foundation.sql');
const service = read('services/biKpi.js');
const routes = read('routes/biKpi.js');
const rbac = read('services/rbac.js');
const auth = read('middleware/authorization.js');
const server = read('server.js');
const dashboard = read('routes/adminDashboard.js');
const packageJson = JSON.parse(read('package.json'));

[
  'CREATE TABLE IF NOT EXISTS kpi_definitions',
  'CREATE TABLE IF NOT EXISTS kpi_formula_versions',
  'CREATE TABLE IF NOT EXISTS kpi_snapshots',
  'CREATE TABLE IF NOT EXISTS bi_dashboards',
  'CREATE TABLE IF NOT EXISTS bi_dashboard_widgets',
  'CREATE TABLE IF NOT EXISTS kpi_alert_rules',
  'CREATE TABLE IF NOT EXISTS kpi_alert_events',
  'CREATE TABLE IF NOT EXISTS kpi_calculation_jobs',
  'organization_id TEXT NOT NULL REFERENCES organizations(id)',
  'prevent_kpi_snapshot_mutation',
  'prevent_active_formula_version_mutation',
  'UNIQUE INDEX IF NOT EXISTS kpi_snapshots_run_key_idx'
].forEach((pattern) => assertContains(migration, pattern, 'BI/KPI migration contract'));

[
  "KPI_VIEW: 'kpi.view'",
  "KPI_MANAGE: 'kpi.manage'",
  "KPI_FORMULA_MANAGE: 'kpi.formula.manage'",
  "KPI_CALCULATE: 'kpi.calculate'",
  "KPI_SNAPSHOT_VIEW: 'kpi.snapshot.view'",
  "DASHBOARD_EXPORT: 'dashboard.export'",
  "KPI_ALERT_MANAGE: 'kpi.alert.manage'",
  "PLATFORM_KPI_SUPPORT: 'platform.kpi.support'"
].forEach((pattern) => assertContains(rbac, pattern, 'BI/KPI permissions'));

[
  'function evaluateFormula',
  'ALLOWED_FORMULA_OPERATIONS',
  "'ratio'",
  "'percentage'",
  "'weighted_score'",
  "'threshold_score'",
  "'conditional'",
  'DIVISION_BY_ZERO',
  'KPI_INPUT_MISSING',
  'createKpiDefinition',
  'createFormulaVersion',
  'calculateKpi',
  'listSnapshots',
  'exportSnapshotsCsv',
  'createAlertIfNeeded'
].forEach((pattern) => assertContains(service, pattern, 'BI/KPI service contract'));

assert(!/\beval\s*\(/.test(service), 'Formula engine must not use eval().');
assert(!/new Function\s*\(/.test(service), 'Formula engine must not use new Function().');
assertContains(service, 'requireOrganizationContext(context)', 'Service must resolve trusted Organization context');
assertContains(service, 'organization_id = $1', 'Service queries must be tenant scoped');

[
  "router.get('/admin'",
  "router.get('/catalog'",
  "router.get('/definitions'",
  "router.post('/definitions'",
  "router.post('/definitions/:id/formulas'",
  "router.post('/definitions/:id/calculate'",
  "router.get('/snapshots'",
  "router.get('/dashboards'",
  "router.post('/dashboards'",
  "router.post('/dashboards/:id/widgets'",
  "router.post('/alerts/rules'",
  "router.get('/alerts'",
  "router.get('/export.csv'",
  'requireAdminCsrfIfCookie',
  "req.authContext.actorType !== 'admin_user'",
  'requireJsonMutation'
].forEach((pattern) => assertContains(routes, pattern, 'BI/KPI route contract'));

assertContains(server, "const biKpiRoutes = require('./routes/biKpi')", 'BI/KPI route import');
assertContains(server, "app.use('/api/bi-kpi', biKpiRoutes)", 'BI/KPI route mount');
assertContains(auth, "path.startsWith('/api/bi-kpi')", 'BI/KPI private-by-default permission mapping');
assertContains(dashboard, 'BI/KPI Foundation', 'Admin dashboard link');
assertContains(packageJson.scripts.test, 'test:bi-kpi', 'Full test suite must include BI/KPI contracts');
assert(packageJson.scripts['validate:bi-kpi'], 'Runtime BI/KPI validation script must be defined.');

console.log('[test:bi-kpi] foundation schema, service, route, permission, and regression contracts verified.');
