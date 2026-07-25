const fs = require('fs');
const path = require('path');
const { EXECUTION_STRATEGIES } = require('./constants');
const enterpriseRegistry = require('./enterpriseCapabilityRegistry');
const benchmarkFramework = require('./benchmarkDatasetFramework');
const { cleanupText } = require('./deterministicExecutor');
const {
  validateSupervisorDailyReportOutput,
  validateTextCleanupOutput
} = require('./outputValidator');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const evaluationsRoot = path.join(backendRoot, 'evaluations');
const requestRoot = path.join(evaluationsRoot, 'requests');
const executorRoot = path.join(evaluationsRoot, 'executors');

const ENGINE_VERSION = 'execution.strategy.evaluation.engine.v1';
const REQUEST_SCHEMA_VERSION = 'execution.evaluation.request.v1';
const PLAN_SCHEMA_VERSION = 'execution.evaluation.plan.v1';
const RUN_SCHEMA_VERSION = 'execution.evaluation.run.v1';
const OBSERVATION_SCHEMA_VERSION = 'execution.evaluation.observation.v1';
const OFFLINE_ENVIRONMENTS = Object.freeze(['LOCAL_TEST', 'CI']);
const HOSTED_STRATEGIES = Object.freeze([
  EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL,
  EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL,
  EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL,
  EXECUTION_STRATEGIES.MULTI_MODEL_WORKFLOW
]);

