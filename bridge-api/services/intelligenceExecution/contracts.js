const crypto = require('crypto');
const rbac = require('../rbac');
const { REQUEST_SCHEMA_VERSION, RESPONSE_SCHEMA_VERSION } = require('./constants');
const { createError } = require('./errors');
const { parseUsdToMicros } = require('./money');

const MAX_INPUT_BYTES = 24 * 1024;

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

function requireEnum(value, allowed, field) {
  const cleaned = cleanText(value, 120);
  if (!allowed.includes(cleaned)) {
    throw createError(`${field} must be one of: ${allowed.join(', ')}.`, 400, 'INVALID_INTELLIGENCE_REQUEST_FIELD', { field });
  }
  return cleaned;
}

function validateThreshold(value, field, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw createError(`${field} must be between 0 and 1.`, 400, 'INVALID_INTELLIGENCE_THRESHOLD', { field });
  }
  return number;
}

function validateCostCeiling(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const text = cleanText(value, 80);
  const micros = parseUsdToMicros(text);
  if (micros === null) {
    throw createError(`${field} must be a non-negative USD decimal with at most 6 fractional digits.`, 400, 'INVALID_INTELLIGENCE_COST_CEILING', { field });
  }
  if (micros > 1000000000000n) {
    throw createError(`${field} exceeds the foundation request cost ceiling limit.`, 400, 'INTELLIGENCE_COST_CEILING_TOO_LARGE', { field });
  }
  return text;
}

function normalizeRequest(input = {}, authContext = {}) {
  if (!authContext?.authenticated) {
    throw createError('Authentication is required for intelligence execution.', 401, 'AUTHENTICATION_REQUIRED');
  }
  if (!authContext.organizationId && input.executionMode !== 'PLATFORM_ADMIN') {
    throw createError('Organization context is required for intelligence execution.', 403, 'ORGANIZATION_CONTEXT_REQUIRED');
  }

  const sizeBytes = byteLength(input);
  if (sizeBytes > MAX_INPUT_BYTES) {
    throw createError('Intelligence request payload is too large.', 413, 'INTELLIGENCE_REQUEST_TOO_LARGE', {
      maxBytes: MAX_INPUT_BYTES,
      actualBytes: sizeBytes
    });
  }

  const capability = cleanText(input.capability, 120);
  if (!capability) throw createError('capability is required.', 400, 'CAPABILITY_REQUIRED');

  const taskType = requireEnum(input.taskType || input.task_type || 'TRANSFORM', [
    'TRANSFORM',
    'SUMMARIZE',
    'ANSWER',
    'EXPLAIN',
    'CLASSIFY',
    'EXTRACT',
    'SCORE',
    'PLAN'
  ], 'taskType');
  const executionMode = requireEnum(input.executionMode || input.execution_mode || 'SYNCHRONOUS', [
    'SYNCHRONOUS',
    'BACKGROUND',
    'BATCH',
    'PLATFORM_ADMIN'
  ], 'executionMode');
  const dataSensitivity = requireEnum(input.dataSensitivity || input.data_sensitivity || 'INTERNAL', [
    'PUBLIC',
    'INTERNAL',
    'ORGANIZATION_PRIVATE',
    'CONFIDENTIAL',
    'RESTRICTED'
  ], 'dataSensitivity');
  const safetyClassification = requireEnum(input.safetyClassification || input.safety_classification || 'LOW', [
    'LOW',
    'MEDIUM',
    'HIGH',
    'SAFETY_CRITICAL',
    'COMPLIANCE_CRITICAL',
    'EMPLOYMENT_CRITICAL',
    'FINANCIAL_CRITICAL'
  ], 'safetyClassification');

  return Object.freeze({
    requestId: cleanText(input.requestId || input.request_id, 120) || crypto.randomUUID(),
    schemaVersion: REQUEST_SCHEMA_VERSION,
    organizationId: authContext.organizationId || null,
    userId: authContext.actorId || null,
    userRole: rbac.normalizeRole(authContext.approvedRole || authContext.role) || null,
    feature: cleanText(input.feature, 120) || 'intelligence.execution',
    capability,
    taskType,
    executionMode,
    input: input.input,
    inputClassification: cleanText(input.inputClassification || input.input_classification, 80) || dataSensitivity,
    dataSensitivity,
    safetyClassification,
    desiredOutputFormat: cleanText(input.desiredOutputFormat || input.desired_output_format, 80) || 'json',
    outputSchema: input.outputSchema || input.output_schema || null,
    accuracyThreshold: validateThreshold(input.accuracyThreshold ?? input.accuracy_threshold, 'accuracyThreshold'),
    confidenceThreshold: validateThreshold(input.confidenceThreshold ?? input.confidence_threshold, 'confidenceThreshold'),
    latencyTargetMs: Number.isFinite(Number(input.latencyTargetMs ?? input.latency_target_ms))
      ? Math.max(1, Math.min(Number(input.latencyTargetMs ?? input.latency_target_ms), 120000))
      : null,
    maximumCostUsd: validateCostCeiling(input.maximumCostUsd ?? input.maximum_cost_usd, 'maximumCostUsd'),
    allowHostedInference: input.allowHostedInference === true || input.allow_hosted_inference === true,
    allowLocalInference: input.allowLocalInference !== false && input.allow_local_inference !== false,
    allowPremiumEscalation: input.allowPremiumEscalation === true || input.allow_premium_escalation === true,
    requireHumanReview: input.requireHumanReview === true || input.require_human_review === true,
    idempotencyKey: cleanText(input.idempotencyKey || input.idempotency_key, 240) || null,
    traceId: cleanText(input.traceId || input.trace_id, 120) || cleanText(input.requestId || input.request_id, 120) || crypto.randomUUID(),
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? { ...input.metadata } : {},
    createdAt: new Date().toISOString()
  });
}

function buildResponse(request, plan, result, timing = {}) {
  const now = new Date().toISOString();
  return Object.freeze({
    schemaVersion: RESPONSE_SCHEMA_VERSION,
    requestId: request.requestId,
    traceId: request.traceId,
    organizationId: request.organizationId,
    capability: request.capability,
    status: result.status || 'SUCCEEDED',
    executionStrategy: plan.selectedStrategy,
    provider: result.provider || null,
    model: result.model || null,
    modelClass: result.modelClass || null,
    output: result.output ?? null,
    confidence: result.confidence ?? 'unavailable',
    evidence: result.evidence || [],
    usage: result.usage || null,
    providerRequestId: result.providerRequestId || null,
    rawText: result.rawText || null,
    validationResults: result.validationResults || [],
    humanReviewRequired: Boolean(plan.humanReviewRequired || result.humanReviewRequired),
    cacheStatus: plan.cacheDecision?.status || 'MISS',
    latencyMs: timing.latencyMs ?? null,
    estimatedCostUsd: result.estimatedCostUsd === undefined ? null : result.estimatedCostUsd,
    actualCostUsd: result.actualCostUsd ?? null,
    escalationPath: plan.escalationSequence || [],
    fallbackPath: plan.fallbackSequence || [],
    promptVersion: result.promptVersion || null,
    policyVersion: plan.policyVersion,
    createdAt: request.createdAt,
    completedAt: now,
    errors: result.errors || []
  });
}

module.exports = {
  MAX_INPUT_BYTES,
  buildResponse,
  cleanText,
  normalizeRequest
};