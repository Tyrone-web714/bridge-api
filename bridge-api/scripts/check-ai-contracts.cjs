const assert = require('assert');
const fs = require('fs');
const path = require('path');

const aiProvider = require('../services/aiProvider');
const aiRouter = require('../routes/ai');
const accountIntelligenceRouter = require('../routes/accountIntelligence');
const legacyAiAdapter = require('../services/intelligenceExecution/legacyAiAdapter');
const providerAdapters = require('../services/intelligenceExecution/providerAdapters');
const { getCapability } = require('../services/intelligenceExecution/capabilityRegistry');
const { normalizeRequest } = require('../services/intelligenceExecution/contracts');
const { evaluatePolicy } = require('../services/intelligenceExecution/policyEngine');
const { getProfile } = require('../services/intelligenceExecution/profiles');
const { createExecutionPlan } = require('../services/intelligenceExecution/planner');
const { EXECUTION_PROFILES, EXECUTION_STRATEGIES } = require('../services/intelligenceExecution/constants');
const rbac = require('../services/rbac');

const expectedRoutes = [
  'GET /status',
  'GET /operations',
  'GET /predictions',
  'POST /account-summary',
  'POST /driver-copilot',
  'POST /delivery-notes-summary',
  'POST /account-guidance',
  'POST /delivery-failure-risk',
  'POST /deduction-risk',
  'POST /supervisor-question',
  'POST /account-forecast',
  'POST /product-demand-forecast',
  'POST /route-completion-prediction',
  'POST /operational-heatmap',
  'POST /driver-coaching',
  'POST /incident-reconstruction',
  'POST /what-if-simulation',
  'POST /knowledge-graph-insights',
  'POST /unified-intelligence-dashboard',
  'POST /redelivery-plan',
  'POST /route-risk-explanation',
  'POST /supervisor-brief'
];

function listRouterContracts(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods)
      .filter((method) => layer.route.methods[method])
      .map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

function authContext(overrides = {}) {
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: 'ai-contract-admin',
    organizationId: 'trusted-org',
    approvedRole: rbac.ROLES.SUPERVISOR,
    role: rbac.ROLES.SUPERVISOR,
    permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR),
    ...overrides
  };
}

function assertProviderClassification() {
  const quota = aiProvider.classifyProviderFailure(429, {
    error: { code: 'insufficient_quota', message: 'Quota exceeded' }
  }, 'request-quota');
  assert.strictEqual(quota.code, 'ai_quota_exceeded');
  assert.strictEqual(quota.status, 503);
  assert.strictEqual(quota.retryable, false);
  assert.strictEqual(quota.requestId, 'request-quota');

  const rateLimit = aiProvider.classifyProviderFailure(429, {
    error: { code: 'rate_limit_exceeded' }
  });
  assert.strictEqual(rateLimit.code, 'ai_rate_limited');
  assert.strictEqual(rateLimit.retryable, true);

  const unavailable = aiProvider.classifyProviderFailure(500, {});
  assert.strictEqual(unavailable.code, 'ai_provider_unavailable');
  assert.strictEqual(unavailable.status, 503);
  assert.strictEqual(unavailable.retryable, true);

  const authentication = aiProvider.classifyProviderFailure(401, {});
  assert.strictEqual(authentication.code, 'ai_authentication_failed');
  assert.strictEqual(authentication.status, 503);
}

function assertCostEstimation() {
  const previousInputRate = process.env.OPENAI_INPUT_COST_PER_MILLION_USD;
  const previousOutputRate = process.env.OPENAI_OUTPUT_COST_PER_MILLION_USD;
  process.env.OPENAI_INPUT_COST_PER_MILLION_USD = '2';
  process.env.OPENAI_OUTPUT_COST_PER_MILLION_USD = '8';
  assert.strictEqual(aiProvider.estimateUsageCost({
    input_tokens: 1000,
    output_tokens: 500
  }), 0.006);
  if (previousInputRate === undefined) delete process.env.OPENAI_INPUT_COST_PER_MILLION_USD;
  else process.env.OPENAI_INPUT_COST_PER_MILLION_USD = previousInputRate;
  if (previousOutputRate === undefined) delete process.env.OPENAI_OUTPUT_COST_PER_MILLION_USD;
  else process.env.OPENAI_OUTPUT_COST_PER_MILLION_USD = previousOutputRate;
}