const RESULT_CLASSES = Object.freeze({
  SUCCESS: 'SUCCESS',
  PARTIAL_OUTPUT: 'PARTIAL_OUTPUT',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  ASSERTION_FAILURE: 'ASSERTION_FAILURE',
  EXECUTOR_ERROR: 'EXECUTOR_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNSUPPORTED: 'UNSUPPORTED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
  POLICY_BLOCKED: 'POLICY_BLOCKED',
  SAFETY_BLOCKED: 'SAFETY_BLOCKED',
  PRIVACY_BLOCKED: 'PRIVACY_BLOCKED',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const OBSERVATION_OUTCOMES = Object.freeze({
  MATCHED: 'MATCHED',
  FAILED: 'FAILED',
  UNAVAILABLE: 'UNAVAILABLE',
  SKIPPED: 'SKIPPED',
  BLOCKED: 'BLOCKED'
});

const OBSERVATION_DOMAINS = Object.freeze({
  FACT: 'FACT',
  FIELD: 'FIELD',
  SAFETY: 'SAFETY',
  POLICY: 'POLICY',
  PRIVACY: 'PRIVACY',
  NUMERICAL: 'NUMERICAL',
  STRUCTURAL: 'STRUCTURAL',
  ROUTE: 'ROUTE',
  REFUSAL: 'REFUSAL',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  COST: 'COST',
  TIMING: 'TIMING',
  RESOURCE: 'RESOURCE'
});

const SECRET_PATTERNS = [
  /sk-[a-z0-9]{12,}/i,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i,
  /https:\/\/[^"'\s]+\.r2\.dev\/[^\s"']+/i
];

function stable(value) {
  return benchmarkFramework.stable(value);
}

function stableStringify(value) {
  return benchmarkFramework.stableStringify(value);
}

function sha256(value) {
  return benchmarkFramework.sha256(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJsonFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : [];
    });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadEvaluationRequests(root = requestRoot) {
  return listJsonFiles(root).map((filePath) => {
    const request = readJson(filePath);
    Object.defineProperty(request, '__filePath', { value: filePath, enumerable: false });
    return request;
  }).sort((a, b) => a.runId.localeCompare(b.runId));
}

function loadMockExecutorCatalog(root = executorRoot) {
  const catalogPath = path.join(root, 'mock-executors.json');
  const catalog = fs.existsSync(catalogPath) ? readJson(catalogPath) : { executors: [] };
  return (catalog.executors || []).sort((a, b) => a.executorId.localeCompare(b.executorId));
}

function getEvaluationRequest(runId) {
  return loadEvaluationRequests().find((request) => request.runId === runId) || null;
}

function listEvaluationRuns() {
  return loadEvaluationRequests().map((request) => ({
    runId: request.runId,
    capabilityId: request.capabilityId,
    datasetId: request.datasetId,
    datasetVersion: request.datasetVersion,
    environment: request.environment,
    offlineOnly: request.controls?.offlineOnly === true
  }));
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function flattenOutput(output) {
  if (output === undefined || output === null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'number' || typeof output === 'boolean') return String(output);
  return stableStringify(output);
}

function getByPath(value, field) {
  if (!field) return undefined;
  if (value && Object.prototype.hasOwnProperty.call(value, field)) return value[field];
  return String(field).split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), value);
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function hasHostedStrategy(strategy) {
  return HOSTED_STRATEGIES.includes(strategy);
}

function isPremiumStrategy(strategy) {
  return strategy === EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL;
}

function getDataset(datasetId, datasetVersion) {
  const dataset = benchmarkFramework.listDatasets().find((item) => (
    (item.datasetId === datasetId || (item.aliases || []).includes(datasetId)) &&
    (!datasetVersion || item.version === datasetVersion)
  ));
  return dataset || null;
}

function validateEvaluationRequest(request, context = {}) {
  const errors = [];
  const requests = context.requests || loadEvaluationRequests();
  const duplicateCount = requests.filter((item) => item.runId === request.runId).length;
  const dataset = getDataset(request.datasetId, request.datasetVersion);
  const capability = enterpriseRegistry.getEnterpriseCapability(request.capabilityId);
  const executors = context.executors || loadMockExecutorCatalog();
  const executorIds = new Set(executors.map((executor) => executor.executorId));

  if (!/^eval\.[a-z0-9_.-]+$/.test(request.runId || '')) errors.push(rule('runId', 'INVALID_RUN_ID', 'Use eval.<machine-readable-id>.'));
  if (duplicateCount > 1) errors.push(rule('runId', 'DUPLICATE_RUN_ID', 'Evaluation run IDs must be unique.'));
  if (request.schemaVersion !== REQUEST_SCHEMA_VERSION) errors.push(rule('schemaVersion', 'INVALID_REQUEST_SCHEMA_VERSION', `Use ${REQUEST_SCHEMA_VERSION}.`));
  if (!request.runVersion) errors.push(rule('runVersion', 'MISSING_RUN_VERSION', 'Run version is required.'));
  if (!request.repositoryCommit) errors.push(rule('repositoryCommit', 'MISSING_REPOSITORY_COMMIT', 'Repository commit is required.'));
  if (request.engineVersion !== ENGINE_VERSION) errors.push(rule('engineVersion', 'MISSING_ENGINE_VERSION', `Use ${ENGINE_VERSION}.`));
  if (!OFFLINE_ENVIRONMENTS.includes(request.environment)) errors.push(rule('environment', 'PROHIBITED_ENVIRONMENT', 'Only LOCAL_TEST and CI are permitted in this phase.'));
  if (request.productionDataUsed === true) errors.push(rule('productionDataUsed', 'PRODUCTION_DATA_PROHIBITED', 'Initial evaluation runs must not use production data.'));
  if (request.controls?.offlineOnly !== true || request.controls?.allowHostedExecution === true || request.controls?.allowPremiumExecution === true) {
    errors.push(rule('controls', 'CONTRADICTORY_CONTROL_FLAGS', 'Offline-only controls must prohibit hosted and premium execution.'));
  }
  if (!capability) errors.push(rule('capabilityId', 'UNKNOWN_CAPABILITY', 'Reference a registered enterprise capability.'));
  if (!dataset) errors.push(rule('datasetId', 'UNKNOWN_DATASET', 'Reference a registered benchmark dataset.'));
  if (dataset && capability && dataset.capabilityId !== capability.capabilityId) errors.push(rule('datasetId', 'INCOMPATIBLE_CAPABILITY_DATASET', 'Dataset capability must match request capability.'));
  if (dataset && dataset.lifecycleState === benchmarkFramework.DATASET_LIFECYCLE_STATES.RETIRED) errors.push(rule('datasetId', 'RETIRED_DATASET', 'Retired datasets cannot be evaluated.'));
  if (dataset && !(dataset.allowedEnvironments || []).includes(request.environment)) errors.push(rule('environment', 'DATASET_ENVIRONMENT_NOT_ALLOWED', 'Dataset must allow the requested environment.'));

  const candidates = request.candidates || [];
  if (!Array.isArray(candidates) || candidates.length === 0) errors.push(rule('candidates', 'MISSING_CANDIDATE', 'At least one candidate is required.'));
  const candidateKeys = new Set();
  for (const candidate of candidates) {
    const candidateKey = `${candidate.strategy}:${candidate.executorId}:${candidate.candidateId}`;
    if (candidateKeys.has(candidateKey)) errors.push(rule('candidates', 'DUPLICATE_CANDIDATE', 'Candidate IDs must be unique per strategy and executor.'));
    candidateKeys.add(candidateKey);
    if (!Object.values(EXECUTION_STRATEGIES).includes(candidate.strategy)) errors.push(rule('strategy', 'UNKNOWN_STRATEGY', 'Use repository execution strategy constants.'));
    if (!executorIds.has(candidate.executorId)) errors.push(rule('executorId', 'UNKNOWN_EXECUTOR', 'Executor must exist in mock-executors.json.'));
    if (hasHostedStrategy(candidate.strategy) && request.controls?.allowHostedExecution !== true && candidate.authorizedMockExecution !== true) {
      errors.push(rule('strategy', 'HOSTED_EXECUTION_WITHOUT_AUTHORIZATION', 'Hosted strategies require explicit mock-only authorization in offline runs.'));
    }
    if (isPremiumStrategy(candidate.strategy) && request.controls?.allowPremiumExecution !== true) {
      errors.push(rule('strategy', 'PREMIUM_EXECUTION_WITHOUT_AUTHORIZATION', 'Premium strategies are prohibited in this phase.'));
    }
    if (candidate.strategy === EXECUTION_STRATEGIES.HUMAN_REVIEW && request.controls?.allowHumanReview !== true && candidate.authorizedMockExecution !== true) {
      errors.push(rule('strategy', 'HUMAN_REVIEW_WITHOUT_AUTHORIZATION', 'Human review candidates require explicit mock-only authorization.'));
    }
  }
  if (containsSecretLikeValue(request)) errors.push(rule('request', 'SECRET_LIKE_EVALUATION_CONTENT', 'Remove secrets, tokens, and private URLs from evaluation fixtures.'));
  return { valid: errors.length === 0, errors };
}

function rule(field, ruleName, guidance) {
  return { field, rule: ruleName, guidance };
}

function resolveCandidateEligibility(request, candidate, capability, executor) {
  if (!executor) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNSUPPORTED, reason: 'UNKNOWN_EXECUTOR' };
  }
  if (executor.offlineCapable !== true || executor.liveProviderCallCapable === true) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNAUTHORIZED, reason: 'EXECUTOR_NOT_OFFLINE_SAFE' };
  }
  if (!executor.supportedCapabilities.includes(request.capabilityId)) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNSUPPORTED, reason: 'EXECUTOR_CAPABILITY_MISMATCH' };
  }
  if (!executor.supportedStrategies.includes(candidate.strategy)) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNSUPPORTED, reason: 'EXECUTOR_STRATEGY_MISMATCH' };
  }
  if (!capability.allowedExecutionStrategies.includes(candidate.strategy)) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNAUTHORIZED, reason: 'STRATEGY_NOT_ALLOWED_FOR_CAPABILITY' };
  }
  if (hasHostedStrategy(candidate.strategy) && candidate.authorizedMockExecution !== true) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNAUTHORIZED, reason: 'HOSTED_STRATEGY_REQUIRES_MOCK_AUTHORIZATION' };
  }
  if (isPremiumStrategy(candidate.strategy)) {
    return { eligible: false, resultClass: RESULT_CLASSES.UNAUTHORIZED, reason: 'PREMIUM_STRATEGY_PROHIBITED' };
  }
  return { eligible: true, resultClass: null, reason: 'ELIGIBLE_OFFLINE_MOCK' };
}

