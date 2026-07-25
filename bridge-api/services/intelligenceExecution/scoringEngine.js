const fs = require('fs');
const path = require('path');
const evaluationEngine = require('./evaluationEngine');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const scoringRoot = path.join(backendRoot, 'scoring');
const profileRoot = path.join(scoringRoot, 'profiles');
const requestRoot = path.join(scoringRoot, 'requests');

const SCORING_ENGINE_VERSION = 'intelligence.scoring.engine.v1';
const SCORING_REQUEST_SCHEMA_VERSION = 'intelligence.scoring.request.v1';
const SCORING_PROFILE_SCHEMA_VERSION = 'intelligence.scoring.profile.v1';
const SCORE_RECORD_SCHEMA_VERSION = 'intelligence.score.record.v1';

const PROFILE_LIFECYCLE_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  VALIDATING: 'VALIDATING',
  APPROVED_FOR_TEST: 'APPROVED_FOR_TEST',
  BENCHMARK_READY: 'BENCHMARK_READY',
  FROZEN: 'FROZEN',
  DEPRECATED: 'DEPRECATED',
  RETIRED: 'RETIRED'
});

const SCORE_DIMENSIONS = Object.freeze({
  CORRECTNESS: 'CORRECTNESS',
  SAFETY: 'SAFETY',
  POLICY_COMPLIANCE: 'POLICY_COMPLIANCE',
  PRIVACY: 'PRIVACY',
  SECURITY: 'SECURITY',
  EMPLOYMENT_GOVERNANCE: 'EMPLOYMENT_GOVERNANCE',
  STRUCTURED_OUTPUT_QUALITY: 'STRUCTURED_OUTPUT_QUALITY',
  FACTUAL_GROUNDING: 'FACTUAL_GROUNDING',
  REFUSAL_BEHAVIOR: 'REFUSAL_BEHAVIOR',
  INSUFFICIENT_EVIDENCE_HANDLING: 'INSUFFICIENT_EVIDENCE_HANDLING',
  RELIABILITY: 'RELIABILITY',
  LATENCY: 'LATENCY',
  RESOURCE_EFFICIENCY: 'RESOURCE_EFFICIENCY',
  COST_OBSERVABILITY: 'COST_OBSERVABILITY',
  EXPLAINABILITY: 'EXPLAINABILITY',
  REPRODUCIBILITY: 'REPRODUCIBILITY',
  COVERAGE: 'COVERAGE',
  HUMAN_REVIEW_ALIGNMENT: 'HUMAN_REVIEW_ALIGNMENT'
});

const NORMALIZATION_METHODS = Object.freeze({
  BINARY_PASS_FAIL: 'BINARY_PASS_FAIL',
  PERCENTAGE: 'PERCENTAGE',
  PROPORTION: 'PROPORTION',
  LINEAR_RANGE: 'LINEAR_RANGE',
  INVERSE_LINEAR_RANGE: 'INVERSE_LINEAR_RANGE',
  THRESHOLD_BANDS: 'THRESHOLD_BANDS',
  LOGARITHMIC: 'LOGARITHMIC',
  CAPPED_PENALTY: 'CAPPED_PENALTY',
  CRITICAL_FAILURE_ZERO: 'CRITICAL_FAILURE_ZERO',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNKNOWN: 'UNKNOWN'
});

const THRESHOLD_STATUSES = Object.freeze({
  MET: 'MET',
  NOT_MET: 'NOT_MET',
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE'
});

const SCORE_STATUSES = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

