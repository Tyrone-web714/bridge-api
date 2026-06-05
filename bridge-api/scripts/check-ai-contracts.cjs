const assert = require('assert');
const fs = require('fs');
const path = require('path');

const aiProvider = require('../services/aiProvider');
const aiRouter = require('../routes/ai');
const accountIntelligenceRouter = require('../routes/accountIntelligence');

const expectedRoutes = [
  'GET /status',
  'GET /operations',
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

function run() {
  const actualRoutes = new Set(listRouterContracts(aiRouter));
  for (const expectedRoute of expectedRoutes) {
    assert(actualRoutes.has(expectedRoute), `Missing AI route contract: ${expectedRoute}`);
  }

  const status = aiProvider.getStatus();
  assert.strictEqual(status.provider, 'openai');
  assert.strictEqual(typeof status.configured, 'boolean');
  assert.strictEqual(typeof status.model, 'string');
  assert.strictEqual(status.store, false);
  assert(Number.isInteger(status.timeoutMs));
  assert(status.timeoutMs >= 5000 && status.timeoutMs <= 120000);

  assertProviderClassification();
  assertCostEstimation();
  assertSupervisorPageContracts();

  const accountContracts = new Set(listRouterContracts(accountIntelligenceRouter));
  assert(
    accountContracts.has('GET /insights/review-queue'),
    'Missing AI recommendation review queue.'
  );
  assert(
    accountContracts.has('PUT /insights/:id/review'),
    'Missing AI recommendation review action.'
  );

  console.log(`[test:ai] ${expectedRoutes.length} AI route contracts verified.`);
  console.log('[test:ai] provider timeout and failure classification verified.');
  console.log('[test:ai] configurable token-cost estimation verified.');
  console.log('[test:ai] supervisor interface endpoint coverage verified.');
  console.log('[test:ai] supervisor recommendation review contracts verified.');
}

run();