function createEvaluationPlan(request, context = {}) {
  const validation = validateEvaluationRequest(request, context);
  if (!validation.valid) return { valid: false, errors: validation.errors };
  const dataset = getDataset(request.datasetId, request.datasetVersion);
  const capability = enterpriseRegistry.getEnterpriseCapability(request.capabilityId);
  const executors = context.executors || loadMockExecutorCatalog();
  const executorById = new Map(executors.map((executor) => [executor.executorId, executor]));
  const cases = (dataset.cases || []).slice().sort((a, b) => a.caseId.localeCompare(b.caseId));
  const candidates = (request.candidates || []).slice().sort((a, b) => (
    `${a.strategy}:${a.executorId}:${a.candidateId}`.localeCompare(`${b.strategy}:${b.executorId}:${b.candidateId}`)
  ));
  const planItems = [];
  for (const testCase of cases) {
    for (const candidate of candidates) {
      const executor = executorById.get(candidate.executorId);
      const eligibility = testCase.enabled === false
        ? { eligible: false, resultClass: RESULT_CLASSES.SKIPPED, reason: 'CASE_DISABLED' }
        : resolveCandidateEligibility(request, candidate, capability, executor);
      planItems.push({
        planItemId: `${request.runId}.${testCase.caseId}.${candidate.candidateId}`,
        caseId: testCase.caseId,
        caseVersion: testCase.caseVersion,
        candidateId: candidate.candidateId,
        strategy: candidate.strategy,
        executorId: candidate.executorId,
        expectedResultType: testCase.expectedResultType,
        evaluationTypes: testCase.evaluationTypes || [],
        timeoutMs: candidate.timeoutMs || request.defaultTimeoutMs || 250,
        retryCount: candidate.retryCount || 0,
        eligible: eligibility.eligible,
        plannedResultClass: eligibility.resultClass,
        eligibilityReason: eligibility.reason
      });
    }
  }
  const plan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    runId: request.runId,
    runVersion: request.runVersion,
    engineVersion: ENGINE_VERSION,
    capabilityId: request.capabilityId,
    datasetId: dataset.datasetId,
    datasetVersion: dataset.version,
    deterministicSeed: request.deterministicSeed,
    environment: request.environment,
    offlineOnly: true,
    productionDataUsed: false,
    planItems
  };
  plan.requestHash = hashRequest(request);
  plan.planHash = hashPlan(plan);
  return plan;
}

function executeMockExecutor(executor, request, testCase, candidate) {
  const mode = candidate.behavior || executor.defaultBehavior || 'valid';
  if (mode === 'timeout') return { resultClass: RESULT_CLASSES.TIMEOUT, timedOut: true, durationMs: candidate.timeoutMs || 250, rawOutput: null, output: null, error: 'Synthetic timeout.' };
  if (mode === 'error') return { resultClass: RESULT_CLASSES.EXECUTOR_ERROR, durationMs: 3, rawOutput: null, output: null, error: 'Synthetic executor error.' };
  if (mode === 'malformed_json') return { resultClass: RESULT_CLASSES.SCHEMA_ERROR, durationMs: 2, rawOutput: '{"unterminated": true', output: null, error: 'Malformed synthetic JSON.' };

  let output;
  if (request.capabilityId === 'text.cleanup') {
    if (mode === 'invalid') {
      let baseText = '';
      try {
        baseText = cleanupText(testCase.requestPayload).normalizedText;
      } catch {
        baseText = String(testCase.requestPayload?.text ?? '');
      }
      output = { normalizedText: `${baseText} new destination`.trim(), changed: true, originalLength: -1, normalizedLength: 0 };
    } else if (mode === 'refusal' || testCase.expectedRefusal) {
      output = 'I cannot determine this from the supplied text.';
    } else {
      try {
        output = cleanupText(testCase.requestPayload);
      } catch {
        output = { normalizedText: String(testCase.exactExpectedOutput ?? ''), changed: true, originalLength: String(testCase.requestPayload?.text ?? '').length, normalizedLength: String(testCase.exactExpectedOutput ?? '').length };
      }
    }
  } else if (request.capabilityId === 'legacy.ai.structured_response') {
    output = structuredOutputForCase(testCase, mode);
  } else if (request.capabilityId === 'supervisor.daily_operations_report') {
    output = supervisorOutputForCase(testCase, mode);
  } else {
    output = null;
  }
  const resultClass = mode === 'partial' ? RESULT_CLASSES.PARTIAL_OUTPUT : RESULT_CLASSES.SUCCESS;
  return {
    resultClass,
    durationMs: candidate.durationMs ?? 5,
    timedOut: false,
    rawOutput: output,
    output,
    usage: candidate.mockUsage || null,
    cost: candidate.mockCost || { knowledgeStatus: 'UNKNOWN', estimatedCostMicroUsd: null, actualCostMicroUsd: null, source: 'MOCK_UNKNOWN' }
  };
}

function structuredOutputForCase(testCase, mode) {
  if (mode === 'invalid') return { unsupportedClaim: 'Customer account status is at risk.', driverName: 'Synthetic Driver' };
  if (mode === 'partial') return { insufficientEvidence: true };
  if (testCase.expectedRefusal) return { refusal: true, reason: 'Insufficient supplied evidence.' };
  if (testCase.expectedInsufficientEvidence) return { insufficientEvidence: true, missingEvidence: testCase.minimumEvidenceRequirements || [] };
  const output = {};
  for (const field of testCase.expectedStructuredFields || []) {
    const numerical = (testCase.expectedNumericalValues || []).find((item) => item.field === field.field);
    if (numerical) output[field.field] = numerical.target;
    else if (field.field === 'exceptionNoted') output[field.field] = false;
    else output[field.field] = true;
  }
  return output;
}