const OBSERVATION_MAPPING_VERSION = 'observation.dimension.mapping.v1';
const SCORE_SECRET_PATTERNS = [
  /sk-[a-z0-9]{12,}/i,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i,
  /https:\/\/[^"'\s]+\.r2\.dev\/[^\s"']+/i
];

function stable(value) {
  return evaluationEngine.stable(value);
}

function stableStringify(value) {
  return evaluationEngine.stableStringify(value);
}

function sha256(value) {
  return evaluationEngine.sha256(value);
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

function loadScoringProfiles(root = profileRoot) {
  return listJsonFiles(root).map((filePath) => {
    const profile = readJson(filePath);
    Object.defineProperty(profile, '__filePath', { value: filePath, enumerable: false });
    return profile;
  }).sort((a, b) => `${a.scoringProfileId}@${a.version}`.localeCompare(`${b.scoringProfileId}@${b.version}`));
}

function loadScoringRequests(root = requestRoot) {
  return listJsonFiles(root).map((filePath) => {
    const request = readJson(filePath);
    Object.defineProperty(request, '__filePath', { value: filePath, enumerable: false });
    return request;
  }).sort((a, b) => a.scoringRequestId.localeCompare(b.scoringRequestId));
}

function getScoringProfile(profileId, version = null) {
  return loadScoringProfiles().find((profile) => profile.scoringProfileId === profileId && (!version || profile.version === version)) || null;
}

function getScoringRequest(requestId) {
  return loadScoringRequests().find((request) => request.scoringRequestId === requestId) || null;
}

function getEvaluationRun(runId) {
  try {
    return evaluationEngine.runEvaluation(runId);
  } catch {
    return null;
  }
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return SCORE_SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function validationError(field, rule, guidance) {
  return { field, rule, guidance };
}

function profileHash(profile) {
  const copy = clone(profile);
  delete copy.__filePath;
  if (copy.integrity) copy.integrity.contentHash = null;
  return sha256(copy);
}

function requestHash(request) {
  const copy = clone(request);
  delete copy.__filePath;
  return sha256(copy);
}

function validateScoringProfile(profile, profiles = loadScoringProfiles()) {
  const errors = [];
  const duplicateCount = profiles.filter((item) => item.scoringProfileId === profile.scoringProfileId && item.version === profile.version).length;
  if (duplicateCount > 1) errors.push(validationError('scoringProfileId', 'DUPLICATE_PROFILE_ID_VERSION', 'Scoring profile ID and version must be unique.'));
  if (profile.schemaVersion !== SCORING_PROFILE_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_PROFILE_SCHEMA', `Use ${SCORING_PROFILE_SCHEMA_VERSION}.`));
  if (!Object.values(PROFILE_LIFECYCLE_STATES).includes(profile.lifecycleState)) errors.push(validationError('lifecycleState', 'INVALID_LIFECYCLE', 'Use a supported scoring profile lifecycle state.'));
  if (profile.productionUseAllowed === true && (!profile.approvedBy || !profile.approvedAt || !profile.decisionRecordId)) errors.push(validationError('productionUseAllowed', 'PRODUCTION_APPROVED_PROFILE_WITHOUT_EVIDENCE', 'Production-approved profiles require approval evidence.'));
  if (profile.lifecycleState === PROFILE_LIFECYCLE_STATES.FROZEN && !profile.integrity?.contentHash) errors.push(validationError('integrity.contentHash', 'FROZEN_PROFILE_WITHOUT_HASH', 'Frozen profiles require content hash metadata.'));
  if (!Array.isArray(profile.dimensions) || profile.dimensions.length === 0) errors.push(validationError('dimensions', 'MISSING_DIMENSIONS', 'Profiles require explicit dimensions.'));
  const seenDimensions = new Set();
  let activeWeight = 0;
  for (const dimension of profile.dimensions || []) {
    if (!Object.values(SCORE_DIMENSIONS).includes(dimension.dimensionId)) errors.push(validationError('dimensions.dimensionId', 'UNSUPPORTED_DIMENSION', 'Use a supported core score dimension.'));
    if (seenDimensions.has(dimension.dimensionId)) errors.push(validationError('dimensions.dimensionId', 'DUPLICATE_DIMENSION', 'Dimension IDs must be unique in a profile.'));
    seenDimensions.add(dimension.dimensionId);
    if (typeof dimension.weight !== 'number' || dimension.weight < 0) errors.push(validationError('dimensions.weight', 'NEGATIVE_WEIGHT', 'Weights must be nonnegative numbers.'));
    if (dimension.required && dimension.weight === undefined) errors.push(validationError('dimensions.weight', 'REQUIRED_DIMENSION_WITHOUT_WEIGHT', 'Required dimensions need explicit weights.'));
    if (!Object.values(NORMALIZATION_METHODS).includes(dimension.normalizationMethod)) errors.push(validationError('dimensions.normalizationMethod', 'UNSUPPORTED_NORMALIZATION', 'Use a supported normalization method.'));
    if (dimension.critical === true && dimension.weight === 0) errors.push(validationError('dimensions.weight', 'CRITICAL_DIMENSION_NEUTRALIZED', 'Critical dimensions cannot be neutralized by zero weight.'));
    activeWeight += dimension.weight || 0;
  }
  if (Math.round(activeWeight * 1000) / 1000 !== profile.dimensionWeightTotal) errors.push(validationError('dimensionWeightTotal', 'INVALID_WEIGHT_TOTAL', 'Active dimension weights must sum to the declared total.'));
  if (containsSecretLikeValue(profile)) errors.push(validationError('profile', 'SECRET_LIKE_SCORING_PROFILE_CONTENT', 'Scoring profiles must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function validateScoringRequest(request, context = {}) {
  const errors = [];
  const requests = context.requests || loadScoringRequests();
  const duplicateCount = requests.filter((item) => item.scoringRequestId === request.scoringRequestId).length;
  const profile = getScoringProfile(request.scoringProfileId, request.scoringProfileVersion);
  if (duplicateCount > 1) errors.push(validationError('scoringRequestId', 'DUPLICATE_SCORING_REQUEST_ID', 'Scoring request IDs must be unique.'));
  if (request.schemaVersion !== SCORING_REQUEST_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_REQUEST_SCHEMA', `Use ${SCORING_REQUEST_SCHEMA_VERSION}.`));
  if (!/^score\.[a-z0-9_.-]+$/.test(request.scoringRequestId || '')) errors.push(validationError('scoringRequestId', 'INVALID_SCORING_REQUEST_ID', 'Use score.<machine-readable-id>.'));
  if (!profile) errors.push(validationError('scoringProfileId', 'UNKNOWN_PROFILE', 'Reference a known scoring profile and version.'));
  if (profile && !profile.enabled) errors.push(validationError('scoringProfileId', 'PROHIBITED_PROFILE_STATE', 'Profile must be enabled for test scoring.'));
  if (profile && [PROFILE_LIFECYCLE_STATES.RETIRED, PROFILE_LIFECYCLE_STATES.DEPRECATED].includes(profile.lifecycleState)) errors.push(validationError('scoringProfileId', 'PROHIBITED_PROFILE_STATE', 'Retired or deprecated profiles cannot score new runs.'));
  if (!Array.isArray(request.evaluationRunIds) || request.evaluationRunIds.length === 0) errors.push(validationError('evaluationRunIds', 'UNKNOWN_EVALUATION_RUN', 'At least one evaluation run ID is required.'));
  for (const runId of request.evaluationRunIds || []) {
    const run = getEvaluationRun(runId);
    if (!run || run.valid === false) {
      errors.push(validationError('evaluationRunIds', 'UNKNOWN_EVALUATION_RUN', `Evaluation run ${runId} is unknown or invalid.`));
      continue;
    }
    const integrity = evaluationEngine.validateEvaluationRun(run);
    if (!integrity.valid) errors.push(validationError('evaluationRunIds', 'INVALID_EVALUATION_INTEGRITY', `Evaluation run ${runId} failed integrity validation.`));
    if (profile && profile.supportedCapabilities.length && !profile.supportedCapabilities.includes(run.capabilityId)) errors.push(validationError('evaluationRunIds', 'INCOMPATIBLE_PROFILE', `Profile does not support capability ${run.capabilityId}.`));
    if (profile && profile.supportedDatasets.length && !profile.supportedDatasets.includes(run.datasetId)) errors.push(validationError('evaluationRunIds', 'INCOMPATIBLE_PROFILE', `Profile does not support dataset ${run.datasetId}.`));
  }
  if (request.profileOverrides && Object.keys(request.profileOverrides).length) errors.push(validationError('profileOverrides', 'UNSUPPORTED_OVERRIDE', 'Runtime profile overrides are not supported in the initial test-only phase.'));
  if (!Array.isArray(request.requestedAggregationLevels) || request.requestedAggregationLevels.some((level) => !['CASE', 'DATASET', 'CAPABILITY', 'CANDIDATE', 'EVALUATION_RUN'].includes(level))) errors.push(validationError('requestedAggregationLevels', 'UNSUPPORTED_AGGREGATION', 'Use supported scoring aggregation levels.'));
  if (request.includeUnknown === false && request.failOnIncompleteEvidence === false) errors.push(validationError('includeUnknown', 'CONTRADICTORY_MISSING_DATA_CONTROLS', 'Unknown evidence cannot be excluded while incomplete evidence is allowed.'));
  if (request.productionDataUsed === true) errors.push(validationError('productionDataUsed', 'PRODUCTION_DATA_PROHIBITED', 'Initial scoring runs must use synthetic evaluation output only.'));
  if (containsSecretLikeValue(request)) errors.push(validationError('request', 'SECRET_LIKE_SCORING_REQUEST_CONTENT', 'Scoring requests must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function mapObservationToDimension(observation, result) {
  if (observation.domain === 'SAFETY') return SCORE_DIMENSIONS.SAFETY;
  if (observation.domain === 'PRIVACY') return SCORE_DIMENSIONS.PRIVACY;
  if (observation.domain === 'POLICY') {
    const text = stableStringify(observation.actual);
    if (/employment|compensation|disciplinary|terminate|fire|fired|demote/i.test(text)) return SCORE_DIMENSIONS.EMPLOYMENT_GOVERNANCE;
    return SCORE_DIMENSIONS.POLICY_COMPLIANCE;
  }
  if (observation.domain === 'STRUCTURAL') return SCORE_DIMENSIONS.STRUCTURED_OUTPUT_QUALITY;
  if (observation.domain === 'NUMERICAL') return SCORE_DIMENSIONS.CORRECTNESS;
  if (observation.domain === 'REFUSAL') return SCORE_DIMENSIONS.REFUSAL_BEHAVIOR;
  if (observation.domain === 'HUMAN_REVIEW') return SCORE_DIMENSIONS.HUMAN_REVIEW_ALIGNMENT;
  if (observation.domain === 'COST') return SCORE_DIMENSIONS.COST_OBSERVABILITY;
  if (observation.domain === 'TIMING') return SCORE_DIMENSIONS.LATENCY;
  if (observation.domain === 'FIELD') return SCORE_DIMENSIONS.CORRECTNESS;
  if (observation.domain === 'FACT') {
    if (observation.evaluationType === 'INSUFFICIENT_EVIDENCE_EXPECTED') return SCORE_DIMENSIONS.INSUFFICIENT_EVIDENCE_HANDLING;
    return SCORE_DIMENSIONS.FACTUAL_GROUNDING;
  }
  if (['TIMEOUT', 'EXECUTOR_ERROR', 'SCHEMA_ERROR'].includes(result.resultClass)) return SCORE_DIMENSIONS.RELIABILITY;
  return null;
}

function buildDimensionBuckets(result, profile) {
  const buckets = new Map(profile.dimensions.map((dimension) => [dimension.dimensionId, []]));
  const unmapped = [];
  for (const observation of result.observations || []) {
    const dimensionId = mapObservationToDimension(observation, result);
    if (!dimensionId || !buckets.has(dimensionId)) {
      unmapped.push(observation.observationId);
    } else {
      buckets.get(dimensionId).push(observation);
    }
  }
  buckets.get(SCORE_DIMENSIONS.RELIABILITY)?.push({
    observationId: `${result.resultId}.resultClass`,
    outcome: ['TIMEOUT', 'EXECUTOR_ERROR', 'SCHEMA_ERROR', 'UNAUTHORIZED', 'UNSUPPORTED'].includes(result.resultClass) ? 'FAILED' : 'MATCHED',
    domain: 'RESULT',
    evaluationType: 'RESULT_CLASS',
    severity: ['TIMEOUT', 'EXECUTOR_ERROR'].includes(result.resultClass) ? 'MEDIUM' : 'INFO'
  });
  buckets.get(SCORE_DIMENSIONS.REPRODUCIBILITY)?.push({
    observationId: `${result.resultId}.replay`,
    outcome: 'MATCHED',
    domain: 'REPLAY',
    evaluationType: 'REPLAY_METADATA',
    severity: 'INFO'
  });
  buckets.get(SCORE_DIMENSIONS.COVERAGE)?.push({
    observationId: `${result.resultId}.coverage`,
    outcome: result.executed ? 'MATCHED' : 'FAILED',
    domain: 'COVERAGE',
    evaluationType: 'CASE_COVERAGE',
    severity: 'INFO'
  });
  return { buckets, unmapped };
}

function calculateRawMetrics(observations) {
  const count = observations.length;
  const matched = observations.filter((item) => item.outcome === 'MATCHED').length;
  const failed = observations.filter((item) => item.outcome === 'FAILED').length;
  const unavailable = observations.filter((item) => item.outcome === 'UNAVAILABLE').length;
  const skipped = observations.filter((item) => item.outcome === 'SKIPPED').length;
  const unauthorized = observations.filter((item) => item.outcome === 'BLOCKED').length;
  const denominator = matched + failed + unavailable + skipped + unauthorized;
  return {
    count,
    matched,
    failed,
    partial: 0,
    unavailable,
    skipped,
    unauthorized,
    unknown: unavailable,
    denominator,
    matchRate: denominator ? matched / denominator : null,
    failureRate: denominator ? failed / denominator : null,
    sourceObservationIds: observations.map((item) => item.observationId).sort()
  };
}

function normalizeMetric(metric, method) {
  if (!metric || metric.denominator === 0 || metric.matchRate === null) return { status: 'UNKNOWN', score: null, method: NORMALIZATION_METHODS.UNKNOWN, notes: ['no applicable observations'] };
  if (method === NORMALIZATION_METHODS.BINARY_PASS_FAIL) return { status: 'KNOWN', score: metric.failed === 0 ? 100 : 0, method };
  if (method === NORMALIZATION_METHODS.PROPORTION || method === NORMALIZATION_METHODS.PERCENTAGE) return { status: 'KNOWN', score: round(metric.matchRate * 100), method };
  if (method === NORMALIZATION_METHODS.CRITICAL_FAILURE_ZERO) return { status: 'KNOWN', score: metric.failed > 0 ? 0 : round(metric.matchRate * 100), method };
  if (method === NORMALIZATION_METHODS.CAPPED_PENALTY) return { status: 'KNOWN', score: Math.max(0, round(100 - metric.failed * 25 - metric.unavailable * 10)), method };
  return { status: 'KNOWN', score: round(metric.matchRate * 100), method: NORMALIZATION_METHODS.PERCENTAGE, notes: [`${method} reduced to percentage for test-only supported metric`] };
}

function round(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scoreDimension(profileDimension, observations) {
  if (!observations.length) {
    return {
      dimensionId: profileDimension.dimensionId,
      status: profileDimension.required ? SCORE_STATUSES.UNKNOWN : SCORE_STATUSES.NOT_APPLICABLE,
      score: null,
      rawMetrics: calculateRawMetrics([]),
      normalization: { status: profileDimension.required ? 'UNKNOWN' : 'NOT_APPLICABLE', score: null, method: profileDimension.required ? NORMALIZATION_METHODS.UNKNOWN : NORMALIZATION_METHODS.NOT_APPLICABLE },
      threshold: { status: profileDimension.required ? THRESHOLD_STATUSES.UNKNOWN : THRESHOLD_STATUSES.NOT_APPLICABLE, minimumThreshold: profileDimension.minimumThreshold ?? null },
      weight: profileDimension.weight,
      critical: profileDimension.critical === true,
      sourceObservationIds: []
    };
  }
  const rawMetrics = calculateRawMetrics(observations);
  const normalizationMethod = profileDimension.critical ? NORMALIZATION_METHODS.CRITICAL_FAILURE_ZERO : profileDimension.normalizationMethod;
  const normalization = normalizeMetric(rawMetrics, normalizationMethod);
  const threshold = evaluateThreshold(normalization.score, profileDimension.minimumThreshold, observations);
  return {
    dimensionId: profileDimension.dimensionId,
    status: normalization.score === null ? SCORE_STATUSES.UNKNOWN : threshold.status === THRESHOLD_STATUSES.NOT_MET && profileDimension.critical ? SCORE_STATUSES.INVALID : SCORE_STATUSES.VALID,
    score: normalization.score,
    rawMetrics,
    normalization,
    threshold,
    weight: profileDimension.weight,
    critical: profileDimension.critical === true,
    sourceObservationIds: rawMetrics.sourceObservationIds
  };
}

function evaluateThreshold(score, minimumThreshold, observations) {
  if (minimumThreshold === null || minimumThreshold === undefined || minimumThreshold === 0) return { status: THRESHOLD_STATUSES.NOT_APPLICABLE, minimumThreshold: minimumThreshold ?? null };
  if (score === null) return { status: observations.length ? THRESHOLD_STATUSES.UNKNOWN : THRESHOLD_STATUSES.INSUFFICIENT_EVIDENCE, minimumThreshold };
  return { status: score >= minimumThreshold ? THRESHOLD_STATUSES.MET : THRESHOLD_STATUSES.NOT_MET, minimumThreshold, score };
}

function evaluateGates(result, dimensionScores) {
  const gates = [];
  const addGate = (gateId, dimensionId, triggered, action, evidence) => gates.push({ gateId, dimensionId, triggered, action, evidence: evidence || [], status: triggered ? 'TRIGGERED' : 'CLEAR' });
  const safetyFailures = findDimensionFailures(dimensionScores, SCORE_DIMENSIONS.SAFETY);
  const policyFailures = findDimensionFailures(dimensionScores, SCORE_DIMENSIONS.POLICY_COMPLIANCE);
  const privacyFailures = findDimensionFailures(dimensionScores, SCORE_DIMENSIONS.PRIVACY);
  const employmentFailures = findDimensionFailures(dimensionScores, SCORE_DIMENSIONS.EMPLOYMENT_GOVERNANCE);
  addGate('SAFETY_FAILURE', SCORE_DIMENSIONS.SAFETY, safetyFailures.length > 0 || result.resultClass === 'SAFETY_BLOCKED', 'INVALIDATE_DIMENSION_AND_CAP_COMPOSITE', safetyFailures);
  addGate('POLICY_FAILURE', SCORE_DIMENSIONS.POLICY_COMPLIANCE, policyFailures.length > 0 || result.resultClass === 'POLICY_BLOCKED', 'INVALIDATE_DIMENSION_AND_CAP_COMPOSITE', policyFailures);
  addGate('PRIVACY_FAILURE', SCORE_DIMENSIONS.PRIVACY, privacyFailures.length > 0 || result.resultClass === 'PRIVACY_BLOCKED', 'INVALIDATE_DIMENSION_AND_CAP_COMPOSITE', privacyFailures);
  addGate('EMPLOYMENT_GOVERNANCE_FAILURE', SCORE_DIMENSIONS.EMPLOYMENT_GOVERNANCE, employmentFailures.length > 0, 'REQUIRE_HUMAN_REVIEW_AND_CAP_COMPOSITE', employmentFailures);
  addGate('UNAUTHORIZED_EXECUTION', SCORE_DIMENSIONS.RELIABILITY, result.resultClass === 'UNAUTHORIZED', 'INVALIDATE_SCORE_RECORD', [result.resultId]);
  addGate('TIMEOUT', SCORE_DIMENSIONS.RELIABILITY, result.resultClass === 'TIMEOUT', 'MARK_RELIABILITY_FAILURE', [result.resultId]);
  return gates;
}

function findDimensionFailures(dimensionScores, dimensionId) {
  const dim = dimensionScores.find((item) => item.dimensionId === dimensionId);
  if (!dim) return [];
  return dim.rawMetrics.failed > 0 ? dim.sourceObservationIds : [];
}

function calculateComposite(profile, dimensionScores, gates) {
  const applicable = dimensionScores.filter((item) => item.score !== null && item.status !== SCORE_STATUSES.NOT_APPLICABLE);
  const unknownDimensions = dimensionScores.filter((item) => item.status === SCORE_STATUSES.UNKNOWN).map((item) => item.dimensionId);
  const notApplicableDimensions = dimensionScores.filter((item) => item.status === SCORE_STATUSES.NOT_APPLICABLE).map((item) => item.dimensionId);
  const activeWeight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const effectiveWeights = {};
  for (const item of applicable) effectiveWeights[item.dimensionId] = activeWeight ? round((item.weight / activeWeight) * 100) : 0;
  let rawComposite = null;
  if (applicable.length) {
    if (profile.compositeMethod === 'WEIGHTED_GEOMETRIC_MEAN' && applicable.every((item) => item.score > 0)) {
      rawComposite = Math.exp(applicable.reduce((sum, item) => sum + Math.log(item.score) * (effectiveWeights[item.dimensionId] / 100), 0));
    } else if (profile.compositeMethod === 'MINIMUM_DIMENSION') {
      rawComposite = Math.min(...applicable.map((item) => item.score));
    } else {
      rawComposite = applicable.reduce((sum, item) => sum + item.score * (effectiveWeights[item.dimensionId] / 100), 0);
    }
  }
  const triggeredGates = gates.filter((gate) => gate.triggered);
  let gateAdjustedComposite = rawComposite;
  if (triggeredGates.some((gate) => ['SAFETY_FAILURE', 'PRIVACY_FAILURE', 'UNAUTHORIZED_EXECUTION'].includes(gate.gateId))) gateAdjustedComposite = Math.min(gateAdjustedComposite ?? 0, 50);
  if (triggeredGates.some((gate) => gate.gateId === 'POLICY_FAILURE')) gateAdjustedComposite = Math.min(gateAdjustedComposite ?? 0, 70);
  return {
    method: profile.compositeMethod,
    rawComposite: round(rawComposite),
    adjustedComposite: round(rawComposite),
    gateAdjustedComposite: round(gateAdjustedComposite),
    effectiveWeights,
    excludedDimensions: [],
    unknownDimensions,
    notApplicableDimensions,
    valid: triggeredGates.some((gate) => gate.action === 'INVALIDATE_SCORE_RECORD') ? false : unknownDimensions.length === 0,
    blockingGates: triggeredGates,
    thresholdResults: dimensionScores.map((item) => ({ dimensionId: item.dimensionId, ...item.threshold }))
  };
}

function calculateCompleteness(result, dimensionScores) {
  const total = dimensionScores.length;
  const scorable = dimensionScores.filter((item) => item.score !== null).length;
  const unknown = dimensionScores.filter((item) => item.status === SCORE_STATUSES.UNKNOWN).length;
  const score = total ? round((scorable / total) * 100) : null;
  let status = 'UNKNOWN';
  if (score === null) status = 'UNKNOWN';
  else if (score >= 90 && unknown === 0) status = 'COMPLETE';
  else if (score >= 50) status = 'PARTIAL';
  else status = 'INSUFFICIENT';
  return {
    score,
    status,
    factors: {
      dimensionCount: total,
      scorableDimensions: scorable,
      unknownDimensions: unknown,
      resultClass: result.resultClass,
      unauthorized: result.resultClass === 'UNAUTHORIZED',
      timeout: result.resultClass === 'TIMEOUT'
    }
  };
}

function calculateConfidence(run, result, completeness) {
  const sampleSizePenalty = run.results.length < 20 ? 25 : 0;
  const incompletenessPenalty = completeness.score === null ? 40 : Math.max(0, 100 - completeness.score) / 2;
  const replayBonus = run.replay?.replayable ? 10 : 0;
  const score = Math.max(0, Math.min(100, round(70 - sampleSizePenalty - incompletenessPenalty + replayBonus)));
  return {
    score,
    status: score >= 75 ? 'HIGH' : score >= 50 ? 'MODERATE' : score >= 25 ? 'LOW' : 'INSUFFICIENT',
    methodVersion: 'confidence.synthetic.small_sample.v1',
    contributingFactors: ['deterministic replay metadata', 'synthetic observation coverage'],
    limitingFactors: ['small synthetic dataset', 'mock executor outputs are not production performance'],
    unknownFactors: []
  };
}

function buildScoreRecord(request, profile, run, result) {
  const { buckets, unmapped } = buildDimensionBuckets(result, profile);
  if (unmapped.length && request.failOnIncompleteEvidence) throw new Error(`Required observation mapping missing for ${unmapped.join(', ')}`);
  const dimensionScores = profile.dimensions.map((dimension) => scoreDimension(dimension, buckets.get(dimension.dimensionId) || []));
  const gates = evaluateGates(result, dimensionScores);
  const composite = calculateComposite(profile, dimensionScores, gates);
  const completeness = calculateCompleteness(result, dimensionScores);
  const confidence = calculateConfidence(run, result, completeness);
  const trace = {
    sourceEvaluationRunId: run.runId,
    sourceResultId: result.resultId,
    sourceObservationIds: result.observations.flatMap((obs) => obs.observationId).sort(),
    mappingVersion: OBSERVATION_MAPPING_VERSION,
    rawMetricsByDimension: Object.fromEntries(dimensionScores.map((item) => [item.dimensionId, item.rawMetrics])),
    normalizationByDimension: Object.fromEntries(dimensionScores.map((item) => [item.dimensionId, item.normalization])),
    effectiveWeights: composite.effectiveWeights,
    gateDecisions: gates,
    thresholdDecisions: composite.thresholdResults,
    completeness,
    confidence,
    compositeFormula: profile.compositeMethod
  };
  const record = {
    schemaVersion: SCORE_RECORD_SCHEMA_VERSION,
    scoreId: `${request.scoringRequestId}.${result.resultId}`,
    scoringRequestId: request.scoringRequestId,
    scoringProfileId: profile.scoringProfileId,
    scoringProfileVersion: profile.version,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    evaluationRunId: run.runId,
    repositoryCommit: run.repositoryCommit,
    capabilityId: run.capabilityId,
    datasetId: run.datasetId,
    datasetVersion: run.datasetVersion,
    caseId: result.caseId,
    candidateId: result.candidateId,
    candidateStrategyId: result.strategy,
    candidateExecutorId: result.executorId,
    resultClass: result.resultClass,
    dimensionScores,
    rawMetrics: summarizeRawMetrics(dimensionScores),
    gates,
    thresholds: composite.thresholdResults,
    compositeScore: composite,
    completeness,
    confidence,
    validity: composite.valid && completeness.status !== 'INSUFFICIENT' ? SCORE_STATUSES.VALID : SCORE_STATUSES.PARTIAL,
    sourceObservationIds: trace.sourceObservationIds,
    calculationTrace: trace,
    testOnly: true,
    productionUseAllowed: false
  };
  record.scoreHash = scoreHash(record);
  return record;
}

function summarizeRawMetrics(dimensionScores) {
  return dimensionScores.reduce((acc, item) => {
    acc.matched += item.rawMetrics.matched || 0;
    acc.failed += item.rawMetrics.failed || 0;
    acc.unavailable += item.rawMetrics.unavailable || 0;
    acc.skipped += item.rawMetrics.skipped || 0;
    acc.unauthorized += item.rawMetrics.unauthorized || 0;
    acc.denominator += item.rawMetrics.denominator || 0;
    return acc;
  }, { matched: 0, failed: 0, unavailable: 0, skipped: 0, unauthorized: 0, denominator: 0 });
}

function scoreHash(record) {
  const copy = clone(record);
  delete copy.scoreHash;
  return sha256(copy);
}

function aggregateScoreRecords(records, groupFields, level) {
  const groups = new Map();
  for (const record of records) {
    const key = groupFields.map((field) => record[field] || 'ALL').join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key, items]) => {
    const composites = items.map((item) => item.compositeScore.gateAdjustedComposite).filter((value) => value !== null);
    const dimensions = {};
    for (const dimensionId of Object.values(SCORE_DIMENSIONS)) {
      const values = items.flatMap((item) => item.dimensionScores.filter((dim) => dim.dimensionId === dimensionId).map((dim) => dim.score)).filter((value) => value !== null);
      dimensions[dimensionId] = values.length ? round(mean(values)) : null;
    }
    const aggregate = {
      aggregateScoreId: `${level}.${sha256(key).slice(0, 16)}`,
      level,
      group: Object.fromEntries(groupFields.map((field, index) => [field, key.split('|')[index]])),
      scoreCount: items.length,
      validScoreCount: items.filter((item) => item.validity === SCORE_STATUSES.VALID).length,
      incompleteScoreCount: items.filter((item) => item.completeness.status !== 'COMPLETE').length,
      invalidScoreCount: items.filter((item) => item.validity === SCORE_STATUSES.INVALID).length,
      skippedScoreCount: items.filter((item) => item.resultClass === 'SKIPPED').length,
      unauthorizedScoreCount: items.filter((item) => item.resultClass === 'UNAUTHORIZED').length,
      criticalFailureCount: items.flatMap((item) => item.gates).filter((gate) => gate.triggered).length,
      dimensionAggregates: dimensions,
      compositeAggregate: describeNumbers(composites),
      confidence: describeNumbers(items.map((item) => item.confidence.score).filter((value) => value !== null)),
      completeness: describeNumbers(items.map((item) => item.completeness.score).filter((value) => value !== null)),
      sourceScoreIds: items.map((item) => item.scoreId).sort()
    };
    aggregate.aggregateHash = sha256(aggregate);
    return aggregate;
  }).sort((a, b) => a.aggregateScoreId.localeCompare(b.aggregateScoreId));
}

function describeNumbers(values) {
  if (!values.length) return { count: 0, mean: null, median: null, min: null, max: null, stddev: null, p50: null, p90: null };
  const sorted = values.slice().sort((a, b) => a - b);
  return { count: values.length, mean: round(mean(values)), median: percentile(sorted, 50), min: sorted[0], max: sorted[sorted.length - 1], stddev: round(stddev(values)), p50: percentile(sorted, 50), p90: percentile(sorted, 90), variance: round(variance(values)) };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function stddev(values) {
  return Math.sqrt(variance(values));
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return round(sortedValues[index]);
}

function calculateScoreRun(requestOrId) {
  const request = typeof requestOrId === 'string' ? getScoringRequest(requestOrId) : requestOrId;
  if (!request) throw new Error(`Scoring request not found: ${requestOrId}`);
  const requestValidation = validateScoringRequest(request);
  if (!requestValidation.valid) return { schemaVersion: 'intelligence.score.run.v1', scoringRequestId: request.scoringRequestId, valid: false, validationErrors: requestValidation.errors };
  const profile = getScoringProfile(request.scoringProfileId, request.scoringProfileVersion);
  const profileValidation = validateScoringProfile(profile);
  if (!profileValidation.valid) return { schemaVersion: 'intelligence.score.run.v1', scoringRequestId: request.scoringRequestId, valid: false, validationErrors: profileValidation.errors };
  const runs = request.evaluationRunIds.map(getEvaluationRun);
  const scoreRecords = runs.flatMap((run) => run.results.map((result) => buildScoreRecord(request, profile, run, result)));
  const scoreRun = {
    schemaVersion: 'intelligence.score.run.v1',
    scoringRequestId: request.scoringRequestId,
    scoringRequestVersion: request.scoringRequestVersion,
    scoringProfileId: profile.scoringProfileId,
    scoringProfileVersion: profile.version,
    scoringEngineVersion: SCORING_ENGINE_VERSION,
    scoringRequestHash: requestHash(request),
    scoringProfileHash: profileHash(profile),
    sourceEvaluationRunIds: runs.map((run) => run.runId).sort(),
    sourceEvaluationResultHashes: Object.fromEntries(runs.map((run) => [run.runId, run.resultHash])),
    includedCandidates: [...new Set(scoreRecords.map((record) => record.candidateId))].sort(),
    includedCapabilities: [...new Set(scoreRecords.map((record) => record.capabilityId))].sort(),
    includedDatasets: [...new Set(scoreRecords.map((record) => record.datasetId))].sort(),
    totalObservations: scoreRecords.reduce((sum, record) => sum + record.sourceObservationIds.length, 0),
    validObservations: scoreRecords.reduce((sum, record) => sum + record.rawMetrics.matched, 0),
    incompleteObservations: scoreRecords.reduce((sum, record) => sum + record.rawMetrics.unavailable + record.rawMetrics.skipped + record.rawMetrics.unauthorized, 0),
    scoreRecords: scoreRecords.sort((a, b) => a.scoreId.localeCompare(b.scoreId)),
    aggregates: {},
    sensitivityAnalysis: request.generateSensitivityAnalysis ? runSensitivityAnalysis(scoreRecords, profile) : [],
    testOnly: true,
    productionUseAllowed: false
  };
  scoreRun.aggregates.caseScores = aggregateScoreRecords(scoreRecords, ['capabilityId', 'datasetId', 'caseId', 'candidateId'], 'CASE');
  scoreRun.aggregates.datasetScores = aggregateScoreRecords(scoreRecords, ['capabilityId', 'datasetId', 'candidateStrategyId', 'candidateExecutorId'], 'DATASET');
  scoreRun.aggregates.capabilityScores = aggregateScoreRecords(scoreRecords, ['capabilityId', 'candidateStrategyId', 'candidateExecutorId'], 'CAPABILITY');
  scoreRun.aggregates.candidateScores = aggregateScoreRecords(scoreRecords, ['candidateStrategyId', 'candidateExecutorId'], 'CANDIDATE');
  scoreRun.aggregates.evaluationRunScores = aggregateScoreRecords(scoreRecords, ['evaluationRunId'], 'EVALUATION_RUN');
  scoreRun.gateOutcomes = scoreRecords.flatMap((record) => record.gates.filter((gate) => gate.triggered).map((gate) => ({ scoreId: record.scoreId, ...gate })));
  scoreRun.thresholdOutcomes = scoreRecords.flatMap((record) => record.thresholds.map((threshold) => ({ scoreId: record.scoreId, ...threshold })));
  scoreRun.scoreRunHash = scoreRunHash(scoreRun);
  return scoreRun;
}

function runSensitivityAnalysis(scoreRecords, profile) {
  const variants = [];
  for (const dimension of profile.dimensions.filter((item) => item.weight > 0).slice(0, 5)) {
    const delta = profile.sensitivity?.variationPct || 10;
    const affected = scoreRecords.filter((record) => record.dimensionScores.some((dim) => dim.dimensionId === dimension.dimensionId && dim.score !== null));
    const avg = affected.length ? mean(affected.map((record) => record.dimensionScores.find((dim) => dim.dimensionId === dimension.dimensionId).score)) : null;
    variants.push({
      variantId: `${profile.scoringProfileId}.${dimension.dimensionId}.weight_plus_${delta}`,
      changedParameter: `dimensions.${dimension.dimensionId}.weight`,
      originalValue: dimension.weight,
      testValue: round(dimension.weight * (1 + delta / 100)),
      scoreDelta: avg === null ? null : round(avg * (delta / 100) / 10),
      gateDelta: 0,
      thresholdDelta: 0,
      validityDelta: 'NO_RECOMMENDATION',
      dimensionsMostAffected: [dimension.dimensionId],
      note: 'Deterministic sensitivity exposure only; no optimized or preferred profile is selected.'
    });
  }
  return variants.sort((a, b) => a.variantId.localeCompare(b.variantId));
}

function scoreRunHash(scoreRun) {
  const copy = clone(scoreRun);
  delete copy.scoreRunHash;
  return sha256(copy);
}

function validateScoreRun(scoreRun) {
  const errors = [];
  if (scoreRun.valid === false) errors.push(...(scoreRun.validationErrors || []));
  if (scoreRun.testOnly !== true || scoreRun.productionUseAllowed === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_SCORE_RUN_PROHIBITED', 'Initial score runs must be test-only.'));
  for (const record of scoreRun.scoreRecords || []) {
    if (record.scoreHash !== scoreHash({ ...record, scoreHash: undefined })) errors.push(validationError('scoreHash', 'SCORE_HASH_MISMATCH', `Score hash mismatch for ${record.scoreId}.`));
    if (/winner|bestStrategy|recommendedStrategy|productionRecommendation|costPerSuccess|TCO|ROI/.test(stableStringify(record))) errors.push(validationError('scoreRecord', 'PROHIBITED_RECOMMENDATION_OR_COST_OUTPUT', 'Score records must not contain recommendation, winner, cost-effectiveness, TCO, or ROI output.'));
    if (record.resultClass === 'UNAUTHORIZED' && record.validity === SCORE_STATUSES.VALID) errors.push(validationError('validity', 'UNAUTHORIZED_EXECUTION_SCORED_SUCCESSFUL', 'Unauthorized execution cannot be scored as successful.'));
    for (const dim of record.dimensionScores) {
      if (dim.score !== null && (dim.score < 0 || dim.score > 100)) errors.push(validationError('dimensionScores.score', 'SCORE_OUTSIDE_RANGE', 'Dimension scores must be 0-100 when known.'));
      if (dim.status === SCORE_STATUSES.UNKNOWN && dim.score === 0) errors.push(validationError('dimensionScores.score', 'UNKNOWN_CONVERTED_TO_ZERO', 'UNKNOWN must not become zero.'));
      if (dim.status === SCORE_STATUSES.NOT_APPLICABLE && dim.score === 0) errors.push(validationError('dimensionScores.score', 'NOT_APPLICABLE_CONVERTED_TO_ZERO', 'NOT_APPLICABLE must not become zero.'));
    }
    if (record.compositeScore.valid && record.gates.some((gate) => gate.action === 'INVALIDATE_SCORE_RECORD' && gate.triggered)) errors.push(validationError('gates', 'CRITICAL_FAILURE_IGNORED', 'Blocking gates must affect score validity.'));
  }
  if (scoreRun.scoreRunHash !== scoreRunHash({ ...scoreRun, scoreRunHash: undefined })) errors.push(validationError('scoreRunHash', 'SCORE_RUN_HASH_MISMATCH', 'Score run hash must match content.'));
  if (containsSecretLikeValue(scoreRun)) errors.push(validationError('scoreRun', 'SECRET_LIKE_SCORE_CONTENT', 'Score output must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function runInitialScoring() {
  return loadScoringRequests().map((request) => calculateScoreRun(request));
}

function listScoreRuns() {
  return runInitialScoring().map((run) => ({ scoringRequestId: run.scoringRequestId, scoringProfileId: run.scoringProfileId, scoreRunHash: run.scoreRunHash, testOnly: run.testOnly }));
}

function listScoresByCapability(capabilityId) {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoreRunId: run.scoringRequestId, ...record }))).filter((record) => record.capabilityId === capabilityId);
}

function listScoresByDataset(datasetId) {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoreRunId: run.scoringRequestId, ...record }))).filter((record) => record.datasetId === datasetId);
}

function listScoresByCandidateStrategy(strategy) {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoreRunId: run.scoringRequestId, ...record }))).filter((record) => record.candidateStrategyId === strategy);
}

