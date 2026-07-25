const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const intelligence = require('../services/intelligenceExecution');
const { buildResponse, normalizeRequest } = require('../services/intelligenceExecution/contracts');
const { createExecutionPlan } = require('../services/intelligenceExecution/planner');
const { evaluatePolicy } = require('../services/intelligenceExecution/policyEngine');
const { getProfile } = require('../services/intelligenceExecution/profiles');
const { getCapability } = require('../services/intelligenceExecution/capabilityRegistry');
const { EXECUTION_PROFILES, EXECUTION_STRATEGIES, MODEL_CLASSES } = require('../services/intelligenceExecution/constants');
const { validateTextCleanupOutput } = require('../services/intelligenceExecution/outputValidator');
const { normalizeProviderError } = require('../services/intelligenceExecution/errors');
const { microsToUsdString, parseUsdToMicros } = require('../services/intelligenceExecution/money');
const rbac = require('../services/rbac');
const tenant = require('../services/tenantContext');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function auth(overrides = {}) {
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: 'iep-test-user',
    organizationId: 'iep-org-a',
    approvedRole: rbac.ROLES.SUPERVISOR,
    permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR),
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    capability: 'text.cleanup',
    taskType: 'TRANSFORM',
    input: { text: '  hello   world\r\n\r\n\r\n  done  ' },
    maximumCostUsd: '0.000000',
    allowHostedInference: false,
    allowPremiumEscalation: false,
    idempotencyKey: 'iep-test-key',
    ...overrides
  };
}

async function assertRejectsCode(fn, code) {
  let rejected = false;
  try {
    await fn();
  } catch (error) {
    rejected = true;
    assert.strictEqual(error.code, code, `expected ${code}, got ${error.code}`);
  }
  assert(rejected, `expected rejection ${code}`);
}