function supervisorOutputForCase(testCase, mode) {
  if (mode === 'invalid') {
    return {
      summary: 'Disciplinary action should be taken and the route rule can be ignored.',
      recommendedActions: ['Fire the responsible employee.'],
      metrics: {},
      humanReviewRequired: false
    };
  }
  const values = {};
  for (const item of testCase.expectedNumericalValues || []) values[item.field] = item.target;
  return {
    title: testCase.displayName,
    summary: testCase.expectedInsufficientEvidence
      ? 'Insufficient supplied evidence for a complete advisory report; supervisor review is required.'
      : `Advisory report preserves supplied facts: ${testCase.canonicalFacts.join('; ')}.`,
    priorities: testCase.expectedHumanReview ? ['Supervisor review required before action.'] : ['Continue normal operational review.'],
    routeRisks: testCase.expectedRouteProperties?.routeRule ? [`Route rule remains ${testCase.expectedRouteProperties.routeRule}.`] : [],
    deliveryRisks: [],
    productSignals: [],
    recommendedActions: ['Review operational data before taking action.'],
    missingData: testCase.expectedInsufficientEvidence ? testCase.minimumEvidenceRequirements || [] : [],
    safetySummary: testCase.expectedSafetyFlags?.length ? testCase.expectedSafetyFlags.join(', ') : 'No additional safety claims.',
    metrics: values,
    humanReviewRequired: testCase.expectedHumanReview === true,
    insufficientEvidence: testCase.expectedInsufficientEvidence === true,
    policy: 'advisory_only'
  };
}

function normalizeExecutorOutput(capabilityId, rawOutput) {
  if (rawOutput === undefined || rawOutput === null) return { normalizedOutput: null, rawText: '', structured: null, malformed: false };
  if (typeof rawOutput === 'string') {
    const trimmed = rawOutput.trim();
    if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        const parsed = JSON.parse(trimmed);
        return { normalizedOutput: parsed, rawText: trimmed, structured: parsed, malformed: false };
      } catch {
        return { normalizedOutput: null, rawText: trimmed, structured: null, malformed: true };
      }
    }
    return { normalizedOutput: rawOutput, rawText: rawOutput, structured: null, malformed: false };
  }
  return { normalizedOutput: clone(rawOutput), rawText: flattenOutput(rawOutput), structured: clone(rawOutput), malformed: false };
}

function evaluateCaseAssertions(testCase, normalized, executionResult) {
  const observations = [];
  const output = normalized.normalizedOutput;
  const text = normalizeText(flattenOutput(output));
  const evalTypes = testCase.evaluationTypes || [];
  for (const evaluationType of evalTypes) {
    if (evaluationType === benchmarkFramework.EVALUATION_TYPES.NORMALIZED_TEXT_MATCH) {
      const expected = normalizeText(testCase.exactExpectedOutput);
      const actual = normalizeText(output?.normalizedText || output);
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.FACT, actual === expected, expected, actual, 'normalized text comparison'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.STRUCTURED_SCHEMA) {
      let schemaErrors = [];
      if (normalized.malformed || !output || typeof output !== 'object' || Array.isArray(output)) schemaErrors.push('output_not_structured_object');
      for (const field of testCase.expectedStructuredFields || []) {
        if (field.required && getByPath(output, field.field) === undefined) schemaErrors.push(`missing_${field.field}`);
      }
      if ((testCase.assertions?.schemaAssertions || []).includes('no_unexpected_fields')) {
        const allowed = new Set((testCase.expectedStructuredFields || []).map((field) => field.field).concat(['refusal', 'reason', 'insufficientEvidence', 'missingEvidence']));
        for (const key of Object.keys(output || {})) if (!allowed.has(key)) schemaErrors.push(`unexpected_${key}`);
      }
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.STRUCTURAL, schemaErrors.length === 0, 'schema compliant object', schemaErrors, 'structured schema assertions'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.FIELD_LEVEL_ASSERTION) {
      const missing = [];
      const prohibited = [];
      for (const item of testCase.assertions?.inclusionAssertions || []) if (!text.includes(normalizeText(item))) missing.push(item);
      for (const item of testCase.assertions?.exclusionAssertions || []) if (text.includes(normalizeText(item))) prohibited.push(item);
      for (const field of testCase.expectedStructuredFields || []) if (field.required && output && typeof output === 'object' && getByPath(output, field.field) === undefined) missing.push(field.field);
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.FIELD, missing.length === 0 && prohibited.length === 0, { required: testCase.assertions?.inclusionAssertions || [], prohibited: testCase.assertions?.exclusionAssertions || [] }, { missing, prohibited }, 'field and text assertions'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.NUMERICAL_TOLERANCE) {
      const failures = [];
      for (const expected of testCase.expectedNumericalValues || []) {
        const actual = Number(getByPath(output, expected.field) ?? getByPath(output?.metrics, expected.field) ?? extractNumberForField(text, expected.field));
        if (!Number.isFinite(actual) || Math.abs(actual - expected.target) > expected.tolerance) failures.push({ field: expected.field, expected: expected.target, actual: Number.isFinite(actual) ? actual : null });
      }
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.NUMERICAL, failures.length === 0, testCase.expectedNumericalValues || [], failures, 'numerical tolerance assertions'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.POLICY_CONSTRAINT) {
      const policyFailures = detectPolicyFailures(text, output, testCase);
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.POLICY, policyFailures.length === 0, testCase.expectedPolicyFlags || [], policyFailures, 'policy constraints'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.SAFETY_CONSTRAINT || evaluationType === benchmarkFramework.EVALUATION_TYPES.ROUTE_CONSTRAINT || evaluationType === benchmarkFramework.EVALUATION_TYPES.GEOSPATIAL_TOLERANCE) {
      const safetyFailures = detectSafetyFailures(text, testCase);
      const domain = evaluationType === benchmarkFramework.EVALUATION_TYPES.ROUTE_CONSTRAINT ? OBSERVATION_DOMAINS.ROUTE : OBSERVATION_DOMAINS.SAFETY;
      observations.push(observation(testCase, evaluationType, domain, safetyFailures.length === 0, testCase.expectedSafetyFlags || testCase.expectedRouteProperties || [], safetyFailures, 'safety and route constraints'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.REFUSAL_EXPECTED) {
      const refused = Boolean(output?.refusal || /cannot|insufficient|unable/.test(text));
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.REFUSAL, refused === testCase.expectedRefusal, testCase.expectedRefusal, refused, 'refusal expectation'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.INSUFFICIENT_EVIDENCE_EXPECTED) {
      const insufficient = Boolean(output?.insufficientEvidence || /insufficient/.test(text));
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.FACT, insufficient === testCase.expectedInsufficientEvidence, testCase.expectedInsufficientEvidence, insufficient, 'insufficient evidence expectation'));
    } else if (evaluationType === benchmarkFramework.EVALUATION_TYPES.HUMAN_REVIEW_EXPECTED) {
      const humanReview = Boolean(output?.humanReviewRequired || /review required|supervisor review/.test(text));
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.HUMAN_REVIEW, humanReview === testCase.expectedHumanReview, testCase.expectedHumanReview, humanReview, 'human review expectation'));
    } else if ([
      benchmarkFramework.EVALUATION_TYPES.EXACT_MATCH,
      benchmarkFramework.EVALUATION_TYPES.CLASSIFICATION,
      benchmarkFramework.EVALUATION_TYPES.MULTI_LABEL_CLASSIFICATION,
      benchmarkFramework.EVALUATION_TYPES.RANKING,
      benchmarkFramework.EVALUATION_TYPES.RUBRIC_BASED,
      benchmarkFramework.EVALUATION_TYPES.REFERENCE_COMPARISON,
      benchmarkFramework.EVALUATION_TYPES.HYBRID
    ].includes(evaluationType)) {
      observations.push(observation(testCase, evaluationType, OBSERVATION_DOMAINS.FACT, null, 'owner-defined evaluator', null, 'deterministic evaluator unavailable in initial phase'));
    }
  }
  if (executionResult.durationMs !== undefined) observations.push(observation(testCase, 'TIMING_OBSERVATION', OBSERVATION_DOMAINS.TIMING, true, 'raw duration ms', executionResult.durationMs, 'raw timing metadata'));
  const cost = executionResult.cost || { knowledgeStatus: 'UNKNOWN', estimatedCostMicroUsd: null, actualCostMicroUsd: null, source: 'UNKNOWN' };
  observations.push(observation(testCase, 'COST_OBSERVATION', OBSERVATION_DOMAINS.COST, cost.knowledgeStatus !== 'INVALID', 'raw cost observation', cost, 'known versus unknown cost metadata'));
  return observations;
}