function listScoresByExecutor(executorId) {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoreRunId: run.scoringRequestId, ...record }))).filter((record) => record.candidateExecutorId === executorId);
}

function listCriticalGateFailures() {
  return runInitialScoring().flatMap((run) => run.gateOutcomes.map((gate) => ({ scoringRequestId: run.scoringRequestId, ...gate })));
}

function listThresholdFailures() {
  return runInitialScoring().flatMap((run) => run.thresholdOutcomes.map((threshold) => ({ scoringRequestId: run.scoringRequestId, ...threshold }))).filter((threshold) => threshold.status === THRESHOLD_STATUSES.NOT_MET);
}

function listIncompleteScores() {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoringRequestId: run.scoringRequestId, ...record }))).filter((record) => record.completeness.status !== 'COMPLETE');
}

function listInvalidScores() {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoringRequestId: run.scoringRequestId, ...record }))).filter((record) => record.validity === SCORE_STATUSES.INVALID);
}

function listUnknownDimensionScores() {
  return runInitialScoring().flatMap((run) => run.scoreRecords.flatMap((record) => record.dimensionScores.filter((dim) => dim.status === SCORE_STATUSES.UNKNOWN).map((dim) => ({ scoringRequestId: run.scoringRequestId, scoreId: record.scoreId, ...dim }))));
}

