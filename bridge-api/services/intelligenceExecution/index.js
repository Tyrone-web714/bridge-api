const auditLog = require('../auditLog');
const { getCapability, listCapabilities } = require('./capabilityRegistry');
const { cleanText, normalizeRequest, buildResponse } = require('./contracts');
const { createError, IntelligenceExecutionError } = require('./errors');
const { evaluatePolicy } = require('./policyEngine');
const { getProfile, PROFILE_DEFINITIONS } = require('./profiles');
const { createExecutionPlan } = require('./planner');
const { getExecutor, listRegisteredStrategies } = require('./strategyRegistry');
const { validateOutput } = require('./outputValidator');
const telemetry = require('./telemetry');
const { getHostedAdapterCatalog } = require('./providerAdapters');

async function recordLifecycleEvent(req, eventType, statusCode, metadata = {}) {
  if (!req) return;
  await auditLog.recordSecurityEvent(req, {
    eventType,
    statusCode,
    outcome: statusCode >= 200 && statusCode < 400 ? 'success' : 'failure',
    metadata
  }).catch((error) => {
    console.warn(`intelligence audit write failed requestId=${req.requestId || 'unknown'}: ${error.message}`);
  });
}

async function execute(authContext, input = {}, options = {}) {
  const startedAt = Date.now();
  let request;
  try {
    request = normalizeRequest(input, authContext);
  } catch (error) {
    await recordLifecycleEvent(options.req, 'intelligence.request.rejected', error.status || 400, {
      capability: cleanText(input?.capability, 120) || null,
      code: error.code || 'INTELLIGENCE_REQUEST_REJECTED'
    });
    throw error;
  }

  await recordLifecycleEvent(options.req, 'intelligence.request.received', 202, {
    requestId: request.requestId,
    capability: request.capability,
    inputClassification: request.inputClassification,
    dataSensitivity: request.dataSensitivity,
    inputBytes: Buffer.byteLength(JSON.stringify(request.input ?? null), 'utf8')
  });

  const capability = getCapability(request.capability);
  const profile = getProfile(input.executionProfile || input.execution_profile || capability?.defaultExecutionProfile);
  const policy = evaluatePolicy(request, capability, profile, authContext);
  await recordLifecycleEvent(options.req, 'intelligence.policy.evaluated', policy.allowed ? 200 : 403, {
    requestId: request.requestId,
    capability: request.capability,
    policyVersion: policy.policyVersion,
    denials: policy.denials.map((denial) => denial.code)
  });

  if (!policy.allowed) {
    const budgetDenied = policy.denials.some((denial) => denial.code === 'BUDGET_DENIED');
    await recordLifecycleEvent(options.req, budgetDenied ? 'intelligence.budget.denied' : 'intelligence.request.rejected', 403, {
      requestId: request.requestId,
      capability: request.capability,
      denials: policy.denials.map((denial) => denial.code)
    });
    throw createError('Intelligence policy denied the request.', 403, 'INTELLIGENCE_POLICY_DENIED', policy.denials);
  }

  const plan = createExecutionPlan(request, capability, profile, policy);
  await recordLifecycleEvent(options.req, 'intelligence.plan.created', 200, {
    requestId: request.requestId,
    capability: request.capability,
    selectedStrategy: plan.selectedStrategy,
    humanReviewRequired: plan.humanReviewRequired
  });
  if (plan.humanReviewRequired) {
    await recordLifecycleEvent(options.req, 'intelligence.human_review.required', 202, {
      requestId: request.requestId,
      capability: request.capability,
      safetyClassification: request.safetyClassification
    });
  }

  const executor = getExecutor(plan.selectedStrategy);
  await recordLifecycleEvent(options.req, 'intelligence.execution.started', 200, {
    requestId: request.requestId,
    capability: request.capability,
    selectedStrategy: plan.selectedStrategy
  });

  const timeoutMs = plan.latencyCeilingMs || 30000;
  let timeoutHandle = null;
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(createError(`Intelligence execution timed out after ${timeoutMs}ms.`, 504, 'INTELLIGENCE_EXECUTION_TIMEOUT')), timeoutMs);
  });

  try {
    const result = await Promise.race([executor(capability, request, plan), timeout]);
    clearTimeout(timeoutHandle);
    const validationResults = validateOutput(capability, result);
    const response = buildResponse(request, plan, { ...result, validationResults }, { latencyMs: Date.now() - startedAt });
    telemetry.recordExecution({
      capability: request.capability,
      strategy: plan.selectedStrategy,
      status: response.status,
      humanReviewRequired: response.humanReviewRequired
    });
    await recordLifecycleEvent(options.req, 'intelligence.execution.completed', 200, {
      requestId: request.requestId,
      capability: request.capability,
      selectedStrategy: plan.selectedStrategy,
      provider: response.provider,
      model: response.model,
      modelClass: response.modelClass,
      promptVersion: response.promptVersion,
      usage: response.usage,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd,
      actualCostUsd: response.actualCostUsd
    });
    return response;
  } catch (error) {
    clearTimeout(timeoutHandle);
    telemetry.recordExecution({
      capability: request.capability,
      strategy: plan.selectedStrategy,
      status: 'FAILED',
      humanReviewRequired: plan.humanReviewRequired
    });
    await recordLifecycleEvent(options.req, error.code === 'INTELLIGENCE_OUTPUT_INVALID' ? 'intelligence.validation.failed' : 'intelligence.execution.failed', error.status || 500, {
      requestId: request.requestId,
      capability: request.capability,
      selectedStrategy: plan.selectedStrategy,
      code: error.code || 'INTELLIGENCE_EXECUTION_ERROR'
    });
    throw error;
  }
}

module.exports = {
  IntelligenceExecutionError,
  execute,
  getCapability,
  getHostedAdapterCatalog,
  listCapabilities,
  listExecutionProfiles: () => Object.values(PROFILE_DEFINITIONS),
  listRegisteredStrategies,
  telemetrySnapshot: telemetry.snapshot
};