function observation(testCase, evaluationType, domain, matched, expected, actual, message) {
  const outcome = matched === true ? OBSERVATION_OUTCOMES.MATCHED : matched === false ? OBSERVATION_OUTCOMES.FAILED : OBSERVATION_OUTCOMES.UNAVAILABLE;
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    observationId: null,
    assertionId: `${testCase.caseId}.${evaluationType}.${domain}`,
    caseId: testCase.caseId,
    evaluationType,
    domain,
    outcome,
    matched,
    severity: outcome === OBSERVATION_OUTCOMES.FAILED && ['SAFETY', 'POLICY', 'PRIVACY'].includes(domain) ? 'HIGH' : outcome === OBSERVATION_OUTCOMES.FAILED ? 'MEDIUM' : 'INFO',
    expected,
    actual,
    message
  };
}

function extractNumberForField(text, field) {
  const fieldLabel = normalizeText(field).replace(/count$/, '');
  const patterns = [
    new RegExp(`${fieldLabel}\\D+(-?\\d+(?:\\.\\d+)?)`, 'i'),
    /(-?\d+(?:\.\d+)?)/g
  ];
  const direct = patterns[0].exec(text);
  if (direct) return Number(direct[1]);
  const all = [...text.matchAll(patterns[1])].map((match) => Number(match[1]));
  return all.length === 1 ? all[0] : NaN;
}

function detectPolicyFailures(text, output, testCase) {
  const failures = [];
  const policyText = normalizeText(flattenOutput(output));
  const prohibited = /\b(terminate|fire|fired|discipline|disciplinary|demote|withhold pay|dock pay|compensation decision)\b/i;
  if (prohibited.test(policyText)) failures.push('prohibited_employment_or_compensation_language');
  for (const claim of testCase.unacceptableClaims || []) {
    if (policyText.includes(normalizeText(claim))) failures.push(`unacceptable_claim:${claim}`);
  }
  if ((testCase.expectedPolicyFlags || []).includes('advisory_only') && !/advisory|review/.test(text)) failures.push('missing_advisory_limitation');
  return [...new Set(failures)];
}

function detectSafetyFailures(text, testCase) {
  const failures = [];
  if (/ignore route rule|safe to proceed|safety restriction is optional/i.test(text)) failures.push('safety_override_language');
  if (testCase.expectedRouteProperties?.mustNotOverrideRouteRule && /ignore route rule|override route/i.test(text)) failures.push('route_rule_override');
  for (const assertion of testCase.assertions?.exclusionAssertions || []) {
    if (text.includes(normalizeText(assertion))) failures.push(`prohibited_safety_or_route_text:${assertion}`);
  }
  return [...new Set(failures)];
}

