const assert = require('assert');
const fs = require('fs');
const path = require('path');

const aiProvider = require('../services/aiProvider');
const supervisorIntelligence = require('../services/supervisorIntelligence');
const supervisorAiAdapter = require('../services/intelligenceExecution/supervisorAiAdapter');
const providerAdapters = require('../services/intelligenceExecution/providerAdapters');
const { getCapability } = require('../services/intelligenceExecution/capabilityRegistry');
const { normalizeRequest } = require('../services/intelligenceExecution/contracts');
const { evaluatePolicy } = require('../services/intelligenceExecution/policyEngine');
const { getProfile } = require('../services/intelligenceExecution/profiles');
const { createExecutionPlan } = require('../services/intelligenceExecution/planner');
const { renderPrompt, requirePrompt } = require('../services/intelligenceExecution/promptRegistry');
const { validateSupervisorDailyReportOutput } = require('../services/intelligenceExecution/outputValidator');
const { EXECUTION_PROFILES, EXECUTION_STRATEGIES } = require('../services/intelligenceExecution/constants');
const rbac = require('../services/rbac');

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'supervisorIntelligence.js'),
  'utf8'
);
const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'supervisorIntelligence.js'),
  'utf8'
);
const schemaSource = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'postgres.js'),
  'utf8'
);
const serverSource = fs.readFileSync(
  path.join(__dirname, '..', 'server.js'),
  'utf8'
);

[
  "router.get('/alerts'",
  "router.patch('/alerts/:id'",
  "router.get('/schedules'",
  "router.post('/schedules/:id/run'",
  "router.get('/reports'"
].forEach((contract) => assertCondition(routeSource.includes(contract), `Missing route contract: ${contract}`));

[
  'CREATE TABLE IF NOT EXISTS supervisor_alerts',
  'CREATE TABLE IF NOT EXISTS scheduled_report_schedules',
  'CREATE TABLE IF NOT EXISTS scheduled_reports'
].forEach((contract) => assertCondition(schemaSource.includes(contract), `Missing schema contract: ${contract}`));

assertCondition(
  serverSource.includes("app.use('/api/supervisor-intelligence'"),
  'Supervisor intelligence routes are not mounted.'
);
assertCondition(
  serverSource.includes('supervisorIntelligence.start()'),
  'Scheduled report runner is not started.'
);
assertCondition(!serviceSource.includes("require('./aiProvider')"), 'supervisorIntelligence service must not import aiProvider');
assertCondition(!serviceSource.includes('aiProvider.createStructuredResponse'), 'supervisorIntelligence service must not invoke aiProvider directly');
assertCondition(serviceSource.includes("require('./intelligenceExecution/supervisorAiAdapter')"), 'supervisorIntelligence service must use the supervisor IEP adapter');
assertCondition(routeSource.includes('authorization.buildAuthContext(req)'), 'manual report route must pass trusted server auth context');

const report = supervisorIntelligence.deterministicReport({
  routeDate: '2026-06-05',
  routePrediction: {
    routes: [{
      routeId: 'route-1',
      routeNumber: 'R-1',
      paceStatus: 'high_risk',
      remainingStopCount: 3,
      scheduleVarianceMinutes: 35,
      confidence: 'medium'
    }]
  },
  failurePrediction: { riskLevel: 'high' },
  demandPrediction: {
    confidence: 'medium',
    products: [{ productName: 'Cola 12 Pack', direction: 'increasing' }]
  },
  undeliveredStops: [{
    routeNumber: 'R-1',
    stopSequence: 2,
    accountName: 'Test Account',
    nonDeliveryReason: 'business closed'
  }]
});

assertCondition(report.summary.includes('1 route(s) analyzed'), 'Report route summary is incorrect.');
assertCondition(report.priorities.length >= 2, 'Report priorities were not generated.');
assertCondition(report.routeRisks.length === 1, 'Route risk was not included.');
assertCondition(report.deliveryRisks.length >= 2, 'Delivery risks were not included.');

const validOutputErrors = validateSupervisorDailyReportOutput(report);
assert.deepStrictEqual(validOutputErrors, [], 'deterministic fallback report must satisfy supervisor output validation');
const invalidOutputErrors = validateSupervisorDailyReportOutput({
  ...report,
  recommendedActions: ['Fire the driver automatically.']
});
assert(invalidOutputErrors.some((error) => error.includes('prohibited autonomous')), 'employment-impact guardrail must reject autonomous disciplinary language');

function authContext(overrides = {}) {
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: 'supervisor-user',
    organizationId: 'trusted-supervisor-org',
    approvedRole: rbac.ROLES.SUPERVISOR,
    role: rbac.ROLES.SUPERVISOR,
    permissions: rbac.permissionsForRole(rbac.ROLES.SUPERVISOR),
    ...overrides
  };
}