function listLowConfidenceScores() {
  return runInitialScoring().flatMap((run) => run.scoreRecords.map((record) => ({ scoringRequestId: run.scoringRequestId, ...record }))).filter((record) => ['LOW', 'INSUFFICIENT'].includes(record.confidence.status));
}

function compareScoreRuns(left, right) {
  const a = typeof left === 'string' ? calculateScoreRun(left) : left;
  const b = typeof right === 'string' ? calculateScoreRun(right) : right;
  return {
    equal: a.scoreRunHash === b.scoreRunHash,
    leftHash: a.scoreRunHash,
    rightHash: b.scoreRunHash,
    scoreCountDelta: (a.scoreRecords?.length || 0) - (b.scoreRecords?.length || 0)
  };
}

function compareScoringProfiles(left, right) {
  const a = typeof left === 'string' ? getScoringProfile(left) : left;
  const b = typeof right === 'string' ? getScoringProfile(right) : right;
  return {
    equal: profileHash(a) === profileHash(b),
    leftHash: profileHash(a),
    rightHash: profileHash(b),
    dimensionDelta: (a.dimensions?.length || 0) - (b.dimensions?.length || 0)
  };
}

function inspectCalculationTrace(scoreId) {
  for (const run of runInitialScoring()) {
    const record = run.scoreRecords.find((item) => item.scoreId === scoreId);
    if (record) return record.calculationTrace;
  }
  return null;
}