async function main() {
  const normalized = normalizeRequest(request(), auth());
  assert.strictEqual(normalized.organizationId, 'iep-org-a', 'trusted Organization context must come from auth');
  assert.strictEqual(normalized.schemaVersion, 'intelligence.request.v1');
  assert.strictEqual(normalized.userRole, rbac.ROLES.SUPERVISOR);

  assert.throws(() => normalizeRequest(request(), auth({ organizationId: null })), /Organization context is required/);
  assert.throws(() => normalizeRequest(request({ capability: '' }), auth()), /capability is required/);
  assert.throws(() => normalizeRequest(request({ maximumCostUsd: '-0.01' }), auth()), /maximumCostUsd must be/);
  assert.throws(() => normalizeRequest(request({ maximumCostUsd: '0.0000001' }), auth()), /maximumCostUsd must be/);
  assert.throws(() => normalizeRequest(request({ maximumCostUsd: 'not-money' }), auth()), /maximumCostUsd must be/);

  const spoofed = normalizeRequest(
    request({ organizationId: 'spoofed-org', userId: 'spoofed-user', userRole: 'PLATFORM_ADMIN' }),
    auth({ organizationId: 'trusted-org', actorId: 'trusted-user', approvedRole: rbac.ROLES.SUPERVISOR })
  );
  assert.strictEqual(spoofed.organizationId, 'trusted-org', 'client-supplied organizationId must not override trusted context');
  assert.strictEqual(spoofed.userId, 'trusted-user', 'client-supplied userId must not override trusted context');
  assert.strictEqual(spoofed.userRole, rbac.ROLES.SUPERVISOR, 'client-supplied userRole must not override trusted context');

  const capability = getCapability('text.cleanup');
  assert(capability.active, 'text.cleanup must be active');
  assert.strictEqual(getCapability('delivery_note.summarize').active, false, 'hosted demo capability must remain disabled');

  const profile = getProfile(EXECUTION_PROFILES.DETERMINISTIC_ONLY);
  const policy = evaluatePolicy(normalized, capability, profile, auth());
  assert.strictEqual(policy.allowed, true, 'policy should allow deterministic text cleanup');
  assert(policy.approvedStrategies.includes(EXECUTION_STRATEGIES.DETERMINISTIC_RULES));
  assert(!policy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL));

  const plan = createExecutionPlan(normalized, capability, profile, policy);
  assert.strictEqual(plan.selectedStrategy, EXECUTION_STRATEGIES.DETERMINISTIC_RULES, 'planner must choose deterministic first');
  assert.strictEqual(plan.selectedProviderAdapter, null, 'business request must not select provider');
  assert.strictEqual(plan.selectedModelClass, null, 'deterministic request must not select model class');
  assert(plan.rejectedStrategies.some((entry) => entry.strategy === EXECUTION_STRATEGIES.CACHE), 'cache must be considered before deterministic execution');

  const outputErrors = validateTextCleanupOutput({ normalizedText: 'ok', changed: true, originalLength: 4, normalizedLength: 2 });
  assert.deepStrictEqual(outputErrors, [], 'valid deterministic output should pass schema validation');
  assert(validateTextCleanupOutput({ normalizedText: '', changed: 'yes' }).length >= 2, 'invalid output must be rejected');

  const response = await intelligence.execute(auth(), request());
  assert.strictEqual(response.status, 'SUCCEEDED');
  assert.strictEqual(response.executionStrategy, EXECUTION_STRATEGIES.DETERMINISTIC_RULES);
  assert.strictEqual(response.provider, null);
  assert.strictEqual(response.model, null);
  assert.strictEqual(response.modelClass, null);
  assert.strictEqual(response.estimatedCostUsd, '0.000000');
  assert.strictEqual(response.output.normalizedText, 'hello world\n\ndone');
  assert.strictEqual(response.cacheStatus, 'MISS');
  assert(response.validationResults[0].status === 'PASS');

  await assertRejectsCode(() => intelligence.execute(auth(), request({ capability: 'delivery_note.summarize', allowHostedInference: true })), 'INTELLIGENCE_POLICY_DENIED');
  await assertRejectsCode(() => intelligence.execute(auth({ permissions: [] }), request()), 'INTELLIGENCE_POLICY_DENIED');
  await assertRejectsCode(() => intelligence.execute(auth(), request({ capability: 'text.cleanup', input: { text: '   ' } })), 'TEXT_CLEANUP_EMPTY');
  await assertRejectsCode(() => intelligence.execute(auth(), request({ capability: 'unknown.capability' })), 'INTELLIGENCE_POLICY_DENIED');
  await assertRejectsCode(() => intelligence.execute(auth(), request({ maximumCostUsd: '-1' })), 'INVALID_INTELLIGENCE_COST_CEILING');

  const premiumRequest = normalizeRequest(request({ allowHostedInference: true, allowPremiumEscalation: true, maximumCostUsd: '0.000001' }), auth());
  const premiumPolicy = evaluatePolicy(premiumRequest, capability, getProfile(EXECUTION_PROFILES.PREMIUM_APPROVAL_REQUIRED), auth());
  assert(!premiumPolicy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL), 'caller cannot force premium model');

  const restricted = normalizeRequest(request({ dataSensitivity: 'RESTRICTED', allowHostedInference: true }), auth());
  const restrictedPolicy = evaluatePolicy(restricted, capability, getProfile(EXECUTION_PROFILES.PRIVACY_RESTRICTED), auth());
  assert.strictEqual(restrictedPolicy.organizationPolicy.allowHostedInference, false, 'hosted inference disabled by conservative policy');

  assert.strictEqual(parseUsdToMicros('1.000001'), 1000001n, 'money parsing must preserve micro-USD precision');
  assert.strictEqual(microsToUsdString(1000001n), '1.000001', 'money formatting must preserve micro-USD precision');
  assert.strictEqual(parseUsdToMicros('-1'), null, 'negative cost must be rejected by parser');
  assert.strictEqual(parseUsdToMicros('0.0000001'), null, 'over-precision cost must be rejected by parser');

  assert.strictEqual(MODEL_CLASSES.HOSTED_ECONOMY, 'HOSTED_ECONOMY', 'model class abstraction must exist');
  const providerError = normalizeProviderError({ code: 'rate_limit', message: 'raw provider failed', retryable: true, providerStatus: 429 }, 'openai');
  assert.deepStrictEqual(providerError.provider, 'openai');
  assert.strictEqual(providerError.retryable, true);

  const orgAKey = tenant.scopedCacheKey({ organizationId: 'iep-org-a' }, ['text.cleanup', 'hash']);
  const orgBKey = tenant.scopedCacheKey({ organizationId: 'iep-org-b' }, ['text.cleanup', 'hash']);
  assert.notStrictEqual(orgAKey, orgBKey, 'cache keys must be tenant isolated');

  assert(response.escalationPath.length <= 1, 'escalation must be finite');
  assert(response.fallbackPath.length <= 1, 'fallback must be finite');
  assert.strictEqual(response.actualCostUsd, '0.000000', 'deterministic actual cost should be zero');

  const unknownCostResponse = buildResponse(normalized, plan, { status: 'SUCCEEDED', output: response.output, confidence: 'unavailable' }, { latencyMs: 1 });
  assert.strictEqual(unknownCostResponse.estimatedCostUsd, null, 'unknown cost must not default to zero');

  const migration = read('migrations/012_intelligence_execution_foundation.sql');
  [
    'CREATE TABLE IF NOT EXISTS intelligence_requests',
    'CREATE TABLE IF NOT EXISTS intelligence_execution_attempts',
    'CREATE TABLE IF NOT EXISTS intelligence_usage_records',
    'CREATE TABLE IF NOT EXISTS intelligence_policy_versions',
    'CREATE TABLE IF NOT EXISTS intelligence_prompt_versions',
    'organization_id TEXT NOT NULL REFERENCES organizations(id)',
    'intelligence_requests_org_idempotency_idx'
  ].forEach((pattern) => assert(migration.includes(pattern), `migration missing ${pattern}`));

  const service = read('services/intelligenceExecution/index.js');
  const planner = read('services/intelligenceExecution/planner.js');
  const route = read('routes/intelligence.js');
  const server = read('server.js');
  const authz = read('middleware/authorization.js');
  const packageJson = JSON.parse(read('package.json'));

  assert(service.includes('intelligence.request.received'), 'audit event emission must be implemented');
  assert(service.includes('intelligence.request.rejected'), 'request rejection audit event must be implemented');
  assert(service.includes('intelligence.human_review.required'), 'human review audit event must be implemented');
  assert(service.includes('intelligence.budget.denied'), 'budget denial audit event hook must be implemented');
  assert(service.includes('intelligence.execution.completed'), 'completion audit event must be implemented');
  assert(planner.includes('Lowest-cost registered strategy'), 'planner must document deterministic cost-first selection');
  assert(route.includes("router.post('/execute'"), 'internal execute route must exist');
  assert(!route.includes("router.get('/requests"), 'no cross-tenant execution-record retrieval endpoint should exist in foundation');
  assert(!route.includes('provider') || route.includes('providerAdapters'), 'route must not expose raw provider selection');
  assert(server.includes("app.use('/api/intelligence', intelligenceRoutes)"), 'server must mount intelligence route');
  assert(authz.includes("path.startsWith('/api/intelligence')"), 'authorization must protect intelligence route');
  assert(packageJson.scripts['test:intelligence-execution'], 'package script must include intelligence execution test');

  const docsDir = path.join(repoRoot, 'docs', 'implementation', 'intelligence-execution-platform-foundation');
  [
    'README.md',
    'CURRENT_STATE_AUDIT.md',
    'ARCHITECTURE_DECISION.md',
    'INTELLIGENCE_REQUEST_CONTRACT.md',
    'INTELLIGENCE_RESPONSE_CONTRACT.md',
    'CAPABILITY_REGISTRY.md',
    'EXECUTION_STRATEGIES.md',
    'EXECUTION_PROFILES.md',
    'POLICY_ENGINE.md',
    'EXECUTION_PLANNER.md',
    'PROVIDER_ADAPTER_ARCHITECTURE.md',
    'COST_ACCOUNTING_FOUNDATION.md',
    'ESCALATION_AND_FALLBACK.md',
    'SECURITY_AND_TENANT_ISOLATION.md',
    'DATABASE_CHANGE_PLAN.md',
    'TEST_PLAN.md',
    'IMPLEMENTATION_REPORT.md',
    'DEFERRED_WORK.md',
    'OWNER_DECISIONS_REQUIRED.md',
    'ROLLBACK_PLAN.md',
    'FOUNDATION_VERIFICATION_REPORT.md'
  ].forEach((file) => assert(fs.existsSync(path.join(docsDir, file)), `missing doc ${file}`));

  assert(readRepo('PROJECT_STATUS.md').includes('Private R2 hardening | Complete'), 'Private R2 completion status must remain intact');
  console.log('[test:intelligence-execution] foundation contracts, planner, policy, deterministic execution, security, and docs verified.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});