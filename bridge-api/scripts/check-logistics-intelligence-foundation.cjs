const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[logistics-intelligence] ${message}`);
}

function assertContains(content, pattern, message) {
  assert(content.includes(pattern), `${message}: missing ${pattern}`);
}

const migration = read('migrations/007_logistics_intelligence_foundation.sql');
const service = read('services/logisticsIntelligence.js');
const routes = read('routes/logisticsIntelligence.js');
const rbac = read('services/rbac.js');
const auth = read('middleware/authorization.js');
const server = read('server.js');
const dashboard = read('routes/adminDashboard.js');
const packageJson = JSON.parse(read('package.json'));
const docsDir = path.join(repoRoot, 'docs', 'implementation', 'logistics-intelligence-foundation');

[
  'CREATE TABLE IF NOT EXISTS logistics_events',
  'CREATE TABLE IF NOT EXISTS logistics_signals',
  'CREATE TABLE IF NOT EXISTS logistics_findings',
  'CREATE TABLE IF NOT EXISTS logistics_recommendations',
  'CREATE TABLE IF NOT EXISTS logistics_decisions',
  'CREATE TABLE IF NOT EXISTS logistics_outcomes',
  'organization_id TEXT NOT NULL REFERENCES organizations(id)',
  'logistics_events_org_idempotency_idx',
  'logistics_signals_org_run_key_idx',
  'logistics_findings_org_run_key_idx',
  'logistics_recommendations_org_run_key_idx',
  'ON DELETE RESTRICT'
].forEach((pattern) => assertContains(migration, pattern, 'migration contract'));

[
  "INTELLIGENCE_VIEW: 'intelligence.view'",
  "INTELLIGENCE_REVIEW: 'intelligence.review'",
  "INTELLIGENCE_MANAGE: 'intelligence.manage'",
  "RECOMMENDATION_VIEW: 'recommendation.view'",
  "RECOMMENDATION_DECIDE: 'recommendation.decide'",
  "OUTCOME_RECORD: 'outcome.record'",
  "PLATFORM_INTELLIGENCE_SUPPORT: 'platform.intelligence.support'"
].forEach((pattern) => assertContains(rbac, pattern, 'RBAC permissions'));

[
  'EVENT_CATALOG',
  'FINDING_RULES',
  'ingestEvent',
  'runSignalDetection',
  'runFindingDetection',
  'runRecommendationGeneration',
  'processIntelligence',
  'decideRecommendation',
  'recordOutcome',
  'requireOrganizationContext(context)',
  'organization_id = $1',
  'ON CONFLICT (organization_id, run_key)'
].forEach((pattern) => assertContains(service, pattern, 'service contract'));

assert(!/\beval\s*\(/.test(service), 'Logistics Intelligence service must not use eval().');
assert(!/new Function\s*\(/.test(service), 'Logistics Intelligence service must not use new Function().');
assert(!/ODR-019/.test(service + routes + migration), 'ODR-019 Data Lifecycle must not be implemented in source code.');
assert(!/ODR-020/.test(service + routes + migration), 'ODR-020 Enterprise Identity must not be implemented in source code.');

[
  "router.get('/admin'",
  "router.get('/catalog'",
  "router.post('/events'",
  "router.get('/events'",
  "router.post('/signals/run'",
  "router.post('/process'",
  "router.get('/signals'",
  "router.get('/findings'",
  "router.get('/recommendations'",
  "router.post('/recommendations/:id/decisions'",
  "router.post('/recommendations/:id/outcomes'",
  "router.get('/outcomes'",
  'requireAdminCsrfIfCookie',
  'requireJsonMutation'
].forEach((pattern) => assertContains(routes, pattern, 'route contract'));

assertContains(server, "const logisticsIntelligenceRoutes = require('./routes/logisticsIntelligence')", 'server route import');
assertContains(server, "app.use('/api/logistics-intelligence', logisticsIntelligenceRoutes)", 'server route mount');
assertContains(auth, "path.startsWith('/api/logistics-intelligence')", 'private-by-default API mapping');
assertContains(dashboard, 'Logistics Intelligence Foundation', 'admin dashboard card');
assertContains(packageJson.scripts.test, 'test:logistics-intelligence', 'full test suite must include Logistics Intelligence');
assert(packageJson.scripts['validate:logistics-intelligence'], 'runtime validation script must be defined.');

const requiredDocs = [
  'README.md',
  'CURRENT_INTELLIGENCE_INVENTORY.md',
  'LOGISTICS_EVENT_MODEL.md',
  'SIGNAL_MODEL.md',
  'FINDING_MODEL.md',
  'RECOMMENDATION_MODEL.md',
  'DECISION_CENTER.md',
  'OUTCOME_TRACKING.md',
  'EXPLAINABILITY_AND_LINEAGE.md',
  'BI_KPI_INTEGRATION.md',
  'SHARED_SAFETY_INTEGRATION.md',
  'AUTHORIZATION_PERMISSIONS.md',
  'TENANT_ISOLATION.md',
  'SCHEDULED_PROCESSING.md',
  'AUDIT_EVENTS.md',
  'DATA_LIFECYCLE_CLASSIFICATION.md',
  'DATABASE_MIGRATION.md',
  'TEST_RESULTS.md',
  'ROLLBACK_PROCEDURE.md',
  'REMAINING_LOGISTICS_INTELLIGENCE_WORK.md'
];
for (const file of requiredDocs) {
  assert(fs.existsSync(path.join(docsDir, file)), `required implementation doc missing: ${file}`);
}

const baseline = readRepo('docs/architecture/ARCHITECTURE_GOVERNANCE_BASELINE_v1.1.md');
assertContains(baseline, 'ODR-019', 'governance baseline v1.1 should remain present');
assertContains(baseline, 'ODR-020', 'governance baseline v1.1 should remain present');

console.log('[test:logistics-intelligence] foundation schema, service, route, permission, and documentation contracts verified.');