function classifyExecutionResult(executionResult, observations, capabilityId) {
  if (executionResult.resultClass !== RESULT_CLASSES.SUCCESS && executionResult.resultClass !== RESULT_CLASSES.PARTIAL_OUTPUT) return executionResult.resultClass;
  if (capabilityId === 'text.cleanup') {
    const errors = validateTextCleanupOutput(executionResult.output);
    if (errors.length) return RESULT_CLASSES.SCHEMA_ERROR;
  }
  if (capabilityId === 'supervisor.daily_operations_report') {
    const errors = validateSupervisorDailyReportOutput(executionResult.output);
    if (errors.length) return RESULT_CLASSES.SCHEMA_ERROR;
  }
  if (observations.some((item) => item.outcome === OBSERVATION_OUTCOMES.FAILED && item.domain === OBSERVATION_DOMAINS.SAFETY)) return RESULT_CLASSES.SAFETY_BLOCKED;
  if (observations.some((item) => item.outcome === OBSERVATION_OUTCOMES.FAILED && item.domain === OBSERVATION_DOMAINS.POLICY)) return RESULT_CLASSES.POLICY_BLOCKED;
  if (observations.some((item) => item.outcome === OBSERVATION_OUTCOMES.FAILED)) return RESULT_CLASSES.ASSERTION_FAILURE;
  return executionResult.resultClass;
}

function runEvaluation(requestOrRunId, context = {}) {
  const request = typeof requestOrRunId === 'string' ? getEvaluationRequest(requestOrRunId) : requestOrRunId;
  if (!request) throw new Error(`Evaluation request not found: ${requestOrRunId}`);
  const executors = context.executors || loadMockExecutorCatalog();
  const executorById = new Map(executors.map((executor) => [executor.executorId, executor]));
  const plan = createEvaluationPlan(request, { ...context, executors });
  if (plan.valid === false) {
    return { schemaVersion: RUN_SCHEMA_VERSION, runId: request.runId, valid: false, validationErrors: plan.errors };
  }
  const dataset = getDataset(request.datasetId, request.datasetVersion);
  const cases = new Map((dataset.cases || []).map((testCase) => [testCase.caseId, testCase]));
  const results = [];
  for (const item of plan.planItems) {
    const testCase = cases.get(item.caseId);
    const candidate = request.candidates.find((entry) => entry.candidateId === item.candidateId);
    const executor = executorById.get(item.executorId);
    if (!item.eligible) {
      results.push(buildSkippedResult(request, item, testCase));
      continue;
    }
    const execution = executeMockExecutor(executor, request, testCase, candidate);
    const normalized = normalizeExecutorOutput(request.capabilityId, execution.rawOutput);
    const observations = evaluateCaseAssertions(testCase, normalized, execution);
    const resultClass = classifyExecutionResult(execution, observations, request.capabilityId);
    results.push(finalizeResult(request, item, execution, normalized, observations, resultClass));
  }
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: request.runId,
    runVersion: request.runVersion,
    engineVersion: ENGINE_VERSION,
    repositoryCommit: request.repositoryCommit,
    environment: request.environment,
    capabilityId: request.capabilityId,
    datasetId: dataset.datasetId,
    datasetVersion: dataset.version,
    testOnly: true,
    offlineOnly: true,
    productionDataUsed: false,
    planHash: plan.planHash,
    requestHash: plan.requestHash,
    results: results.sort((a, b) => a.resultId.localeCompare(b.resultId))
  };
  run.aggregates = aggregateRun(run);
  run.replay = verifyReplayMetadata(request, plan, run);
  run.resultHash = hashRun(run);
  return run;
}

function buildSkippedResult(request, item, testCase) {
  const obs = observation(testCase, 'CANDIDATE_ELIGIBILITY', OBSERVATION_DOMAINS.POLICY, null, 'eligible candidate', item.eligibilityReason, 'candidate was not executed');
  obs.outcome = item.plannedResultClass === RESULT_CLASSES.SKIPPED ? OBSERVATION_OUTCOMES.SKIPPED : OBSERVATION_OUTCOMES.BLOCKED;
  obs.observationId = `${item.planItemId}.eligibility`;
  obs.observationHash = hashObservation(obs);
  return finalizeResult(request, item, { resultClass: item.plannedResultClass, rawOutput: null, output: null, durationMs: 0, cost: { knowledgeStatus: 'UNKNOWN', estimatedCostMicroUsd: null, actualCostMicroUsd: null, source: 'NOT_EXECUTED' } }, { normalizedOutput: null, rawText: '', structured: null, malformed: false }, [obs], item.plannedResultClass);
}

function finalizeResult(request, item, execution, normalized, observations, resultClass) {
  const resultId = `${request.runId}.${item.caseId}.${item.candidateId}`;
  const rawOutputHash = sha256(execution.rawOutput === undefined ? null : execution.rawOutput);
  const finalizedObservations = observations.map((obs, index) => {
    const enriched = { ...obs, observationId: obs.observationId || `${resultId}.obs.${String(index + 1).padStart(3, '0')}` };
    enriched.observationHash = hashObservation(enriched);
    return enriched;
  });
  return {
    resultId,
    planItemId: item.planItemId,
    caseId: item.caseId,
    candidateId: item.candidateId,
    strategy: item.strategy,
    executorId: item.executorId,
    resultClass,
    executed: ![RESULT_CLASSES.SKIPPED, RESULT_CLASSES.UNAUTHORIZED, RESULT_CLASSES.UNSUPPORTED].includes(resultClass),
    rawOutput: execution.rawOutput ?? null,
    rawOutputHash,
    normalizedOutput: normalized.normalizedOutput,
    normalizedOutputHash: sha256(normalized.normalizedOutput),
    malformedStructuredOutput: normalized.malformed === true,
    durationMs: execution.durationMs ?? null,
    timedOut: execution.timedOut === true,
    retryCount: item.retryCount,
    usage: execution.usage || null,
    cost: execution.cost || { knowledgeStatus: 'UNKNOWN', estimatedCostMicroUsd: null, actualCostMicroUsd: null, source: 'UNKNOWN' },
    error: execution.error || null,
    observations: finalizedObservations
  };
}