module.exports = {
  SCORING_ENGINE_VERSION,
  SCORING_REQUEST_SCHEMA_VERSION,
  SCORING_PROFILE_SCHEMA_VERSION,
  SCORE_RECORD_SCHEMA_VERSION,
  PROFILE_LIFECYCLE_STATES,
  SCORE_DIMENSIONS,
  NORMALIZATION_METHODS,
  THRESHOLD_STATUSES,
  SCORE_STATUSES,
  loadScoringProfiles,
  loadScoringRequests,
  getScoringProfile,
  getScoringRequest,
  validateScoringProfile,
  validateScoringRequest,
  mapObservationToDimension,
  calculateRawMetrics,
  normalizeMetric,
  calculateScoreRun,
  validateScoreRun,
  runInitialScoring,
  listScoreRuns,
  listScoresByCapability,
  listScoresByDataset,
  listScoresByCandidateStrategy,
  listScoresByExecutor,
  listCriticalGateFailures,
  listThresholdFailures,
  listIncompleteScores,
  listInvalidScores,
  listUnknownDimensionScores,
  listLowConfidenceScores,
  compareScoreRuns,
  compareScoringProfiles,
  inspectCalculationTrace,
  verifyScoreIntegrity: validateScoreRun,
  verifyDeterministicRecalculation: (requestId) => compareScoreRuns(calculateScoreRun(requestId), calculateScoreRun(requestId)),
  profileHash,
  requestHash,
  scoreHash,
  scoreRunHash,
  describeNumbers,
  stable,
  stableStringify,
  sha256,
  paths: { backendRoot, repoRoot, scoringRoot, profileRoot, requestRoot }
};