function assertSupervisorPageContracts() {
  const pagePath = path.join(__dirname, '..', 'routes', 'accountIntelligence.js');
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const supervisorEndpoints = expectedRoutes
    .filter((route) => route.startsWith('POST ') || route === 'GET /operations')
    .map((route) => `/api/ai${route.slice(route.indexOf(' ') + 1)}`)
    .filter((endpoint) => endpoint !== '/api/ai/driver-copilot');

  for (const endpoint of supervisorEndpoints) {
    assert(
      pageSource.includes(endpoint),
      `Supervisor page is missing the AI endpoint contract ${endpoint}`
    );
  }
}

async function assertLegacyIepMigration() {
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'ai.js'), 'utf8');
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const providerAdapterSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'intelligenceExecution', 'providerAdapters.js'), 'utf8');

  assert(!routeSource.includes("require('../services/aiProvider')"), 'legacy /api/ai route must not import aiProvider directly');
  assert(!routeSource.includes('aiProvider.createStructuredResponse'), 'legacy /api/ai route must not call aiProvider directly');
  assert(routeSource.includes('legacyAiAdapter.createStructuredResponse(req.authContext'), 'legacy /api/ai route must call the IEP legacy adapter');
  assert(!serverSource.includes("require('./services/aiProvider')"), 'readiness should use IEP legacy adapter status instead of direct aiProvider status');
  assert(providerAdapterSource.includes("require('../aiProvider')"), 'OpenAI implementation must be isolated inside the provider adapter');
  assert(providerAdapterSource.includes('aiProvider.createStructuredResponse'), 'provider adapter must reuse the existing OpenAI implementation');

  const capability = getCapability(legacyAiAdapter.LEGACY_AI_CAPABILITY);
  assert(capability, 'legacy AI capability must be registered');
  assert.strictEqual(capability.active, true, 'legacy AI capability must be active');
  assert.deepStrictEqual(capability.allowedExecutionStrategies, [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL]);

  const legacyRequest = legacyAiAdapter.buildIntelligenceRequest(authContext(), {
    endpoint: 'contract-test',
    instructions: 'Return the supplied object.',
    input: {
      prompt: 'hello',
      organizationId: 'spoofed-client-org',
      provider: 'evil-provider',
      model: 'premium-model',
      modelClass: 'HOSTED_PREMIUM',
      allowPremiumEscalation: true
    },
    schemaName: 'contract_test_schema',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { answer: { type: 'string' } },
      required: ['answer']
    }
  });
  const normalized = normalizeRequest(legacyRequest, authContext());
  assert.strictEqual(normalized.organizationId, 'trusted-org', 'trusted auth context must control organization');
  assert.strictEqual(normalized.userId, 'ai-contract-admin', 'trusted auth context must control user id');
  assert.strictEqual(normalized.userRole, rbac.ROLES.SUPERVISOR, 'trusted auth context must control role');
  assert.strictEqual(normalized.allowHostedInference, true, 'legacy adapter must request hosted inference for compatibility capability');
  assert.strictEqual(normalized.allowPremiumEscalation, false, 'legacy adapter must not allow premium escalation');
  assert.strictEqual(normalized.input.provider, undefined, 'client provider selection must not be copied to normalized legacy envelope');
  assert.strictEqual(normalized.input.model, undefined, 'client model selection must not be copied to normalized legacy envelope');
  assert.strictEqual(normalized.input.modelClass, undefined, 'client model class selection must not be copied to normalized legacy envelope');

  const profile = getProfile(EXECUTION_PROFILES.BALANCED);
  const policy = evaluatePolicy(normalized, capability, profile, authContext());
  assert.strictEqual(policy.allowed, true, 'policy must allow only the migrated hosted legacy capability');
  assert(policy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL));
  assert(!policy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL));
  assert.deepStrictEqual(policy.organizationPolicy.approvedProviders, ['openai']);
  assert.strictEqual(policy.organizationPolicy.allowPremiumModels, false);

  const plan = createExecutionPlan(normalized, capability, profile, policy);
  assert.strictEqual(plan.selectedStrategy, EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL);
  assert.strictEqual(plan.selectedProviderAdapter, 'openai');
  assert.strictEqual(plan.selectedModelClass, 'HOSTED_BALANCED');

  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProviderCall = aiProvider.createStructuredResponse;
  process.env.OPENAI_API_KEY = 'test-only-key';
  aiProvider.createStructuredResponse = async (options) => ({
    model: 'mock-existing-model',
    parsed: { answer: options.input.prompt || 'ok' },
    rawText: JSON.stringify({ answer: options.input.prompt || 'ok' }),
    requestId: 'mock-provider-request',
    usage: { input_tokens: 12, output_tokens: 6 },
    estimatedCostUsd: null,
    latencyMs: 4
  });
  try {
    const providerResult = await providerAdapters.executeHostedModel(capability, normalized, plan);
    assert.strictEqual(providerResult.provider, 'openai');
    assert.strictEqual(providerResult.model, 'mock-existing-model');
    assert.deepStrictEqual(providerResult.output, { answer: 'hello' });
    assert.deepStrictEqual(providerResult.usage, { input_tokens: 12, output_tokens: 6 });
    assert.strictEqual(providerResult.estimatedCostUsd, null, 'unknown cost must remain null');

    const legacyResult = await legacyAiAdapter.createStructuredResponse(authContext(), {
      endpoint: 'contract-test',
      instructions: 'Return the supplied object.',
      input: { prompt: 'hello' },
      schemaName: 'contract_test_schema',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { answer: { type: 'string' } },
        required: ['answer']
      }
    });
    assert.strictEqual(legacyResult.model, 'mock-existing-model');
    assert.deepStrictEqual(legacyResult.parsed, { answer: 'hello' });
    assert.strictEqual(legacyResult.estimatedCostUsd, null, 'legacy response adapter must preserve unknown cost as null');
    assert.strictEqual(legacyResult.parsed.__aiMetadata.usage.input_tokens, 12);
  } finally {
    aiProvider.createStructuredResponse = originalProviderCall;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
}

