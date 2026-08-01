const fs = require('fs');
const path = require('path');
const registry = require('./enterpriseCapabilityRegistry');
const scoring = require('./scoringEngine');
const costGovernance = require('./costGovernance');
const { PROFILE_DEFINITIONS } = require('./profiles');
const { EXECUTION_STRATEGIES } = require('./constants');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const decisionRoot = path.join(backendRoot, 'execution-decisions');
const policyRoot = path.join(decisionRoot, 'policy-profiles');
const requestRoot = path.join(decisionRoot, 'requests');

const DECISION_ENGINE_VERSION = 'intelligence.execution.decision.engine.v1';
const DECISION_REQUEST_SCHEMA_VERSION = 'intelligence.execution.decision.request.v1';
const DECISION_POLICY_PROFILE_SCHEMA_VERSION = 'intelligence.execution.decision.policy.profile.v1';
const DECISION_RECORD_SCHEMA_VERSION = 'intelligence.execution.decision.record.v1';

const DECISION_POLICY_LIFECYCLE_STATES = Object.freeze({ DRAFT: 'DRAFT', VALIDATING: 'VALIDATING', APPROVED_FOR_TEST: 'APPROVED_FOR_TEST', DECISION_READY: 'DECISION_READY', FROZEN: 'FROZEN', DEPRECATED: 'DEPRECATED', RETIRED: 'RETIRED' });
const DECISION_STRATEGIES = Object.freeze({ CACHE: 'CACHE', DETERMINISTIC_RULES: 'DETERMINISTIC_RULES', SQL: 'SQL', STATISTICAL_FORMULA: 'STATISTICAL_FORMULA', GEOSPATIAL_ENGINE: 'GEOSPATIAL_ENGINE', OPTIMIZATION_ENGINE: 'OPTIMIZATION_ENGINE', CONVENTIONAL_ML: 'CONVENTIONAL_ML', LOCAL_INFERENCE: 'LOCAL_INFERENCE', HOSTED_ECONOMY: 'HOSTED_ECONOMY', HOSTED_BALANCED: 'HOSTED_BALANCED', HOSTED_PREMIUM: 'HOSTED_PREMIUM', HUMAN_REVIEW: 'HUMAN_REVIEW' });
const STRATEGY_TO_RUNTIME = Object.freeze({ CACHE: EXECUTION_STRATEGIES.CACHE, DETERMINISTIC_RULES: EXECUTION_STRATEGIES.DETERMINISTIC_RULES, SQL: EXECUTION_STRATEGIES.SQL_ANALYTICS, STATISTICAL_FORMULA: EXECUTION_STRATEGIES.STATISTICAL_MODEL, GEOSPATIAL_ENGINE: EXECUTION_STRATEGIES.GEOSPATIAL_ENGINE, OPTIMIZATION_ENGINE: EXECUTION_STRATEGIES.OPTIMIZATION_ENGINE, CONVENTIONAL_ML: EXECUTION_STRATEGIES.CONVENTIONAL_ML, LOCAL_INFERENCE: EXECUTION_STRATEGIES.LOCAL_MODEL, HOSTED_ECONOMY: EXECUTION_STRATEGIES.HOSTED_ECONOMY_MODEL, HOSTED_BALANCED: EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL, HOSTED_PREMIUM: EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL, HUMAN_REVIEW: EXECUTION_STRATEGIES.HUMAN_REVIEW });
const RUNTIME_TO_STRATEGY = Object.freeze(Object.fromEntries(Object.entries(STRATEGY_TO_RUNTIME).map(([key, value]) => [value, key])));
const DEFAULT_STRATEGY_ORDER = Object.freeze(Object.values(DECISION_STRATEGIES));
const FEASIBILITY_STATUSES = Object.freeze({ FEASIBLE: 'FEASIBLE', CONDITIONALLY_FEASIBLE: 'CONDITIONALLY_FEASIBLE', INFEASIBLE: 'INFEASIBLE', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE', UNAUTHORIZED: 'UNAUTHORIZED', UNSUPPORTED: 'UNSUPPORTED', UNAVAILABLE: 'UNAVAILABLE', PROHIBITED: 'PROHIBITED', OVER_BUDGET: 'OVER_BUDGET', PREMIUM_APPROVAL_REQUIRED: 'PREMIUM_APPROVAL_REQUIRED', HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED', NOT_APPLICABLE: 'NOT_APPLICABLE' });
const DECISION_OUTCOMES = Object.freeze({ SELECT_ADVISORY_CANDIDATE: 'SELECT_ADVISORY_CANDIDATE', SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK: 'SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK', HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED', DEFER_PENDING_EVIDENCE: 'DEFER_PENDING_EVIDENCE', ABSTAIN_NO_SAFE_CANDIDATE: 'ABSTAIN_NO_SAFE_CANDIDATE', ABSTAIN_POLICY_PROHIBITED: 'ABSTAIN_POLICY_PROHIBITED', ABSTAIN_BUDGET_RESTRICTED: 'ABSTAIN_BUDGET_RESTRICTED', ABSTAIN_PREMIUM_APPROVAL_REQUIRED: 'ABSTAIN_PREMIUM_APPROVAL_REQUIRED', NO_APPLICABLE_CANDIDATE: 'NO_APPLICABLE_CANDIDATE', INVALID_REQUEST: 'INVALID_REQUEST' });
const REASON_CODES = Object.freeze({ CAPABILITY_NOT_SUPPORTED: 'CAPABILITY_NOT_SUPPORTED', STRATEGY_NOT_ALLOWED: 'STRATEGY_NOT_ALLOWED', EXECUTOR_DISABLED: 'EXECUTOR_DISABLED', PROFILE_INCOMPATIBLE: 'PROFILE_INCOMPATIBLE', HOSTED_EXECUTION_NOT_AUTHORIZED: 'HOSTED_EXECUTION_NOT_AUTHORIZED', PREMIUM_EXECUTION_NOT_AUTHORIZED: 'PREMIUM_EXECUTION_NOT_AUTHORIZED', HUMAN_REVIEW_NOT_AUTHORIZED: 'HUMAN_REVIEW_NOT_AUTHORIZED', ORGANIZATION_CONTEXT_MISSING: 'ORGANIZATION_CONTEXT_MISSING', EVALUATION_EVIDENCE_MISSING: 'EVALUATION_EVIDENCE_MISSING', SCORE_EVIDENCE_MISSING: 'SCORE_EVIDENCE_MISSING', COST_EVIDENCE_MISSING: 'COST_EVIDENCE_MISSING', EVIDENCE_INCOMPATIBLE: 'EVIDENCE_INCOMPATIBLE', EVIDENCE_STALE: 'EVIDENCE_STALE', EVIDENCE_INTEGRITY_FAILED: 'EVIDENCE_INTEGRITY_FAILED', INSUFFICIENT_CONFIDENCE: 'INSUFFICIENT_CONFIDENCE', INSUFFICIENT_COMPLETENESS: 'INSUFFICIENT_COMPLETENESS', SAFETY_GATE_FAILED: 'SAFETY_GATE_FAILED', POLICY_GATE_FAILED: 'POLICY_GATE_FAILED', PRIVACY_GATE_FAILED: 'PRIVACY_GATE_FAILED', SECURITY_GATE_FAILED: 'SECURITY_GATE_FAILED', EMPLOYMENT_GOVERNANCE_GATE_FAILED: 'EMPLOYMENT_GOVERNANCE_GATE_FAILED', RELIABILITY_THRESHOLD_FAILED: 'RELIABILITY_THRESHOLD_FAILED', LATENCY_THRESHOLD_FAILED: 'LATENCY_THRESHOLD_FAILED', QUALITY_THRESHOLD_FAILED: 'QUALITY_THRESHOLD_FAILED', HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED', COST_UNKNOWN: 'COST_UNKNOWN', COST_CEILING_EXCEEDED: 'COST_CEILING_EXCEEDED', BUDGET_WARNING: 'BUDGET_WARNING', BUDGET_SOFT_LIMIT: 'BUDGET_SOFT_LIMIT', BUDGET_HARD_LIMIT: 'BUDGET_HARD_LIMIT', PREMIUM_RESTRICTED: 'PREMIUM_RESTRICTED', CHEAPEST_SUFFICIENT: 'CHEAPEST_SUFFICIENT', DETERMINISTIC_TIE_BREAK: 'DETERMINISTIC_TIE_BREAK', HIGHER_CONFIDENCE_TIE_BREAK: 'HIGHER_CONFIDENCE_TIE_BREAK', HIGHER_COMPLETENESS_TIE_BREAK: 'HIGHER_COMPLETENESS_TIE_BREAK', FALLBACK_ONLY: 'FALLBACK_ONLY', NO_FEASIBLE_CANDIDATE: 'NO_FEASIBLE_CANDIDATE' });
const SECRET_PATTERNS = [/sk-[a-z0-9]{12,}/i, /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i, /https:\/\/[^"'\s]+\.r2\.dev\/[^\s"']+/i];

function stable(value) { return scoring.stable(value); }
function stableStringify(value) { return scoring.stableStringify(value); }
function sha256(value) { return scoring.sha256(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function listJsonFiles(dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => { const full = path.join(dir, entry.name); if (entry.isDirectory()) return listJsonFiles(full); return entry.isFile() && entry.name.endsWith('.json') ? [full] : []; }); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function attachFilePath(record, filePath) { Object.defineProperty(record, '__filePath', { value: filePath, enumerable: false }); return record; }
function validationError(field, rule, guidance) { return { field, rule, guidance }; }
function containsSecretLikeValue(value) { const text = typeof value === 'string' ? value : stableStringify(value); return SECRET_PATTERNS.some((pattern) => pattern.test(text)); }
function strategyRank(strategy, order = DEFAULT_STRATEGY_ORDER) { const index = order.indexOf(strategy); return index === -1 ? Number.MAX_SAFE_INTEGER : index; }
function policyProfileHash(profile) { const copy = clone(profile); delete copy.__filePath; if (copy.integrity) copy.integrity.contentHash = null; return sha256(copy); }
function decisionRequestHash(request) { const copy = clone(request); delete copy.__filePath; return sha256(copy); }
function decisionRecordHash(record) { const copy = clone(record); delete copy.decisionRecordHash; return sha256(copy); }
function sourceEvidenceHash(parts) { return sha256(parts); }

function loadDecisionPolicyProfiles(root = policyRoot) { return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath)).sort((a, b) => `${a.decisionPolicyProfileId}@${a.version}`.localeCompare(`${b.decisionPolicyProfileId}@${b.version}`)); }
function getDecisionPolicyProfile(id, version = null) { return loadDecisionPolicyProfiles().find((item) => item.decisionPolicyProfileId === id && (!version || item.version === version)) || null; }
function loadDecisionRequests(root = requestRoot) { return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath)).sort((a, b) => a.decisionRequestId.localeCompare(b.decisionRequestId)); }
function getDecisionRequest(id) { return loadDecisionRequests().find((item) => item.decisionRequestId === id) || null; }
function resolveScoringRun(id) { try { const run = scoring.calculateScoreRun(id); return scoring.validateScoreRun(run).valid ? run : null; } catch { return null; } }
function resolveCostRun(id) { try { const run = costGovernance.calculateCostGovernanceRun(id); return costGovernance.validateCostGovernanceRun(run).valid ? run : null; } catch { return null; } }
function relatedCostRecords(scoreRecord, costRuns) { return costRuns.flatMap((run) => run.costRecords.map((record) => ({ run, record }))).filter(({ record }) => record.capabilityId === scoreRecord.capabilityId && record.candidateStrategyId === scoreRecord.candidateStrategyId && record.candidateExecutorId === scoreRecord.candidateExecutorId && record.datasetId === scoreRecord.datasetId && record.scoreId === scoreRecord.scoreId); }
function average(values) { const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value)); return usable.length ? Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 100) / 100 : null; }
function minKnownCost(records, metric) { const values = records.map((record) => record.costMetrics?.[metric] ?? record.costSummary?.totalKnownCostMicroUsd).filter((value) => typeof value === 'number' && Number.isFinite(value)); return values.length ? Math.min(...values) : null; }
function validateDecisionPolicyProfile(profile, profiles = loadDecisionPolicyProfiles()) {
  const errors = [];
  const duplicateCount = profiles.filter((item) => item.decisionPolicyProfileId === profile.decisionPolicyProfileId && item.version === profile.version).length;
  if (duplicateCount > 1) errors.push(validationError('decisionPolicyProfileId', 'DUPLICATE_POLICY_ID_VERSION', 'Decision Policy Profile ID and version must be unique.'));
  if (profile.schemaVersion !== DECISION_POLICY_PROFILE_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_DECISION_POLICY_PROFILE_SCHEMA', `Use ${DECISION_POLICY_PROFILE_SCHEMA_VERSION}.`));
  if (!Object.values(DECISION_POLICY_LIFECYCLE_STATES).includes(profile.lifecycleState)) errors.push(validationError('lifecycleState', 'INVALID_LIFECYCLE', 'Use a supported decision policy lifecycle state.'));
  if (profile.productionUseAllowed === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_APPROVED_SYNTHETIC_PROFILE', 'Initial decision policies must be synthetic and test-only.'));
  if (profile.approvedBy || profile.approvedAt || profile.decisionRecordId) errors.push(validationError('approvedBy', 'INVENTED_OWNER_APPROVAL', 'Do not invent owner approval for synthetic decision policies.'));
  const order = profile.defaultStrategyPreferenceOrder || [];
  const seen = new Set();
  for (const strategy of [...order, ...(profile.allowedStrategies || []), ...(profile.prohibitedStrategies || [])]) {
    if (!Object.values(DECISION_STRATEGIES).includes(strategy)) errors.push(validationError('strategy', 'UNKNOWN_STRATEGY', `Unknown decision strategy ${strategy}.`));
  }
  for (const strategy of order) {
    if (seen.has(strategy)) errors.push(validationError('defaultStrategyPreferenceOrder', 'DUPLICATE_STRATEGY_PREFERENCE', 'Strategy preference order must not duplicate a strategy.'));
    seen.add(strategy);
  }
  if (profile.premiumStrategyPolicy?.premiumAllowed === true && profile.premiumStrategyPolicy?.requiresExplicitApproval !== true) errors.push(validationError('premiumStrategyPolicy', 'CONTRADICTORY_PREMIUM_RULES', 'Premium execution requires explicit approval.'));
  if (profile.criticalGatePolicy?.safetyOverrideAllowed === true) errors.push(validationError('criticalGatePolicy.safetyOverrideAllowed', 'SAFETY_OVERRIDE_PERMITTED', 'Decision policy must not override safety gates.'));
  if (!profile.costPolicy?.unknownCostPolicy) errors.push(validationError('costPolicy.unknownCostPolicy', 'MISSING_UNKNOWN_COST_POLICY', 'Unknown-cost policy is required.'));
  if (!['CHEAPEST_SUFFICIENT', 'WEIGHTED_TRACEABLE'].includes(profile.utilityMethod)) errors.push(validationError('utilityMethod', 'OPAQUE_UTILITY_FORMULA', 'Use a transparent versioned utility method.'));
  for (const rule of profile.tieBreakerOrder || []) {
    if (!['LOWER_STRATEGY_TIER', 'DETERMINISTIC_OVER_PROBABILISTIC', 'HIGHER_CONFIDENCE', 'HIGHER_COMPLETENESS', 'HIGHER_RELIABILITY', 'LOWER_LATENCY', 'BETTER_EXPLAINABILITY', 'BETTER_REPRODUCIBILITY', 'LOWER_RESOURCE_USE', 'LEXICAL_CANDIDATE_ID'].includes(rule)) errors.push(validationError('tieBreakerOrder', 'INVALID_TIE_BREAK_RULE', `Unsupported tie-break rule ${rule}.`));
  }
  if (containsSecretLikeValue(profile)) errors.push(validationError('profile', 'SECRET_LIKE_DECISION_POLICY_CONTENT', 'Decision policies must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function validateDecisionRequest(request, context = {}) {
  const errors = [];
  const requests = context.requests || loadDecisionRequests();
  const duplicateCount = requests.filter((item) => item.decisionRequestId === request.decisionRequestId).length;
  const capability = registry.getRuntimeCapability(request.capabilityId);
  const policy = getDecisionPolicyProfile(request.decisionPolicyProfileId, request.decisionPolicyProfileVersion);
  if (duplicateCount > 1) errors.push(validationError('decisionRequestId', 'DUPLICATE_DECISION_REQUEST_ID', 'Decision request IDs must be unique.'));
  if (request.schemaVersion !== DECISION_REQUEST_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_DECISION_REQUEST_SCHEMA', `Use ${DECISION_REQUEST_SCHEMA_VERSION}.`));
  if (!/^decision\.[a-z0-9_.-]+$/.test(request.decisionRequestId || '')) errors.push(validationError('decisionRequestId', 'INVALID_DECISION_REQUEST_ID', 'Use decision.<machine-readable-id>.'));
  if (!capability) errors.push(validationError('capabilityId', 'UNKNOWN_CAPABILITY', 'Reference a known registered capability.'));
  if (capability && request.capabilityVersion && capability.version !== request.capabilityVersion) errors.push(validationError('capabilityVersion', 'INVALID_CAPABILITY_VERSION', 'Capability version must match registry evidence.'));
  if (!policy) errors.push(validationError('decisionPolicyProfileId', 'UNKNOWN_DECISION_POLICY_PROFILE', 'Reference a known Decision Policy Profile.'));
  if (policy && !policy.supportedCapabilities.includes(request.capabilityId)) errors.push(validationError('capabilityId', 'POLICY_PROFILE_INCOMPATIBLE', 'Policy profile does not support this capability.'));
  for (const runId of request.scoreRunIds || []) {
    const run = resolveScoringRun(runId);
    if (!run) errors.push(validationError('scoreRunIds', 'INVALID_SCORE_EVIDENCE_REFERENCE', `Score run ${runId} is unknown or invalid.`));
    else if (!run.scoreRecords.some((record) => record.capabilityId === request.capabilityId)) errors.push(validationError('scoreRunIds', 'INCOMPATIBLE_SCORE_EVIDENCE', `Score run ${runId} does not contain requested capability evidence.`));
  }
  for (const runId of request.costGovernanceRunIds || []) {
    const run = resolveCostRun(runId);
    if (!run) errors.push(validationError('costGovernanceRunIds', 'INVALID_COST_EVIDENCE_REFERENCE', `Cost Governance run ${runId} is unknown or invalid.`));
    else if (!run.costRecords.some((record) => record.capabilityId === request.capabilityId)) errors.push(validationError('costGovernanceRunIds', 'INCOMPATIBLE_COST_EVIDENCE', `Cost Governance run ${runId} does not contain requested capability evidence.`));
  }
  for (const field of ['minimumConfidence', 'minimumCompleteness', 'minimumReliability']) {
    if (request[field] !== null && request[field] !== undefined && (request[field] < 0 || request[field] > 100)) errors.push(validationError(field, 'INVALID_THRESHOLD', 'Threshold percentages must be 0-100.'));
  }
  if (request.maximumLatencyMs !== null && request.maximumLatencyMs !== undefined && request.maximumLatencyMs < 0) errors.push(validationError('maximumLatencyMs', 'INVALID_LATENCY_REQUIREMENT', 'Latency requirement cannot be negative.'));
  for (const field of ['maximumCostPerRequestMicroUsd', 'maximumCostPerValidResultMicroUsd']) {
    if (request[field] !== null && request[field] !== undefined && request[field] < 0) errors.push(validationError(field, 'INVALID_COST_CEILING', 'Cost ceiling cannot be negative.'));
  }
  if (request.requiredStrategies?.length && request.prohibitedStrategies?.some((strategy) => request.requiredStrategies.includes(strategy))) errors.push(validationError('requiredStrategies', 'CONTRADICTORY_REQUIREMENTS', 'A strategy cannot be both required and prohibited.'));
  if (request.productionExecutionRequested === true) errors.push(validationError('productionExecutionRequested', 'PRODUCTION_EXECUTION_REQUEST_PROHIBITED', 'Decision Engine is advisory and test-only.'));
  if (request.liveProviderExecutionRequested === true) errors.push(validationError('liveProviderExecutionRequested', 'LIVE_PROVIDER_EXECUTION_PROHIBITED', 'Live provider execution is not allowed.'));
  if (request.premiumExecutionAllowed === true && !request.premiumApprovalReference) errors.push(validationError('premiumApprovalReference', 'UNAUTHORIZED_PREMIUM_REQUEST', 'Premium approval must be explicit synthetic evidence.'));
  if (request.humanImpactClassification === 'EMPLOYMENT_DECISION' && request.automatedEmployeeDecisionAllowed === true) errors.push(validationError('humanImpactClassification', 'PROHIBITED_AUTOMATIC_EMPLOYEE_DECISION', 'Automated employee-impacting decisions are prohibited.'));
  if (containsSecretLikeValue(request)) errors.push(validationError('request', 'SECRET_LIKE_DECISION_REQUEST_CONTENT', 'Decision requests must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function aggregateCandidate(scoreRecord, relatedCosts, policy, request, capability, executionProfile) {
  const decisionStrategy = RUNTIME_TO_STRATEGY[scoreRecord.candidateStrategyId] || scoreRecord.candidateStrategyId;
  const reasonCodes = [];
  const gateResults = [];
  const thresholdResults = [];
  const dimensionScores = scoreRecord.dimensionScores || [];
  for (const dim of dimensionScores) {
    const thresholdStatus = dim.threshold?.status || dim.status || 'UNKNOWN';
    if ((request.requiredCriticalGates || []).includes(dim.dimensionId) || dim.critical === true) {
      const blocking = ['NOT_MET', 'INVALID'].includes(thresholdStatus) || dim.status === 'INVALID';
      const unknownBlocking = thresholdStatus === 'UNKNOWN' && policy.criticalGatePolicy?.failClosedOnUnknown === true;
      const code = dim.dimensionId === 'SAFETY' ? REASON_CODES.SAFETY_GATE_FAILED : dim.dimensionId === 'POLICY_COMPLIANCE' ? REASON_CODES.POLICY_GATE_FAILED : dim.dimensionId === 'PRIVACY' ? REASON_CODES.PRIVACY_GATE_FAILED : dim.dimensionId === 'SECURITY' ? REASON_CODES.SECURITY_GATE_FAILED : dim.dimensionId === 'EMPLOYMENT_GOVERNANCE' ? REASON_CODES.EMPLOYMENT_GOVERNANCE_GATE_FAILED : REASON_CODES.QUALITY_THRESHOLD_FAILED;
      gateResults.push({ dimensionId: dim.dimensionId, status: blocking || unknownBlocking ? 'FAILED' : thresholdStatus === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'PASSED', score: dim.score, thresholdStatus, reasonCode: blocking || unknownBlocking ? code : null, critical: true });
      if (blocking || unknownBlocking) reasonCodes.push(code);
    }
    const required = request.minimumDimensionScores?.[dim.dimensionId] ?? policy.minimumDimensionScores?.[dim.dimensionId];
    if (required !== undefined && required !== null) {
      const status = typeof dim.score === 'number' ? (dim.score >= required ? 'MET' : 'NOT_MET') : (policy.insufficientEvidencePolicy === 'FAIL_CLOSED' ? 'INSUFFICIENT_EVIDENCE' : 'UNKNOWN');
      thresholdResults.push({ dimensionId: dim.dimensionId, requiredMinimum: required, score: dim.score, status });
      if (status === 'NOT_MET') reasonCodes.push(dim.dimensionId === 'LATENCY' ? REASON_CODES.LATENCY_THRESHOLD_FAILED : dim.dimensionId === 'RELIABILITY' ? REASON_CODES.RELIABILITY_THRESHOLD_FAILED : REASON_CODES.QUALITY_THRESHOLD_FAILED);
      if (status === 'INSUFFICIENT_EVIDENCE') reasonCodes.push(REASON_CODES.INSUFFICIENT_CONFIDENCE);
    }
  }
  const composite = scoreRecord.compositeScore?.gateAdjustedComposite ?? scoreRecord.compositeScore?.weightedComposite ?? 0;
  const confidenceScore = average([scoreRecord.confidence?.score, ...dimensionScores.map((dimension) => dimension.score)]);
  const completenessScore = scoreRecord.completeness?.score ?? average(dimensionScores.map((dimension) => dimension.status === 'NOT_APPLICABLE' ? 100 : (dimension.score === null ? null : 100)));
  if (request.minimumConfidence !== null && confidenceScore !== null && confidenceScore < request.minimumConfidence) reasonCodes.push(REASON_CODES.INSUFFICIENT_CONFIDENCE);
  if (request.minimumCompleteness !== null && completenessScore !== null && completenessScore < request.minimumCompleteness) reasonCodes.push(REASON_CODES.INSUFFICIENT_COMPLETENESS);
  if (!policy.allowedStrategies.includes(decisionStrategy) || request.prohibitedStrategies?.includes(decisionStrategy)) reasonCodes.push(REASON_CODES.STRATEGY_NOT_ALLOWED);
  if (!capability.allowedExecutionStrategies.includes(scoreRecord.candidateStrategyId)) reasonCodes.push(REASON_CODES.CAPABILITY_NOT_SUPPORTED);
  if (!executionProfile.allowedStrategies.includes(scoreRecord.candidateStrategyId)) reasonCodes.push(REASON_CODES.PROFILE_INCOMPATIBLE);
  const hosted = ['HOSTED_ECONOMY', 'HOSTED_BALANCED', 'HOSTED_PREMIUM'].includes(decisionStrategy);
  if (hosted && policy.hostedExecutionAllowed === false) reasonCodes.push(REASON_CODES.HOSTED_EXECUTION_NOT_AUTHORIZED);
  if (decisionStrategy === 'HOSTED_PREMIUM' && (!request.premiumExecutionAllowed || !request.premiumApprovalReference || policy.premiumStrategyPolicy?.premiumAllowed === false)) reasonCodes.push(REASON_CODES.PREMIUM_EXECUTION_NOT_AUTHORIZED, REASON_CODES.PREMIUM_RESTRICTED);
  if (request.requiredHumanReview === true && decisionStrategy !== 'HUMAN_REVIEW') reasonCodes.push(REASON_CODES.HUMAN_REVIEW_REQUIRED);
  if (!relatedCosts.length) reasonCodes.push(REASON_CODES.COST_EVIDENCE_MISSING);
  const costRecords = relatedCosts.map((item) => item.record);
  const comparableMetric = policy.costPolicy?.comparableCostMetric || 'costPerAttemptedRequestMicroUsd';
  const comparableCost = minKnownCost(costRecords, comparableMetric);
  const hasUnknownCost = costRecords.some((record) => record.costSummary.unknownComponentCount > 0);
  if (hasUnknownCost && request.allowUnknownCost === false) reasonCodes.push(REASON_CODES.COST_UNKNOWN);
  const ceiling = request.maximumCostPerRequestMicroUsd ?? policy.costPolicy?.maximumCostPerRequestMicroUsd ?? null;
  if (ceiling !== null && comparableCost !== null && comparableCost > ceiling) reasonCodes.push(REASON_CODES.COST_CEILING_EXCEEDED);
  if (costRecords.some((record) => record.budgetEvaluation.status === 'SIMULATED_BLOCK')) reasonCodes.push(REASON_CODES.BUDGET_HARD_LIMIT);
  if (scoreRecord.resultClass === 'UNAUTHORIZED') reasonCodes.push(REASON_CODES.HOSTED_EXECUTION_NOT_AUTHORIZED);
  if (scoreRecord.resultClass === 'TIMEOUT') reasonCodes.push(REASON_CODES.LATENCY_THRESHOLD_FAILED);
  if (scoreRecord.resultClass === 'POLICY_BLOCKED') reasonCodes.push(REASON_CODES.POLICY_GATE_FAILED);
  const uniqueReasons = [...new Set(reasonCodes)];
  let feasibilityStatus = FEASIBILITY_STATUSES.FEASIBLE;
  if (uniqueReasons.includes(REASON_CODES.PREMIUM_EXECUTION_NOT_AUTHORIZED)) feasibilityStatus = FEASIBILITY_STATUSES.PREMIUM_APPROVAL_REQUIRED;
  else if (uniqueReasons.includes(REASON_CODES.STRATEGY_NOT_ALLOWED)) feasibilityStatus = FEASIBILITY_STATUSES.PROHIBITED;
  else if (uniqueReasons.includes(REASON_CODES.HOSTED_EXECUTION_NOT_AUTHORIZED)) feasibilityStatus = FEASIBILITY_STATUSES.UNAUTHORIZED;
  else if (uniqueReasons.includes(REASON_CODES.COST_CEILING_EXCEEDED) || uniqueReasons.includes(REASON_CODES.BUDGET_HARD_LIMIT)) feasibilityStatus = FEASIBILITY_STATUSES.OVER_BUDGET;
  else if (uniqueReasons.some((reason) => reason.endsWith('_GATE_FAILED') || reason.endsWith('_THRESHOLD_FAILED'))) feasibilityStatus = FEASIBILITY_STATUSES.INFEASIBLE;
  else if (uniqueReasons.some((reason) => reason.includes('EVIDENCE') || reason === REASON_CODES.COST_UNKNOWN || reason === REASON_CODES.INSUFFICIENT_CONFIDENCE || reason === REASON_CODES.INSUFFICIENT_COMPLETENESS)) feasibilityStatus = policy.insufficientEvidencePolicy === 'FAIL_CLOSED' ? FEASIBILITY_STATUSES.INSUFFICIENT_EVIDENCE : FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE;
  return { candidateId: `${request.decisionRequestId}.${decisionStrategy}.${scoreRecord.candidateExecutorId}.${sha256(scoreRecord.scoreId).slice(0, 8)}`, strategyId: decisionStrategy, runtimeStrategyId: scoreRecord.candidateStrategyId, executorId: scoreRecord.candidateExecutorId, capabilityId: scoreRecord.capabilityId, executionProfileId: request.executionProfileId, eligibilityStatus: uniqueReasons.includes(REASON_CODES.CAPABILITY_NOT_SUPPORTED) ? 'UNSUPPORTED' : 'ELIGIBLE', authorizationStatus: uniqueReasons.some((reason) => reason.includes('AUTHORIZED')) ? 'UNAUTHORIZED' : 'AUTHORIZED', availabilityStatus: ['EXECUTOR_ERROR', 'TIMEOUT'].includes(scoreRecord.resultClass) ? 'UNAVAILABLE' : 'AVAILABLE', compatibilityStatus: 'COMPATIBLE', evidenceStatus: uniqueReasons.includes(REASON_CODES.COST_EVIDENCE_MISSING) ? 'INSUFFICIENT_EVIDENCE' : 'PRESENT', feasibilityStatus, reasonCodes: uniqueReasons, scoreEvidence: { scoreId: scoreRecord.scoreId, scoreRunId: scoreRecord.scoringRequestId, resultClass: scoreRecord.resultClass, compositeScore: composite, dimensionScores: dimensionScores.map((dimension) => ({ dimensionId: dimension.dimensionId, status: dimension.status, score: dimension.score, thresholdStatus: dimension.threshold?.status || null })) }, costEvidence: { costRecordIds: costRecords.map((record) => record.costRecordId).sort(), comparableCostMetric: comparableMetric, comparableCostMicroUsd: comparableCost, unknownCost: hasUnknownCost }, budgetEvidence: { statuses: [...new Set(costRecords.map((record) => record.budgetEvaluation.status))].sort(), simulationOnly: true }, confidence: { score: confidenceScore, status: confidenceScore === null ? 'UNKNOWN' : confidenceScore >= 80 ? 'HIGH_TEST_CONFIDENCE' : confidenceScore >= 50 ? 'MODERATE_TEST_CONFIDENCE' : 'LOW_TEST_CONFIDENCE' }, completeness: { score: completenessScore, status: completenessScore === null ? 'UNKNOWN' : completenessScore >= 95 ? 'COMPLETE' : completenessScore >= 60 ? 'PARTIAL' : 'INSUFFICIENT' }, criticalGateResults: gateResults, thresholdResults, riskClassification: request.riskTier, providerMetadata: hosted ? { providerClass: 'hosted_model_placeholder', providerIdentity: null } : null, premiumStatus: decisionStrategy === 'HOSTED_PREMIUM' ? (request.premiumExecutionAllowed ? 'SYNTHETIC_APPROVAL_PRESENT' : 'PREMIUM_RESTRICTED') : 'NOT_PREMIUM', humanReviewStatus: decisionStrategy === 'HUMAN_REVIEW' ? 'HUMAN_REVIEW_CANDIDATE' : request.requiredHumanReview ? 'REQUIRED_NOT_SATISFIED' : 'NOT_REQUIRED' };
}

function enumerateCandidates(request, policy) {
  const capability = registry.getRuntimeCapability(request.capabilityId);
  const executionProfile = PROFILE_DEFINITIONS[request.executionProfileId] || PROFILE_DEFINITIONS.BALANCED;
  const scoreRuns = (request.scoreRunIds || []).map(resolveScoringRun).filter(Boolean);
  const costRuns = (request.costGovernanceRunIds || []).map(resolveCostRun).filter(Boolean);
  const records = scoreRuns.flatMap((run) => run.scoreRecords).filter((record) => record.capabilityId === request.capabilityId);
  return records.map((record) => aggregateCandidate(record, relatedCostRecords(record, costRuns), policy, request, capability, executionProfile)).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

function selectCandidate(candidates, policy) {
  const feasible = candidates.filter((candidate) => [FEASIBILITY_STATUSES.FEASIBLE, FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE].includes(candidate.feasibilityStatus));
  const tieBreakTrace = [];
  if (!feasible.length) return { selected: null, tieBreakTrace };
  const comparable = feasible.filter((candidate) => typeof candidate.costEvidence.comparableCostMicroUsd === 'number');
  const pool = comparable.length ? comparable : feasible;
  pool.sort((a, b) => {
    const ac = a.costEvidence.comparableCostMicroUsd ?? Number.MAX_SAFE_INTEGER;
    const bc = b.costEvidence.comparableCostMicroUsd ?? Number.MAX_SAFE_INTEGER;
    if (ac !== bc) return ac - bc;
    const ar = strategyRank(a.strategyId, policy.defaultStrategyPreferenceOrder);
    const br = strategyRank(b.strategyId, policy.defaultStrategyPreferenceOrder);
    if (ar !== br) return ar - br;
    if ((b.confidence.score ?? -1) !== (a.confidence.score ?? -1)) return (b.confidence.score ?? -1) - (a.confidence.score ?? -1);
    if ((b.completeness.score ?? -1) !== (a.completeness.score ?? -1)) return (b.completeness.score ?? -1) - (a.completeness.score ?? -1);
    return a.candidateId.localeCompare(b.candidateId);
  });
  tieBreakTrace.push({ step: 1, rule: 'LOWEST_COMPARABLE_COST', candidateId: pool[0].candidateId, comparableCostMicroUsd: pool[0].costEvidence.comparableCostMicroUsd });
  tieBreakTrace.push({ step: 2, rule: 'LOWER_STRATEGY_TIER_THEN_CONFIDENCE_COMPLETENESS_LEXICAL', candidateId: pool[0].candidateId });
  return { selected: pool[0], tieBreakTrace };
}

function buildFallbackPlan(candidates, selected, request, policy) {
  if (!request.allowFallback) return [];
  return candidates.filter((candidate) => candidate.candidateId !== selected?.candidateId && [FEASIBILITY_STATUSES.FEASIBLE, FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE, FEASIBILITY_STATUSES.HUMAN_REVIEW_REQUIRED].includes(candidate.feasibilityStatus)).sort((a, b) => strategyRank(a.strategyId, policy.defaultStrategyPreferenceOrder) - strategyRank(b.strategyId, policy.defaultStrategyPreferenceOrder) || a.candidateId.localeCompare(b.candidateId)).slice(0, policy.fallbackPolicy?.maxFallbacks ?? 3).map((candidate, index) => ({ fallbackOrder: index + 1, candidateId: candidate.candidateId, strategyId: candidate.strategyId, triggeringConditions: ['PRIMARY_UNAVAILABLE', 'PRIMARY_INSUFFICIENT', 'POLICY_REQUIRES_ESCALATION'], eligibilityRequirements: ['same capability', 'same policy profile', 'validated evidence'], requiredApprovals: candidate.strategyId === 'HOSTED_PREMIUM' ? ['synthetic premium approval'] : [], budgetRequirement: 'simulation only; no runtime budget enforcement', maximumAttempts: policy.fallbackPolicy?.maximumAttempts ?? 1, timeoutBehavior: 'record timeout and move to next advisory fallback', safetyRequirements: 'all critical gates must remain satisfied', humanReviewRequirement: candidate.strategyId === 'HUMAN_REVIEW', terminalCondition: 'safe advisory result, human review, deferral, or abstention' }));
}

function calculateDecisionConfidence(candidates, selected) {
  const values = candidates.map((candidate) => candidate.confidence.score).filter((value) => typeof value === 'number');
  const score = values.length ? Math.max(0, Math.round((average(values) - 15) * 100) / 100) : null;
  return { score, status: score === null ? 'UNKNOWN' : score >= 75 ? 'HIGH_TEST_CONFIDENCE' : score >= 50 ? 'MODERATE_TEST_CONFIDENCE' : score >= 20 ? 'LOW_TEST_CONFIDENCE' : 'INSUFFICIENT', selectedCandidateConfidence: selected?.confidence.status || null, productionApplicable: false };
}

function calculateDecisionCompleteness(candidates) {
  const candidateCoverage = candidates.length ? 100 : 0;
  const evidenceCoverage = candidates.length ? Math.round((candidates.filter((candidate) => candidate.evidenceStatus === 'PRESENT').length / candidates.length) * 10000) / 100 : 0;
  const score = Math.round(((candidateCoverage + evidenceCoverage) / 2) * 100) / 100;
  return { score, status: score >= 95 ? 'COMPLETE' : score >= 50 ? 'PARTIAL' : 'INSUFFICIENT', candidateCount: candidates.length };
}

function runCounterfactuals(request, policy, candidates, selected) {
  return [
    { counterfactualId: `${request.decisionRequestId}.cost_unknown`, changedAssumption: 'allowUnknownCost', originalValue: request.allowUnknownCost, counterfactualValue: false, originalOutcome: selected ? 'SELECTED' : 'NO_SELECTION', counterfactualOutcome: candidates.some((candidate) => candidate.costEvidence.unknownCost) ? 'DEFER_OR_ABSTAIN' : 'UNCHANGED', selectedCandidateDelta: selected?.candidateId || null, feasibilityDelta: 'unknown-cost candidates would become insufficient evidence', fallbackDelta: 'fallback recomputed deterministically', confidenceDelta: 'lower', completenessDelta: 'lower' },
    { counterfactualId: `${request.decisionRequestId}.premium_approved`, changedAssumption: 'premiumExecutionAllowed', originalValue: request.premiumExecutionAllowed, counterfactualValue: true, originalOutcome: selected ? 'SELECTED' : 'NO_SELECTION', counterfactualOutcome: 'premium candidates may become advisory feasible if evidenced', selectedCandidateDelta: null, feasibilityDelta: 'premium restriction removed only with synthetic approval', fallbackDelta: 'premium may appear later in fallback', confidenceDelta: 'unchanged', completenessDelta: 'unchanged' }
  ];
}

function runSensitivityAnalysis(request, policy, candidates, selected) {
  return [
    { sensitivityId: `${request.decisionRequestId}.confidence_plus_10`, parameter: 'minimumConfidence', originalValue: request.minimumConfidence, testValue: Math.min(100, (request.minimumConfidence || 0) + 10), decisionOutcomeDelta: 'deterministic simulation only', selectedCandidateDelta: selected?.candidateId || null, fallbackPlanDelta: 'recomputed deterministically', feasibilityDelta: 'lower confidence candidates may be excluded', confidenceDelta: 'stricter', completenessDelta: 'unchanged' },
    { sensitivityId: `${request.decisionRequestId}.budget_halved`, parameter: 'maximumCostPerRequestMicroUsd', originalValue: request.maximumCostPerRequestMicroUsd, testValue: request.maximumCostPerRequestMicroUsd === null ? null : Math.floor(request.maximumCostPerRequestMicroUsd / 2), decisionOutcomeDelta: 'budget restriction may increase', selectedCandidateDelta: selected?.candidateId || null, fallbackPlanDelta: 'over-budget candidates excluded', feasibilityDelta: 'over budget candidates increase', confidenceDelta: 'unchanged', completenessDelta: 'unchanged' }
  ];
}

function calculateDecisionRecord(requestOrId) {
  const request = typeof requestOrId === 'string' ? getDecisionRequest(requestOrId) : requestOrId;
  if (!request) throw new Error(`Decision request not found: ${requestOrId}`);
  const policy = getDecisionPolicyProfile(request.decisionPolicyProfileId, request.decisionPolicyProfileVersion);
  const requestValidation = validateDecisionRequest(request);
  const policyValidation = policy ? validateDecisionPolicyProfile(policy) : { valid: false, errors: [validationError('decisionPolicyProfileId', 'UNKNOWN_DECISION_POLICY_PROFILE', 'Policy is missing.')] };
  if (!requestValidation.valid || !policyValidation.valid) return { schemaVersion: DECISION_RECORD_SCHEMA_VERSION, decisionRequestId: request.decisionRequestId, valid: false, validationErrors: [...requestValidation.errors, ...policyValidation.errors], testOnly: true, productionUseAllowed: false };
  const candidates = enumerateCandidates(request, policy);
  const { selected, tieBreakTrace } = selectCandidate(candidates, policy);
  const fallbackPlan = buildFallbackPlan(candidates, selected, request, policy);
  const rejected = candidates.filter((candidate) => ![FEASIBILITY_STATUSES.FEASIBLE, FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE].includes(candidate.feasibilityStatus));
  let decisionOutcome = selected ? (fallbackPlan.length ? DECISION_OUTCOMES.SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK : DECISION_OUTCOMES.SELECT_ADVISORY_CANDIDATE) : DECISION_OUTCOMES.DEFER_PENDING_EVIDENCE;
  let abstentionReason = null;
  if (!selected) {
    if (rejected.some((candidate) => candidate.reasonCodes.includes(REASON_CODES.PREMIUM_EXECUTION_NOT_AUTHORIZED))) { decisionOutcome = DECISION_OUTCOMES.ABSTAIN_PREMIUM_APPROVAL_REQUIRED; abstentionReason = REASON_CODES.PREMIUM_RESTRICTED; }
    else if (rejected.some((candidate) => candidate.reasonCodes.includes(REASON_CODES.SAFETY_GATE_FAILED))) { decisionOutcome = DECISION_OUTCOMES.ABSTAIN_NO_SAFE_CANDIDATE; abstentionReason = REASON_CODES.NO_FEASIBLE_CANDIDATE; }
    else if (rejected.some((candidate) => candidate.feasibilityStatus === FEASIBILITY_STATUSES.OVER_BUDGET)) { decisionOutcome = DECISION_OUTCOMES.ABSTAIN_BUDGET_RESTRICTED; abstentionReason = REASON_CODES.BUDGET_HARD_LIMIT; }
    else if (!candidates.length) { decisionOutcome = DECISION_OUTCOMES.NO_APPLICABLE_CANDIDATE; abstentionReason = REASON_CODES.NO_FEASIBLE_CANDIDATE; }
  }
  if (!selected && request.allowHumanReview && policy.humanReviewPolicy?.requiredWhenNoFeasibleCandidate) decisionOutcome = DECISION_OUTCOMES.HUMAN_REVIEW_REQUIRED;
  const evidenceHashes = { scoreRunHashes: request.scoreRunIds.map((id) => resolveScoringRun(id)?.scoreRunHash || null), costGovernanceRunHashes: request.costGovernanceRunIds.map((id) => resolveCostRun(id)?.costGovernanceRunHash || null) };
  const decisionConfidence = calculateDecisionConfidence(candidates, selected);
  const decisionCompleteness = calculateDecisionCompleteness(candidates, request);
  const record = { schemaVersion: DECISION_RECORD_SCHEMA_VERSION, decisionRecordId: `${request.decisionRequestId}.record.v1`, decisionRequestId: request.decisionRequestId, decisionPolicyProfileId: policy.decisionPolicyProfileId, decisionPolicyProfileVersion: policy.version, decisionEngineVersion: DECISION_ENGINE_VERSION, capabilityId: request.capabilityId, capabilityVersion: request.capabilityVersion, executionProfileId: request.executionProfileId, evaluationRunIds: request.evaluationRunIds || [], scoreRunIds: request.scoreRunIds || [], costGovernanceRunIds: request.costGovernanceRunIds || [], registryHash: sha256(registry.listEnterpriseCapabilities().map((capability) => ({ capabilityId: capability.capabilityId, version: capability.capabilityVersion, allowedExecutionStrategies: capability.allowedExecutionStrategies }))), evidenceHashes, repositoryCommit: '8ca2c5cab85a934fbde2cd60dc581937066b67d8', enumeratedCandidates: candidates, feasibleCandidates: candidates.filter((candidate) => candidate.feasibilityStatus === FEASIBILITY_STATUSES.FEASIBLE), conditionallyFeasibleCandidates: candidates.filter((candidate) => candidate.feasibilityStatus === FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE), rejectedCandidates: rejected, candidateEvidenceSummaries: candidates.map((candidate) => ({ candidateId: candidate.candidateId, scoreEvidence: candidate.scoreEvidence.scoreId, costEvidence: candidate.costEvidence.costRecordIds, reasons: candidate.reasonCodes })), decisionOutcome, advisorySelectedCandidateId: selected?.candidateId || null, selectionMethod: selected ? 'CHEAPEST_SUFFICIENT_AFTER_MANDATORY_GATES' : 'NO_FEASIBLE_SELECTION', selectionReasonCodes: selected ? [REASON_CODES.CHEAPEST_SUFFICIENT].concat(tieBreakTrace.length > 1 ? [REASON_CODES.DETERMINISTIC_TIE_BREAK] : []) : [REASON_CODES.NO_FEASIBLE_CANDIDATE], comparableCostMetric: policy.costPolicy.comparableCostMetric, selectedComparableCostMicroUsd: selected?.costEvidence.comparableCostMicroUsd ?? null, tieBreakTrace, fallbackPlan, abstentionReason, humanReviewRequirement: { required: decisionOutcome === DECISION_OUTCOMES.HUMAN_REVIEW_REQUIRED || request.requiredHumanReview === true, policy: policy.humanReviewPolicy }, criticalGateResults: candidates.flatMap((candidate) => candidate.criticalGateResults.map((gate) => ({ candidateId: candidate.candidateId, ...gate }))), thresholdResults: candidates.flatMap((candidate) => candidate.thresholdResults.map((threshold) => ({ candidateId: candidate.candidateId, ...threshold }))), policyResults: candidates.map((candidate) => ({ candidateId: candidate.candidateId, feasibilityStatus: candidate.feasibilityStatus, reasonCodes: candidate.reasonCodes })), authorizationResults: candidates.map((candidate) => ({ candidateId: candidate.candidateId, authorizationStatus: candidate.authorizationStatus })), budgetResults: candidates.map((candidate) => ({ candidateId: candidate.candidateId, budgetEvidence: candidate.budgetEvidence })), premiumResults: candidates.map((candidate) => ({ candidateId: candidate.candidateId, premiumStatus: candidate.premiumStatus })), decisionConfidence, decisionCompleteness, evidenceLimitations: ['synthetic mock evidence', 'repository-only advisory decision', 'no production runtime activation'], productionApplicability: 'NOT_PRODUCTION_APPLICABLE', candidateEnumerationTrace: { source: 'score records joined to cost records', candidateCount: candidates.length }, eligibilityTrace: candidates.map((candidate) => ({ candidateId: candidate.candidateId, eligibilityStatus: candidate.eligibilityStatus })), gateTrace: candidates.map((candidate) => ({ candidateId: candidate.candidateId, criticalGateResults: candidate.criticalGateResults })), thresholdTrace: candidates.map((candidate) => ({ candidateId: candidate.candidateId, thresholdResults: candidate.thresholdResults })), costTrace: candidates.map((candidate) => ({ candidateId: candidate.candidateId, costEvidence: candidate.costEvidence })), utilityTrace: candidates.map((candidate) => ({ candidateId: candidate.candidateId, utilityMethod: policy.utilityMethod, feasibleBeforeUtility: [FEASIBILITY_STATUSES.FEASIBLE, FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE].includes(candidate.feasibilityStatus), comparableCostMicroUsd: candidate.costEvidence.comparableCostMicroUsd })), fallbackTrace: fallbackPlan, counterfactualTrace: request.includeCounterfactuals ? runCounterfactuals(request, policy, candidates, selected) : [], sensitivityAnalysis: request.includeSensitivityAnalysis ? runSensitivityAnalysis(request, policy, candidates, selected) : [], requestHash: decisionRequestHash(request), policyProfileHash: policyProfileHash(policy), sourceEvidenceHash: sourceEvidenceHash(evidenceHashes), testOnly: true, advisoryOnly: true, productionUseAllowed: false };
  record.decisionRecordHash = decisionRecordHash(record);
  return record;
}

function validateDecisionRecord(record) {
  const errors = [];
  if (record.valid === false) errors.push(...(record.validationErrors || []));
  if (record.testOnly !== true || record.productionUseAllowed === true || record.productionActivation === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_ACTIVATION_PROHIBITED', 'Decision records must remain test-only advisory outputs.'));
  if (containsSecretLikeValue(record)) errors.push(validationError('record', 'SECRET_LIKE_DECISION_RECORD_CONTENT', 'Decision records must not contain credentials, tokens, or private URLs.'));
  const selected = record.enumeratedCandidates?.find((candidate) => candidate.candidateId === record.advisorySelectedCandidateId);
  if (record.advisorySelectedCandidateId && !selected) errors.push(validationError('advisorySelectedCandidateId', 'SELECTED_CANDIDATE_MISSING', 'Selected candidate must be enumerated.'));
  if (selected && ![FEASIBILITY_STATUSES.FEASIBLE, FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE].includes(selected.feasibilityStatus)) errors.push(validationError('advisorySelectedCandidateId', 'SELECTED_CANDIDATE_INFEASIBLE', 'Selected candidate must be feasible before utility.'));
  if (selected && selected.reasonCodes.some((reason) => [REASON_CODES.SAFETY_GATE_FAILED, REASON_CODES.POLICY_GATE_FAILED, REASON_CODES.PREMIUM_EXECUTION_NOT_AUTHORIZED, REASON_CODES.COST_CEILING_EXCEEDED].includes(reason))) errors.push(validationError('advisorySelectedCandidateId', 'SELECTED_CANDIDATE_FAILS_MANDATORY_REQUIREMENT', 'Mandatory failures must prevent selection.'));
  for (const item of record.fallbackPlan || []) {
    const candidate = record.enumeratedCandidates.find((entry) => entry.candidateId === item.candidateId);
    if (candidate && [FEASIBILITY_STATUSES.PROHIBITED, FEASIBILITY_STATUSES.UNAUTHORIZED, FEASIBILITY_STATUSES.INFEASIBLE].includes(candidate.feasibilityStatus)) errors.push(validationError('fallbackPlan', 'FALLBACK_INCLUDES_PROHIBITED_CANDIDATE', 'Fallback must exclude prohibited candidates.'));
  }
  if (stableStringify(record).includes('bestValue') || stableStringify(record).includes('winner') || stableStringify(record).includes('procurementRecommendation')) errors.push(validationError('record', 'PROHIBITED_RECOMMENDATION_OUTPUT', 'Decision records must not claim best value, winner, or procurement recommendation.'));
  if (record.decisionRecordHash !== decisionRecordHash({ ...record, decisionRecordHash: undefined })) errors.push(validationError('decisionRecordHash', 'DECISION_HASH_MISMATCH', 'Decision record hash must match content.'));
  return { valid: errors.length === 0, errors };
}

function runInitialDecisions() { return loadDecisionRequests().map((request) => calculateDecisionRecord(request)); }
function listDecisionRecords() { return runInitialDecisions(); }
function getDecisionRecord(id) { return listDecisionRecords().find((record) => record.decisionRecordId === id || record.decisionRequestId === id) || null; }
function listDecisionsByCapability(capabilityId) { return listDecisionRecords().filter((record) => record.capabilityId === capabilityId); }
function listDecisionsByPolicy(policyId) { return listDecisionRecords().filter((record) => record.decisionPolicyProfileId === policyId); }
function listDecisionsBySelectedStrategy(strategyId) { return listDecisionRecords().filter((record) => record.enumeratedCandidates.find((candidate) => candidate.candidateId === record.advisorySelectedCandidateId)?.strategyId === strategyId); }
function listAbstentions() { return listDecisionRecords().filter((record) => String(record.decisionOutcome).startsWith('ABSTAIN') || record.decisionOutcome === DECISION_OUTCOMES.NO_APPLICABLE_CANDIDATE); }
function listHumanReviewDecisions() { return listDecisionRecords().filter((record) => record.decisionOutcome === DECISION_OUTCOMES.HUMAN_REVIEW_REQUIRED || record.humanReviewRequirement?.required); }
function listInsufficientEvidenceDecisions() { return listDecisionRecords().filter((record) => record.rejectedCandidates.some((candidate) => candidate.feasibilityStatus === FEASIBILITY_STATUSES.INSUFFICIENT_EVIDENCE)); }
function listOverBudgetCandidates() { return listDecisionRecords().flatMap((record) => record.enumeratedCandidates.filter((candidate) => candidate.feasibilityStatus === FEASIBILITY_STATUSES.OVER_BUDGET).map((candidate) => ({ decisionRequestId: record.decisionRequestId, ...candidate }))); }
function listPremiumRestrictedCandidates() { return listDecisionRecords().flatMap((record) => record.enumeratedCandidates.filter((candidate) => candidate.reasonCodes.includes(REASON_CODES.PREMIUM_RESTRICTED)).map((candidate) => ({ decisionRequestId: record.decisionRequestId, ...candidate }))); }
function listCriticalGateRejections() { return listDecisionRecords().flatMap((record) => record.rejectedCandidates.filter((candidate) => candidate.criticalGateResults.some((gate) => gate.status === 'FAILED')).map((candidate) => ({ decisionRequestId: record.decisionRequestId, ...candidate }))); }
function listFallbackPlans() { return listDecisionRecords().map((record) => ({ decisionRequestId: record.decisionRequestId, fallbackPlan: record.fallbackPlan })); }
function compareDecisionRecords(left, right) { const a = typeof left === 'string' ? getDecisionRecord(left) : left; const b = typeof right === 'string' ? getDecisionRecord(right) : right; return { equal: a?.decisionRecordHash === b?.decisionRecordHash, leftHash: a?.decisionRecordHash || null, rightHash: b?.decisionRecordHash || null }; }
function comparePolicyProfiles(left, right) { const a = typeof left === 'string' ? getDecisionPolicyProfile(left) : left; const b = typeof right === 'string' ? getDecisionPolicyProfile(right) : right; return { equal: policyProfileHash(a) === policyProfileHash(b), leftHash: policyProfileHash(a), rightHash: policyProfileHash(b) }; }
function inspectCandidateTrace(candidateId) { return listDecisionRecords().flatMap((record) => record.enumeratedCandidates).find((candidate) => candidate.candidateId === candidateId) || null; }
function inspectRejectionTrace(candidateId) { return listDecisionRecords().flatMap((record) => record.rejectedCandidates).find((candidate) => candidate.candidateId === candidateId) || null; }
function inspectTieBreakTrace(decisionRequestId) { return getDecisionRecord(decisionRequestId)?.tieBreakTrace || null; }
function inspectFallbackTrace(decisionRequestId) { return getDecisionRecord(decisionRequestId)?.fallbackTrace || null; }
function verifyDeterministicReplay(decisionRequestId) { return compareDecisionRecords(calculateDecisionRecord(decisionRequestId), calculateDecisionRecord(decisionRequestId)); }

module.exports = { DECISION_ENGINE_VERSION, DECISION_REQUEST_SCHEMA_VERSION, DECISION_POLICY_PROFILE_SCHEMA_VERSION, DECISION_RECORD_SCHEMA_VERSION, DECISION_POLICY_LIFECYCLE_STATES, DECISION_STRATEGIES, STRATEGY_TO_RUNTIME, RUNTIME_TO_STRATEGY, FEASIBILITY_STATUSES, DECISION_OUTCOMES, REASON_CODES, DEFAULT_STRATEGY_ORDER, loadDecisionPolicyProfiles, getDecisionPolicyProfile, loadDecisionRequests, getDecisionRequest, validateDecisionPolicyProfile, validateDecisionRequest, enumerateCandidates, calculateDecisionRecord, validateDecisionRecord, runInitialDecisions, listDecisionRecords, getDecisionRecord, listDecisionsByCapability, listDecisionsByPolicy, listDecisionsBySelectedStrategy, listAbstentions, listHumanReviewDecisions, listInsufficientEvidenceDecisions, listOverBudgetCandidates, listPremiumRestrictedCandidates, listCriticalGateRejections, listFallbackPlans, compareDecisionRecords, comparePolicyProfiles, inspectCandidateTrace, inspectRejectionTrace, inspectTieBreakTrace, inspectFallbackTrace, verifyDecisionIntegrity: validateDecisionRecord, verifyDeterministicReplay, policyProfileHash, decisionRequestHash, decisionRecordHash, sourceEvidenceHash, stable, stableStringify, sha256, paths: { backendRoot, repoRoot, decisionRoot, policyRoot, requestRoot } };