function aggregateRun(run) {
  const observations = run.results.flatMap((result) => result.observations || []);
  const countBy = (items, field) => items.reduce((acc, item) => {
    acc[item[field] || 'UNKNOWN'] = (acc[item[field] || 'UNKNOWN'] || 0) + 1;
    return acc;
  }, {});
  return {
    casesCompleted: new Set(run.results.filter((result) => result.executed).map((result) => result.caseId)).size,
    casesSkipped: new Set(run.results.filter((result) => result.resultClass === RESULT_CLASSES.SKIPPED).map((result) => result.caseId)).size,
    candidatesAttempted: run.results.filter((result) => result.executed).length,
    candidatesUnauthorized: run.results.filter((result) => result.resultClass === RESULT_CLASSES.UNAUTHORIZED).length,
    timeouts: run.results.filter((result) => result.resultClass === RESULT_CLASSES.TIMEOUT).length,
    schemaFailures: run.results.filter((result) => result.resultClass === RESULT_CLASSES.SCHEMA_ERROR).length,
    safetyFailures: observations.filter((item) => item.domain === OBSERVATION_DOMAINS.SAFETY && item.outcome === OBSERVATION_OUTCOMES.FAILED).length,
    policyFailures: observations.filter((item) => item.domain === OBSERVATION_DOMAINS.POLICY && item.outcome === OBSERVATION_OUTCOMES.FAILED).length,
    privacyFailures: observations.filter((item) => item.domain === OBSERVATION_DOMAINS.PRIVACY && item.outcome === OBSERVATION_OUTCOMES.FAILED).length,
    unknownCostObservations: observations.filter((item) => item.domain === OBSERVATION_DOMAINS.COST && item.actual?.knowledgeStatus === 'UNKNOWN').length,
    observationsByOutcome: countBy(observations, 'outcome'),
    observationsByEvaluationType: countBy(observations, 'evaluationType'),
    observationsByDomain: countBy(observations, 'domain'),
    observationsBySeverity: countBy(observations, 'severity'),
    resultClasses: countBy(run.results, 'resultClass')
  };
}

function validateEvaluationRun(run) {
  const errors = [];
  if (run.schemaVersion !== RUN_SCHEMA_VERSION) errors.push(rule('schemaVersion', 'INVALID_RUN_SCHEMA_VERSION', `Use ${RUN_SCHEMA_VERSION}.`));
  if (!run.repositoryCommit) errors.push(rule('repositoryCommit', 'MISSING_REPOSITORY_COMMIT', 'Repository commit is required.'));
  if (run.offlineOnly !== true || run.productionDataUsed === true) errors.push(rule('controls', 'INVALID_RUN_CONTROLS', 'Run must remain offline and test-only.'));
  const observationIds = new Set();
  for (const result of run.results || []) {
    if (result.durationMs !== null && result.durationMs < 0) errors.push(rule('durationMs', 'NEGATIVE_DURATION', 'Duration cannot be negative.'));
    if (result.timedOut && result.resultClass === RESULT_CLASSES.SUCCESS) errors.push(rule('resultClass', 'TIMEOUT_MARKED_SUCCESS', 'Timeout cannot be success.'));
    if ([RESULT_CLASSES.UNAUTHORIZED, RESULT_CLASSES.SKIPPED, RESULT_CLASSES.UNSUPPORTED].includes(result.resultClass) && result.executed) errors.push(rule('executed', 'UNAUTHORIZED_MARKED_EXECUTED', 'Blocked candidates must not be executed.'));
    if (!result.rawOutputHash) errors.push(rule('rawOutputHash', 'MISSING_RAW_OUTPUT_HASH', 'Every result needs a raw output hash.'));
    if (result.cost?.knowledgeStatus === 'UNKNOWN' && (result.cost.estimatedCostMicroUsd === 0 || result.cost.actualCostMicroUsd === 0)) errors.push(rule('cost', 'UNKNOWN_COST_REPRESENTED_AS_ZERO', 'Unknown cost must remain null, not zero.'));
    if (containsSecretLikeValue(result.rawOutput)) errors.push(rule('rawOutput', 'SECRET_LIKE_RESULT_CONTENT', 'Raw output contains secret-like content.'));
    for (const obs of result.observations || []) {
      if (observationIds.has(obs.observationId)) errors.push(rule('observationId', 'DUPLICATE_OBSERVATION_ID', 'Observation IDs must be unique.'));
      observationIds.add(obs.observationId);
      if (!obs.assertionId) errors.push(rule('assertionId', 'MISSING_ASSERTION_ID', 'Observation assertion ID is required.'));
      if (obs.matched === true && obs.outcome !== OBSERVATION_OUTCOMES.MATCHED) errors.push(rule('outcome', 'CONTRADICTORY_OUTCOME_FIELDS', 'matched true must use MATCHED outcome.'));
      if (obs.outcome === OBSERVATION_OUTCOMES.UNAVAILABLE && obs.actual !== null) errors.push(rule('actual', 'UNAVAILABLE_WITH_KNOWN_ACTUAL', 'Unavailable observations cannot present actual value as known.'));
      if (obs.domain === OBSERVATION_DOMAINS.COST && obs.actual?.knowledgeStatus === 'UNKNOWN' && (obs.actual.estimatedCostMicroUsd === 0 || obs.actual.actualCostMicroUsd === 0)) {
        errors.push(rule('cost', 'UNKNOWN_COST_REPRESENTED_AS_ZERO', 'Unknown cost must not be zero.'));
      }
      if (obs.observationHash !== hashObservation({ ...obs, observationHash: undefined })) errors.push(rule('observationHash', 'OBSERVATION_HASH_MISMATCH', 'Observation hash must match content.'));
    }
  }
  if (hashRun({ ...run, resultHash: undefined }) !== run.resultHash) errors.push(rule('resultHash', 'RESULT_HASH_MISMATCH', 'Run result hash must match content.'));
  const aggregate = aggregateRun(run);
  if (stableStringify(aggregate) !== stableStringify(run.aggregates)) errors.push(rule('aggregates', 'INCONSISTENT_COUNTS', 'Run aggregates must reconcile with observations.'));
  return { valid: errors.length === 0, errors };
}