async function run() {
  const actualRoutes = new Set(listRouterContracts(aiRouter));
  for (const expectedRoute of expectedRoutes) {
    assert(actualRoutes.has(expectedRoute), `Missing AI route contract: ${expectedRoute}`);
  }

  const status = legacyAiAdapter.getStatus();
  assert.strictEqual(status.provider, 'openai');
  assert.strictEqual(typeof status.configured, 'boolean');
  assert.strictEqual(typeof status.model, 'string');
  assert.strictEqual(status.store, false);
  assert(Number.isInteger(status.timeoutMs));
  assert(status.timeoutMs >= 5000 && status.timeoutMs <= 120000);
  assert.strictEqual(status.intelligenceExecution.legacyCapability, legacyAiAdapter.LEGACY_AI_CAPABILITY);

  assertProviderClassification();
  assertCostEstimation();
  assertSupervisorPageContracts();
  await assertLegacyIepMigration();

  const accountContracts = new Set(listRouterContracts(accountIntelligenceRouter));
  assert(
    accountContracts.has('GET /insights/review-queue'),
    'Missing AI recommendation review queue.'
  );
  assert(
    accountContracts.has('GET /insights/admin'),
    'Missing supervisor intelligence queue page.'
  );
  assert(
    accountContracts.has('GET /insights'),
    'Missing filterable supervisor intelligence queue endpoint.'
  );
  assert(
    accountContracts.has('PUT /insights/:id/review'),
    'Missing AI recommendation review action.'
  );

  const accountPageSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'accountIntelligence.js'),
    'utf8'
  );
  assert(
    accountPageSource.includes('Supervisor Intelligence Queue'),
    'Supervisor intelligence queue must have a dedicated readable page.'
  );
  assert(
    accountPageSource.includes('reviewNotes'),
    'Supervisor intelligence review must preserve review notes.'
  );

  const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'adminDashboard.js'),
    'utf8'
  );
  assert(
    dashboardSource.includes('/api/account-intelligence/insights/admin'),
    'Unified supervisor dashboard must link to the intelligence queue.'
  );

  console.log(`[test:ai] ${expectedRoutes.length} AI route contracts verified.`);
  console.log('[test:ai] provider timeout and failure classification verified.');
  console.log('[test:ai] configurable token-cost estimation verified.');
  console.log('[test:ai] supervisor interface endpoint coverage verified.');
  console.log('[test:ai] legacy AI migration through IEP verified with mocked provider.');
  console.log('[test:ai] supervisor recommendation review contracts verified.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});