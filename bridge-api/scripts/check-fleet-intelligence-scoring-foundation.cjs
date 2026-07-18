const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`[fiss] ${message}`);
}

function assertContains(content, pattern, message) {
  assert(content.includes(pattern), `${message}: missing ${pattern}`);
}

const migration = read('migrations/008_fleet_intelligence_scoring_foundation.sql');
const service = read('services/fleetIntelligenceScoring.js');
const routes = read('routes/fleetIntelligenceScoring.js');
const rbac = read('services/rbac.js');
const auth = read('middleware/authorization.js');
const server = read('server.js');
const dashboard = read('routes/adminDashboard.js');
const packageJson = JSON.parse(read('package.json'));
const docsDir = path.join(repoRoot, 'docs', 'implementation', 'fleet-intelligence-scoring-foundation');

[
  'CREATE TABLE IF NOT EXISTS fleet_score_models',
  'CREATE TABLE IF NOT EXISTS fleet_score_model_versions',
  'CREATE TABLE IF NOT EXISTS fleet_score_snapshots',
  'CREATE TABLE IF NOT EXISTS fleet_score_component_snapshots',
  'CREATE TABLE IF NOT EXISTS fleet_score_benchmark_sets',
  'prevent_active_fleet_score_model_version_mutation',
  'prevent_fleet_score_snapshot_mutation',
  'fleet_score_snapshots_run_key_idx',
  'organization_id TEXT NOT NULL REFERENCES organizations(id)',
  'ON DELETE RESTRICT'
].forEach((pattern) => assertContains(migration, pattern, 'migration contract'));

[
  "FLEET_SCORE_VIEW: 'fleet_score.view'",
  "FLEET_SCORE_MANAGE: 'fleet_score.manage'",
  "FLEET_SCORE_CALCULATE: 'fleet_score.calculate'",
  "FLEET_SCORE_BENCHMARK: 'fleet_score.benchmark'",
  "PLATFORM_FLEET_SCORE_SUPPORT: 'platform.fleet_score.support'"
].forEach((pattern) => assertContains(rbac, pattern, 'RBAC permissions'));

[
  'ENGINE_VERSION',
  'SUBJECT_TYPES',
  'DEFAULT_COMPONENT_WEIGHTS',
  'createScoreModel',
  'createModelVersion',
  'calculateScore',
  'sourceRows',
  'logistics_signals',
  'logistics_findings',
  'logistics_recommendations',
  'logistics_outcomes',
  'getScoreSnapshot',
  'createBenchmarkSet',
  'requireOrganizationContext(context)',
  'organization_id = $1'
].forEach((pattern) => assertContains(service, pattern, 'service contract'));

assert(!/\beval\s*\(/.test(service), 'FISS service must not use eval().');
assert(!/new Function\s*\(/.test(service), 'FISS service must not use new Function().');
assert(!/accepted.*UPDATE daily_route|UPDATE daily_route|UPDATE logistics_recommendations SET status/.test(service), 'FISS must not auto-execute operational changes.');

[
  "router.get('/admin'",
  "router.get('/catalog'",
  "router.get('/models'",
  "router.post('/models'",
  "router.post('/models/:id/versions'",
  "router.post('/models/:id/calculate'",
  "router.get('/snapshots'",
  "router.get('/snapshots/:id'",
  "router.post('/benchmarks'",
  'requireAdminCsrfIfCookie',
  'requireJsonMutation'
].forEach((pattern) => assertContains(routes, pattern, 'route contract'));

assertContains(server, "const fleetIntelligenceScoringRoutes = require('./routes/fleetIntelligenceScoring')", 'server route import');
assertContains(server, "app.use('/api/fleet-intelligence-scoring', fleetIntelligenceScoringRoutes)", 'server route mount');
assertContains(auth, "path.startsWith('/api/fleet-intelligence-scoring')", 'private-by-default API mapping');
assertContains(dashboard, 'Fleet Intelligence Scoring Foundation', 'admin dashboard card');
assertContains(packageJson.scripts.test, 'test:fleet-intelligence-scoring', 'full test suite must include FISS contracts');
assert(packageJson.scripts['validate:fleet-intelligence-scoring'], 'runtime FISS validation script must be defined.');

const requiredDocs = [
  'README.md',
  'SCORE_MODEL.md',
  'MODEL_VERSIONING.md',
  'SCORING_INPUTS.md',
  'EXPLAINABILITY_AND_LINEAGE.md',
  'TENANT_ISOLATION.md',
  'AUTHORIZATION_PERMISSIONS.md',
  'BENCHMARKING.md',
  'DATABASE_MIGRATION.md',
  'TEST_RESULTS.md',
  'ROLLBACK_PROCEDURE.md',
  'REMAINING_WORK.md'
];
for (const file of requiredDocs) {
  assert(fs.existsSync(path.join(docsDir, file)), `required implementation doc missing: ${file}`);
}

console.log('[test:fleet-intelligence-scoring] foundation schema, service, route, permission, and documentation contracts verified.');