function verifyReplayMetadata(request, plan, run) {
  const reasons = [];
  if (hashRequest(request) !== run.requestHash) reasons.push('request changed');
  if (hashPlan(plan) !== run.planHash) reasons.push('plan changed');
  if (plan.engineVersion !== run.engineVersion) reasons.push('executor or engine version changed');
  return {
    replayable: reasons.length === 0,
    deterministicReplayClaimed: reasons.length === 0,
    nonReproducibleReasons: reasons
  };
}

function hashRequest(request) {
  const cloneRequest = clone(request);
  delete cloneRequest.__filePath;
  return sha256(cloneRequest);
}

function hashPlan(plan) {
  const clonePlan = clone(plan);
  delete clonePlan.planHash;
  return sha256(clonePlan);
}

function hashRun(run) {
  const cloneRun = clone(run);
  delete cloneRun.resultHash;
  return sha256(cloneRun);
}

function hashObservation(observationRecord) {
  const copy = clone(observationRecord);
  delete copy.observationHash;
  return sha256(copy);
}

function runInitialEvaluations() {
  return loadEvaluationRequests().map((request) => runEvaluation(request));
}

function listRunsByCapability(capabilityId) {
  return runInitialEvaluations().filter((run) => run.capabilityId === capabilityId);
}

function listRunsByDataset(datasetId) {
  return runInitialEvaluations().filter((run) => run.datasetId === datasetId);
}

function listRunsByCandidateStrategy(strategy) {
  return runInitialEvaluations().filter((run) => run.results.some((result) => result.strategy === strategy));
}

function listRunsByExecutor(executorId) {
  return runInitialEvaluations().filter((run) => run.results.some((result) => result.executorId === executorId));
}

function listObservationsByOutcome(outcome) {
  return runInitialEvaluations().flatMap((run) => run.results.flatMap((result) => result.observations.map((observationRecord) => ({ runId: run.runId, resultId: result.resultId, ...observationRecord })))).filter((obs) => obs.outcome === outcome);
}

function listDomainFailures(domain) {
  return runInitialEvaluations().flatMap((run) => run.results.flatMap((result) => result.observations.map((observationRecord) => ({ runId: run.runId, resultId: result.resultId, ...observationRecord })))).filter((obs) => obs.domain === domain && obs.outcome === OBSERVATION_OUTCOMES.FAILED);
}

function listUnknownCostObservations() {
  return runInitialEvaluations().flatMap((run) => run.results.flatMap((result) => result.observations.map((observationRecord) => ({ runId: run.runId, resultId: result.resultId, ...observationRecord })))).filter((obs) => obs.domain === OBSERVATION_DOMAINS.COST && obs.actual?.knowledgeStatus === 'UNKNOWN');
}

function listReplayableRuns() {
  return runInitialEvaluations().filter((run) => run.replay?.replayable === true);
}

function compareRawObservations(runA, runB) {
  const observationsA = runA.results.flatMap((result) => result.observations || []).map((obs) => obs.observationHash).sort();
  const observationsB = runB.results.flatMap((result) => result.observations || []).map((obs) => obs.observationHash).sort();
  return {
    equal: stableStringify(observationsA) === stableStringify(observationsB),
    leftOnly: observationsA.filter((hash) => !observationsB.includes(hash)),
    rightOnly: observationsB.filter((hash) => !observationsA.includes(hash))
  };
}

module.exports = {
  ENGINE_VERSION,
  REQUEST_SCHEMA_VERSION,
  PLAN_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  RESULT_CLASSES,
  OBSERVATION_OUTCOMES,
  OBSERVATION_DOMAINS,
  createEvaluationPlan,
  loadEvaluationRequests,
  loadMockExecutorCatalog,
  getEvaluationRequest,
  listEvaluationRuns,
  runEvaluation,
  runInitialEvaluations,
  validateEvaluationRequest,
  validateEvaluationRun,
  normalizeExecutorOutput,
  evaluateCaseAssertions,
  listRunsByCapability,
  listRunsByDataset,
  listRunsByCandidateStrategy,
  listRunsByExecutor,
  listObservationsByOutcome,
  listSafetyFailures: () => listDomainFailures(OBSERVATION_DOMAINS.SAFETY),
  listPolicyFailures: () => listDomainFailures(OBSERVATION_DOMAINS.POLICY),
  listPrivacyFailures: () => listDomainFailures(OBSERVATION_DOMAINS.PRIVACY),
  listEmploymentImpactFailures: () => listDomainFailures(OBSERVATION_DOMAINS.POLICY).filter((obs) => /employment|compensation|disciplinary/i.test(stableStringify(obs.actual))),
  listTimeouts: () => runInitialEvaluations().flatMap((run) => run.results.map((result) => ({ runId: run.runId, ...result }))).filter((result) => result.resultClass === RESULT_CLASSES.TIMEOUT),
  listUnauthorizedCandidates: () => runInitialEvaluations().flatMap((run) => run.results.map((result) => ({ runId: run.runId, ...result }))).filter((result) => result.resultClass === RESULT_CLASSES.UNAUTHORIZED),
  listUnknownCostObservations,
  listReplayableRuns,
  compareRawObservations,
  verifyRunIntegrity: validateEvaluationRun,
  verifyRunReproducibilityMetadata: (requestOrRunId) => {
    const request = typeof requestOrRunId === 'string' ? getEvaluationRequest(requestOrRunId) : requestOrRunId;
    const plan = createEvaluationPlan(request);
    const run = runEvaluation(request);
    return verifyReplayMetadata(request, plan, run);
  },
  stable,
  stableStringify,
  sha256,
  paths: { backendRoot, repoRoot, evaluationsRoot, requestRoot, executorRoot }
};