async function assertSupervisorIepMigration() {
  const capability = getCapability(supervisorAiAdapter.SUPERVISOR_DAILY_REPORT_CAPABILITY);
  assert(capability, 'supervisor daily report capability must be registered');
  assert.strictEqual(capability.active, true);
  assert.deepStrictEqual(capability.allowedExecutionStrategies, [EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL]);
  assert.strictEqual(capability.premiumEscalationPermission, 'PROHIBITED');

  const prompt = requirePrompt(supervisorAiAdapter.SUPERVISOR_DAILY_REPORT_CAPABILITY);
  assert.strictEqual(prompt.owningCapability, supervisorAiAdapter.SUPERVISOR_DAILY_REPORT_CAPABILITY);
  assert(renderPrompt(supervisorAiAdapter.SUPERVISOR_DAILY_REPORT_CAPABILITY).includes('Do not make disciplinary'), 'prompt must include employment guardrail');

  const sourceContext = {
    routeDate: '2026-06-05',
    scope: { type: 'supervisor_team', supervisorUsername: 'sam' },
    routePrediction: { routes: [] },
    failurePrediction: { riskLevel: 'low' },
    demandPrediction: { confidence: 'medium', products: [] },
    undeliveredStops: [],
    organizationId: 'spoofed-client-org',
    provider: 'caller-provider',
    model: 'caller-model',
    modelClass: 'HOSTED_PREMIUM',
    allowPremiumEscalation: true
  };
  const request = supervisorAiAdapter.buildSupervisorDailyReportRequest({
    schedule: { id: 'schedule-1', reportType: 'supervisor_daily_brief', supervisorUsername: 'sam' },
    sourceContext
  });
  const normalized = normalizeRequest(request, authContext());
  assert.strictEqual(normalized.organizationId, 'trusted-supervisor-org', 'trusted auth context must control organization');
  assert.strictEqual(normalized.userId, 'supervisor-user', 'trusted auth context must control user');
  assert.strictEqual(normalized.userRole, rbac.ROLES.SUPERVISOR, 'trusted auth context must control role');
  assert.strictEqual(normalized.allowHostedInference, true);
  assert.strictEqual(normalized.allowPremiumEscalation, false, 'caller cannot force premium execution');
  assert.strictEqual(normalized.input.provider, undefined, 'caller provider selection must not be copied');
  assert.strictEqual(normalized.input.model, undefined, 'caller model selection must not be copied');
  assert.strictEqual(normalized.input.modelClass, undefined, 'caller model class selection must not be copied');
  assert.strictEqual(normalized.metadata.advisoryOnly, true, 'supervisor AI output must be advisory');

  const profile = getProfile(EXECUTION_PROFILES.BALANCED);
  const policy = evaluatePolicy(normalized, capability, profile, authContext());
  assert.strictEqual(policy.allowed, true, 'policy must allow supervisor capability for supervisor role');
  assert(policy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL));
  assert(!policy.approvedStrategies.includes(EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL));
  assert.strictEqual(policy.organizationPolicy.advisoryOnly, true);
  assert.strictEqual(policy.organizationPolicy.humanInterpretationRequired, true);

  const driverPolicy = evaluatePolicy(normalized, capability, profile, authContext({
    approvedRole: rbac.ROLES.DRIVER,
    role: rbac.ROLES.DRIVER,
    permissions: rbac.permissionsForRole(rbac.ROLES.DRIVER)
  }));
  assert.strictEqual(driverPolicy.allowed, false, 'driver role must not be authorized for supervisor hosted capability');
  const warehousePolicy = evaluatePolicy(normalized, capability, profile, authContext({
    approvedRole: rbac.ROLES.WAREHOUSE_EMPLOYEE,
    role: rbac.ROLES.WAREHOUSE_EMPLOYEE,
    permissions: rbac.permissionsForRole(rbac.ROLES.WAREHOUSE_EMPLOYEE)
  }));
  assert.strictEqual(warehousePolicy.allowed, false, 'non-supervisor roles with intelligence.view must not invoke supervisor capability');
  assert(warehousePolicy.denials.some((denial) => denial.code === 'SUPERVISOR_CAPABILITY_ROLE_DENIED'));

  const plan = createExecutionPlan(normalized, capability, profile, policy);
  assert.strictEqual(plan.selectedStrategy, EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL);
  assert.strictEqual(plan.selectedProviderAdapter, 'openai');
  assert.strictEqual(plan.selectedModelClass, 'HOSTED_BALANCED');

  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalProviderCall = aiProvider.createStructuredResponse;
  process.env.OPENAI_API_KEY = 'test-only-key';
  aiProvider.createStructuredResponse = async () => ({
    model: 'mock-supervisor-model',
    parsed: report,
    rawText: JSON.stringify(report),
    requestId: 'mock-supervisor-request',
    usage: { input_tokens: 22, output_tokens: 11 },
    estimatedCostUsd: null,
    latencyMs: 5
  });
  try {
    const result = await supervisorAiAdapter.createDailyReportNarrative({
      schedule: { id: 'schedule-1', reportType: 'supervisor_daily_brief', supervisorUsername: 'sam' },
      sourceContext,
      fallback: report,
      authContext: authContext()
    });
    assert.deepStrictEqual(result.content, report);
    assert.strictEqual(result.generatedBy, 'openai:mock-supervisor-model');
    assert.deepStrictEqual(result.usage, { input_tokens: 22, output_tokens: 11 });
    assert.strictEqual(result.estimatedCostUsd, null, 'unknown provider cost must remain null');
    assert.strictEqual(result.advisoryOnly, true);
  } finally {
    aiProvider.createStructuredResponse = originalProviderCall;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }

  const providerKeyBeforeMissingConfigCheck = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => providerAdapters.executeHostedModel(capability, {
        input: {
          endpoint: 'scheduled-supervisor-brief',
          instructions: 'Use only supplied data.',
          input: sourceContext,
          schemaName: 'scheduled_supervisor_intelligence_brief',
          schema: supervisorAiAdapter.SUPERVISOR_DAILY_REPORT_SCHEMA
        },
        metadata: { promptVersion: 'supervisor-daily-operations-report.v1' }
      }, plan),
      /AI provider is not configured/,
      'missing provider configuration must fail safely'
    );
  } finally {
    if (providerKeyBeforeMissingConfigCheck === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = providerKeyBeforeMissingConfigCheck;
  }
}

assertSupervisorIepMigration().then(() => {
  console.log('[test:supervisor-intelligence] alerts, schedules, reports, runner, deterministic report, and IEP migration contracts verified.');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});