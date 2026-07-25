const fs = require('fs');
const path = require('path');
const evaluationEngine = require('./evaluationEngine');
const scoringEngine = require('./scoringEngine');
const { microsToUsdString, parseUsdToMicros } = require('./money');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const costRoot = path.join(backendRoot, 'cost-governance');
const catalogRoot = path.join(costRoot, 'pricing-catalogs');
const modelProfileRoot = path.join(costRoot, 'cost-model-profiles');
const budgetProfileRoot = path.join(costRoot, 'budget-profiles');
const requestRoot = path.join(costRoot, 'requests');

const COST_GOVERNANCE_ENGINE_VERSION = 'intelligence.cost.governance.engine.v1';
const COST_GOVERNANCE_REQUEST_SCHEMA_VERSION = 'intelligence.cost.governance.request.v1';
const PRICING_CATALOG_SCHEMA_VERSION = 'intelligence.pricing.catalog.v1';
const COST_MODEL_PROFILE_SCHEMA_VERSION = 'intelligence.cost.model.profile.v1';
const BUDGET_PROFILE_SCHEMA_VERSION = 'intelligence.budget.profile.v1';
const COST_RECORD_SCHEMA_VERSION = 'intelligence.cost.record.v1';
const MICRO_USD_PER_USD = 1000000n;
const MAX_SAFE_MICRO_USD = 9007199254740991n;

const COST_SOURCE_CLASSES = Object.freeze({
  MEASURED: 'MEASURED',
  CONTRACTUAL: 'CONTRACTUAL',
  CATALOG: 'CATALOG',
  ESTIMATED: 'ESTIMATED',
  MODELED: 'MODELED',
  DERIVED: 'DERIVED',
  MOCK: 'MOCK',
  UNKNOWN: 'UNKNOWN'
});

const COST_COMPONENT_TYPES = Object.freeze({
  INPUT_TOKEN: 'INPUT_TOKEN',
  OUTPUT_TOKEN: 'OUTPUT_TOKEN',
  REQUEST_FEE: 'REQUEST_FEE',
  IMAGE_PROCESSING: 'IMAGE_PROCESSING',
  GEOSPATIAL_REQUEST: 'GEOSPATIAL_REQUEST',
  OPTIMIZATION_REQUEST: 'OPTIMIZATION_REQUEST',
  EXTERNAL_API_FEE: 'EXTERNAL_API_FEE',
  NETWORK_EGRESS: 'NETWORK_EGRESS',
  STORAGE_OPERATION: 'STORAGE_OPERATION',
  HUMAN_REVIEW_UNIT: 'HUMAN_REVIEW_UNIT',
  SUBSCRIPTION_FEE: 'SUBSCRIPTION_FEE',
  RESERVED_CAPACITY: 'RESERVED_CAPACITY',
  PLATFORM_FEE: 'PLATFORM_FEE',
  MINIMUM_COMMITMENT: 'MINIMUM_COMMITMENT',
  LOCAL_COMPUTE: 'LOCAL_COMPUTE',
  MEMORY: 'MEMORY',
  CPU: 'CPU',
  GPU: 'GPU',
  STORAGE: 'STORAGE',
  NETWORK: 'NETWORK',
  QUEUE_INFRASTRUCTURE: 'QUEUE_INFRASTRUCTURE',
  OBSERVABILITY: 'OBSERVABILITY',
  AUDIT_STORAGE: 'AUDIT_STORAGE',
  ENGINEERING_MAINTENANCE: 'ENGINEERING_MAINTENANCE',
  SUPPORT: 'SUPPORT',
  COMPLIANCE_OVERHEAD: 'COMPLIANCE_OVERHEAD',
  MODEL_HOSTING: 'MODEL_HOSTING',
  IDLE_CAPACITY: 'IDLE_CAPACITY',
  RETRY: 'RETRY',
  TIMEOUT: 'TIMEOUT',
  FALLBACK: 'FALLBACK',
  DUPLICATE_EXECUTION: 'DUPLICATE_EXECUTION',
  CACHE_LOOKUP: 'CACHE_LOOKUP',
  CACHE_MISS: 'CACHE_MISS',
  VALIDATION: 'VALIDATION',
  HUMAN_ESCALATION: 'HUMAN_ESCALATION',
  CREDIT: 'CREDIT'
});

const USAGE_UNITS = Object.freeze({
  REQUEST: 'REQUEST',
  INPUT_TOKEN: 'INPUT_TOKEN',
  OUTPUT_TOKEN: 'OUTPUT_TOKEN',
  TOTAL_TOKEN: 'TOTAL_TOKEN',
  CHARACTER: 'CHARACTER',
  BYTE: 'BYTE',
  IMAGE: 'IMAGE',
  AUDIO_SECOND: 'AUDIO_SECOND',
  VIDEO_SECOND: 'VIDEO_SECOND',
  GEOSPATIAL_REQUEST: 'GEOSPATIAL_REQUEST',
  ROUTE_REQUEST: 'ROUTE_REQUEST',
  OPTIMIZATION_RUN: 'OPTIMIZATION_RUN',
  CPU_MILLISECOND: 'CPU_MILLISECOND',
  GPU_MILLISECOND: 'GPU_MILLISECOND',
  MEMORY_MB_SECOND: 'MEMORY_MB_SECOND',
  STORAGE_BYTE_DAY: 'STORAGE_BYTE_DAY',
  NETWORK_BYTE: 'NETWORK_BYTE',
  HUMAN_REVIEW_MINUTE: 'HUMAN_REVIEW_MINUTE',
  HUMAN_REVIEW_CASE: 'HUMAN_REVIEW_CASE',
  CACHE_LOOKUP: 'CACHE_LOOKUP',
  CACHE_HIT: 'CACHE_HIT',
  CACHE_MISS: 'CACHE_MISS',
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  WORKLOAD_UNIT: 'WORKLOAD_UNIT'
});

const CATALOG_LIFECYCLE_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  VALIDATING: 'VALIDATING',
  APPROVED_FOR_TEST: 'APPROVED_FOR_TEST',
  ACTIVE_TEST: 'ACTIVE_TEST',
  FROZEN: 'FROZEN',
  DEPRECATED: 'DEPRECATED',
  RETIRED: 'RETIRED'
});

const COST_STATUSES = Object.freeze({
  KNOWN: 'KNOWN',
  ZERO: 'ZERO',
  ESTIMATED: 'ESTIMATED',
  MODELED: 'MODELED',
  MIXED: 'MIXED',
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  INVALID: 'INVALID'
});

const BUDGET_STATUSES = Object.freeze({
  WITHIN_LIMIT: 'WITHIN_LIMIT',
  WARNING: 'WARNING',
  SOFT_LIMIT_EXCEEDED: 'SOFT_LIMIT_EXCEEDED',
  SIMULATED_BLOCK: 'SIMULATED_BLOCK',
  UNKNOWN_COST_FAIL_CLOSED: 'UNKNOWN_COST_FAIL_CLOSED'
});

const SECRET_PATTERNS = [
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

function attachFilePath(record, filePath) {
  Object.defineProperty(record, '__filePath', { value: filePath, enumerable: false });
  return record;
}

function loadPricingCatalogs(root = catalogRoot) {
  return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath))
    .sort((a, b) => `${a.pricingCatalogId}@${a.version}`.localeCompare(`${b.pricingCatalogId}@${b.version}`));
}

function loadCostModelProfiles(root = modelProfileRoot) {
  return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath))
    .sort((a, b) => `${a.costModelProfileId}@${a.version}`.localeCompare(`${b.costModelProfileId}@${b.version}`));
}

function loadBudgetProfiles(root = budgetProfileRoot) {
  return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath))
    .sort((a, b) => `${a.budgetProfileId}@${a.version}`.localeCompare(`${b.budgetProfileId}@${b.version}`));
}

function loadCostGovernanceRequests(root = requestRoot) {
  return listJsonFiles(root).map((filePath) => attachFilePath(readJson(filePath), filePath))
    .sort((a, b) => a.costGovernanceRequestId.localeCompare(b.costGovernanceRequestId));
}

function getPricingCatalog(id, version = null) {
  return loadPricingCatalogs().find((item) => item.pricingCatalogId === id && (!version || item.version === version)) || null;
}

function getCostModelProfile(id, version = null) {
  return loadCostModelProfiles().find((item) => item.costModelProfileId === id && (!version || item.version === version)) || null;
}

function getBudgetProfile(id, version = null) {
  return loadBudgetProfiles().find((item) => item.budgetProfileId === id && (!version || item.version === version)) || null;
}

function getCostGovernanceRequest(id) {
  return loadCostGovernanceRequests().find((item) => item.costGovernanceRequestId === id) || null;
}

function validationError(field, rule, guidance) {
  return { field, rule, guidance };
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeMicroUsd(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && /^\d+(\.\d{1,6})?$/.test(value)) return parseUsdToMicros(value);
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value)) return null;
  return BigInt(value);
}

function microUsdToNumber(value) {
  if (value === null || value === undefined) return null;
  const micros = typeof value === 'bigint' ? value : BigInt(value);
  if (micros > MAX_SAFE_MICRO_USD || micros < -MAX_SAFE_MICRO_USD) throw new Error('micro-USD value exceeds safe JSON range');
  return Number(micros);
}

function addMicroUsd(values) {
  let total = 0n;
  for (const value of values) {
    if (value === null || value === undefined) return null;
    total += typeof value === 'bigint' ? value : BigInt(value);
    if (total > MAX_SAFE_MICRO_USD || total < -MAX_SAFE_MICRO_USD) throw new Error('micro-USD arithmetic overflow');
  }
  return total;
}

function multiplyMicroUsd(unitMicroUsd, quantity) {
  if (unitMicroUsd === null || unitMicroUsd === undefined || quantity === null || quantity === undefined) return null;
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('usage quantity must be a nonnegative integer');
  const total = (typeof unitMicroUsd === 'bigint' ? unitMicroUsd : BigInt(unitMicroUsd)) * BigInt(quantity);
  if (total > MAX_SAFE_MICRO_USD) throw new Error('micro-USD arithmetic overflow');
  return total;
}

function divideMicroUsd(numerator, denominator) {
  if (numerator === null || numerator === undefined || !denominator) return null;
  const value = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
  const divisor = BigInt(denominator);
  return value / divisor;
}

function hashWithoutIntegrity(value, integrityField = 'contentHash') {
  const copy = clone(value);
  delete copy.__filePath;
  if (copy.integrity) copy.integrity[integrityField] = null;
  return sha256(copy);
}

function pricingCatalogHash(catalog) {
  return hashWithoutIntegrity(catalog);
}

function costModelProfileHash(profile) {
  return hashWithoutIntegrity(profile);
}

function budgetProfileHash(profile) {
  return hashWithoutIntegrity(profile);
}

function requestHash(request) {
  const copy = clone(request);
  delete copy.__filePath;
  return sha256(copy);
}

function validatePricingCatalog(catalog, catalogs = loadPricingCatalogs()) {
  const errors = [];
  const duplicateCount = catalogs.filter((item) => item.pricingCatalogId === catalog.pricingCatalogId && item.version === catalog.version).length;
  if (duplicateCount > 1) errors.push(validationError('pricingCatalogId', 'DUPLICATE_CATALOG_ID_VERSION', 'Pricing catalog ID and version must be unique.'));
  if (catalog.schemaVersion !== PRICING_CATALOG_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_PRICING_CATALOG_SCHEMA', `Use ${PRICING_CATALOG_SCHEMA_VERSION}.`));
  if (!Object.values(CATALOG_LIFECYCLE_STATES).includes(catalog.lifecycleState)) errors.push(validationError('lifecycleState', 'INVALID_LIFECYCLE', 'Use a supported pricing catalog lifecycle state.'));
  if (catalog.currency !== 'USD') errors.push(validationError('currency', 'INVALID_CURRENCY', 'Initial test-only catalogs must use USD.'));
  if (catalog.productionUseAllowed === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_APPROVED_SYNTHETIC_CATALOG', 'Synthetic catalogs must not be production-approved.'));
  if (catalog.approvedBy || catalog.approvedAt || catalog.decisionRecordId) errors.push(validationError('approvedBy', 'INVENTED_OWNER_APPROVAL', 'Do not invent owner approval for synthetic catalogs.'));
  if (catalog.lifecycleState === CATALOG_LIFECYCLE_STATES.FROZEN && !catalog.integrity?.contentHash) errors.push(validationError('integrity.contentHash', 'FROZEN_CATALOG_WITHOUT_HASH', 'Frozen catalogs require content hash metadata.'));
  const seenEntries = new Set();
  for (const entry of catalog.entries || []) {
    if (seenEntries.has(entry.pricingEntryId)) errors.push(validationError('entries.pricingEntryId', 'DUPLICATE_PRICING_ENTRY_ID', 'Pricing entry IDs must be unique.'));
    seenEntries.add(entry.pricingEntryId);
    if (!Object.values(COST_COMPONENT_TYPES).includes(entry.costComponentType)) errors.push(validationError('entries.costComponentType', 'INVALID_COST_COMPONENT', 'Use a supported cost component type.'));
    if (!Object.values(USAGE_UNITS).includes(entry.unitType)) errors.push(validationError('entries.unitType', 'INCOMPATIBLE_UNIT', 'Use a supported usage unit.'));
    if (!Object.values(COST_SOURCE_CLASSES).includes(entry.sourceClass)) errors.push(validationError('entries.sourceClass', 'MISSING_SOURCE_CLASS', 'Use a supported cost source class.'));
    if (entry.sourceClass === COST_SOURCE_CLASSES.CONTRACTUAL && !entry.contractEvidenceId) errors.push(validationError('entries.sourceClass', 'CONTRACTUAL_WITHOUT_EVIDENCE', 'Contractual pricing requires actual contract evidence.'));
    if (typeof entry.priceMicroUsd !== 'number' || !Number.isInteger(entry.priceMicroUsd)) errors.push(validationError('entries.priceMicroUsd', 'FLOATING_POINT_MONEY_REJECTED', 'Prices must use integer micro-USD.'));
    if (entry.priceMicroUsd < 0 && entry.costComponentType !== COST_COMPONENT_TYPES.CREDIT) errors.push(validationError('entries.priceMicroUsd', 'NEGATIVE_PRICE_WITHOUT_CREDIT_TYPE', 'Negative prices require CREDIT component type.'));
    if (entry.tierStart !== null && entry.tierEnd !== null && entry.tierStart > entry.tierEnd) errors.push(validationError('entries.tierRange', 'INVALID_TIER_RANGE', 'Tier start must be <= tier end.'));
    if (entry.sourceClass === COST_SOURCE_CLASSES.MOCK && entry.productionApplicable === true) errors.push(validationError('entries.productionApplicable', 'MOCK_MARKED_PRODUCTION_APPLICABLE', 'Mock costs are never production-applicable.'));
  }
  const byKey = new Map();
  for (const entry of catalog.entries || []) {
    const key = `${entry.strategyId}:${entry.executorId}:${entry.costComponentType}:${entry.unitType}`;
    const existing = byKey.get(key) || [];
    for (const other of existing) {
      const aStart = entry.tierStart ?? 0;
      const aEnd = entry.tierEnd ?? Number.MAX_SAFE_INTEGER;
      const bStart = other.tierStart ?? 0;
      const bEnd = other.tierEnd ?? Number.MAX_SAFE_INTEGER;
      if (aStart <= bEnd && bStart <= aEnd) errors.push(validationError('entries.tierRange', 'OVERLAPPING_TIER_RANGE', 'Pricing tiers must not overlap for the same strategy, executor, component, and unit.'));
    }
    existing.push(entry);
    byKey.set(key, existing);
  }
  if (containsSecretLikeValue(catalog)) errors.push(validationError('catalog', 'SECRET_LIKE_PRICING_CATALOG_CONTENT', 'Pricing catalogs must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function validateCostModelProfile(profile, profiles = loadCostModelProfiles()) {
  const errors = [];
  const duplicateCount = profiles.filter((item) => item.costModelProfileId === profile.costModelProfileId && item.version === profile.version).length;
  if (duplicateCount > 1) errors.push(validationError('costModelProfileId', 'DUPLICATE_COST_MODEL_PROFILE_ID_VERSION', 'Cost model profile ID and version must be unique.'));
  if (profile.schemaVersion !== COST_MODEL_PROFILE_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_COST_MODEL_PROFILE_SCHEMA', `Use ${COST_MODEL_PROFILE_SCHEMA_VERSION}.`));
  if (!['PER_REQUEST', 'PER_VALID_RESULT', 'PROPORTIONAL_WORKLOAD'].includes(profile.fixedCostAllocationMethod)) errors.push(validationError('fixedCostAllocationMethod', 'UNSUPPORTED_ALLOCATION_METHOD', 'Use a supported fixed-cost allocation method.'));
  if (!Object.values(USAGE_UNITS).includes(profile.workloadDenominator)) errors.push(validationError('workloadDenominator', 'INCOMPATIBLE_WORKLOAD_DENOMINATOR', 'Use a supported usage unit as workload denominator.'));
  if (!profile.unknownCostPolicy) errors.push(validationError('unknownCostPolicy', 'UNKNOWN_COST_POLICY_MISSING', 'Profiles require an unknown-cost policy.'));
  if (profile.retryTreatment === 'INCLUDE' && profile.preventRetryDoubleCount !== true) errors.push(validationError('retryTreatment', 'CONTRADICTORY_RETRY_TREATMENT', 'Retry inclusion must prevent double counting.'));
  if (!['BANKERS', 'FLOOR_REMAINDER_TRACKED', 'CEILING_REMAINDER_TRACKED'].includes(profile.roundingMode)) errors.push(validationError('roundingMode', 'INVALID_ROUNDING_MODE', 'Use a deterministic rounding mode.'));
  if (profile.currency !== 'USD') errors.push(validationError('currency', 'MIXED_CURRENCY', 'Initial profiles support USD only.'));
  if (profile.productionUseAllowed === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_COST_MODEL_PROHIBITED', 'Initial profiles must be test-only.'));
  if (containsSecretLikeValue(profile)) errors.push(validationError('profile', 'SECRET_LIKE_COST_MODEL_PROFILE_CONTENT', 'Cost model profiles must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function validateBudgetProfile(profile, profiles = loadBudgetProfiles()) {
  const errors = [];
  const duplicateCount = profiles.filter((item) => item.budgetProfileId === profile.budgetProfileId && item.version === profile.version).length;
  if (duplicateCount > 1) errors.push(validationError('budgetProfileId', 'DUPLICATE_BUDGET_PROFILE_ID_VERSION', 'Budget profile ID and version must be unique.'));
  if (profile.schemaVersion !== BUDGET_PROFILE_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_BUDGET_PROFILE_SCHEMA', `Use ${BUDGET_PROFILE_SCHEMA_VERSION}.`));
  if (profile.currency !== 'USD') errors.push(validationError('currency', 'MIXED_CURRENCY', 'Initial budgets support USD only.'));
  if (profile.limitMicroUsd < 0 || profile.softLimitMicroUsd < 0 || profile.hardLimitMicroUsd < 0) errors.push(validationError('limitMicroUsd', 'NEGATIVE_BUDGET_LIMIT', 'Budget limits must be nonnegative.'));
  if (profile.softLimitMicroUsd > profile.hardLimitMicroUsd) errors.push(validationError('softLimitMicroUsd', 'SOFT_LIMIT_GREATER_THAN_HARD_LIMIT', 'Soft limit must be <= hard limit.'));
  if (profile.warningThresholdPct > profile.blockingThresholdPct) errors.push(validationError('warningThresholdPct', 'WARNING_THRESHOLD_GREATER_THAN_BLOCKING_THRESHOLD', 'Warning threshold must be <= blocking threshold.'));
  if (profile.productionEnforcementAllowed === true) errors.push(validationError('productionEnforcementAllowed', 'PRODUCTION_ENFORCEMENT_PROHIBITED', 'Initial budget profiles must not enforce production limits.'));
  if (profile.premiumExecutionAllowed === true && profile.premiumRequiresExplicitApproval !== true) errors.push(validationError('premiumExecutionAllowed', 'PREMIUM_POLICY_CONTRADICTORY', 'Premium execution requires explicit approval.'));
  if (profile.safetyOverrideAllowed === true) errors.push(validationError('safetyOverrideAllowed', 'SAFETY_OVERRIDE_ALLOWED', 'Budget policy must not override safety controls.'));
  if (profile.approvedBy || profile.approvedAt || profile.decisionRecordId) errors.push(validationError('approvedBy', 'INVENTED_OWNER_APPROVAL', 'Do not invent owner approval for synthetic budget profiles.'));
  if (containsSecretLikeValue(profile)) errors.push(validationError('profile', 'SECRET_LIKE_BUDGET_PROFILE_CONTENT', 'Budget profiles must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function resolveScoreRun(scoreRunId) {
  const requestId = scoreRunId.replace(/^cost\./, 'score.');
  try {
    const run = scoringEngine.calculateScoreRun(requestId);
    return scoringEngine.validateScoreRun(run).valid ? run : null;
  } catch {
    return null;
  }
}

function validateCostGovernanceRequest(request, context = {}) {
  const errors = [];
  const requests = context.requests || loadCostGovernanceRequests();
  const duplicateCount = requests.filter((item) => item.costGovernanceRequestId === request.costGovernanceRequestId).length;
  const catalog = getPricingCatalog(request.pricingCatalogId, request.pricingCatalogVersion);
  const modelProfile = getCostModelProfile(request.costModelProfileId, request.costModelProfileVersion);
  const budgetProfile = getBudgetProfile(request.budgetProfileId, request.budgetProfileVersion);
  if (duplicateCount > 1) errors.push(validationError('costGovernanceRequestId', 'DUPLICATE_COST_GOVERNANCE_REQUEST_ID', 'Cost governance request IDs must be unique.'));
  if (request.schemaVersion !== COST_GOVERNANCE_REQUEST_SCHEMA_VERSION) errors.push(validationError('schemaVersion', 'INVALID_COST_GOVERNANCE_REQUEST_SCHEMA', `Use ${COST_GOVERNANCE_REQUEST_SCHEMA_VERSION}.`));
  if (!/^cost\.[a-z0-9_.-]+$/.test(request.costGovernanceRequestId || '')) errors.push(validationError('costGovernanceRequestId', 'INVALID_COST_GOVERNANCE_REQUEST_ID', 'Use cost.<machine-readable-id>.'));
  if (!catalog) errors.push(validationError('pricingCatalogId', 'UNKNOWN_PRICING_CATALOG', 'Reference a known pricing catalog and version.'));
  if (!modelProfile) errors.push(validationError('costModelProfileId', 'UNKNOWN_COST_MODEL_PROFILE', 'Reference a known cost model profile and version.'));
  if (!budgetProfile) errors.push(validationError('budgetProfileId', 'UNKNOWN_BUDGET_PROFILE', 'Reference a known budget profile and version.'));
  if (catalog && budgetProfile && catalog.currency !== budgetProfile.currency) errors.push(validationError('currency', 'INCOMPATIBLE_CURRENCY', 'Catalog and budget currencies must match.'));
  for (const runId of request.evaluationRunIds || []) {
    try {
      const run = evaluationEngine.runEvaluation(runId);
      const integrity = evaluationEngine.validateEvaluationRun(run);
      if (!integrity.valid) errors.push(validationError('evaluationRunIds', 'INVALID_EVALUATION_INTEGRITY', `Evaluation run ${runId} failed integrity validation.`));
    } catch {
      errors.push(validationError('evaluationRunIds', 'UNKNOWN_EVALUATION_RUN', `Evaluation run ${runId} is unknown.`));
    }
  }
  for (const scoreRunId of request.scoreRunIds || []) {
    const scoreRun = resolveScoreRun(scoreRunId);
    if (!scoreRun) errors.push(validationError('scoreRunIds', 'UNKNOWN_SCORE_RUN', `Score run ${scoreRunId} is unknown or invalid.`));
  }
  if (request.simulatedBudgetAmountMicroUsd < 0) errors.push(validationError('simulatedBudgetAmountMicroUsd', 'NEGATIVE_BUDGET', 'Simulated budget must be nonnegative.'));
  if (request.warningThresholdOverride !== null && (request.warningThresholdOverride < 0 || request.warningThresholdOverride > 100)) errors.push(validationError('warningThresholdOverride', 'INVALID_THRESHOLD_OVERRIDE', 'Warning threshold override must be 0-100.'));
  if (request.blockingThresholdOverride !== null && (request.blockingThresholdOverride < 0 || request.blockingThresholdOverride > 100)) errors.push(validationError('blockingThresholdOverride', 'INVALID_THRESHOLD_OVERRIDE', 'Blocking threshold override must be 0-100.'));
  if (request.allowUnknownCosts === false && request.failOnUnknownRequiredCost === false) errors.push(validationError('allowUnknownCosts', 'CONTRADICTORY_CONTROL_FLAGS', 'Unknown costs cannot be disallowed while fail-closed is disabled.'));
  if (request.livePricingLookup === true) errors.push(validationError('livePricingLookup', 'LIVE_PRICING_REQUEST_PROHIBITED', 'Live pricing lookups are not allowed.'));
  if (request.productionEnforcementRequested === true) errors.push(validationError('productionEnforcementRequested', 'PRODUCTION_ENFORCEMENT_REQUEST_PROHIBITED', 'Production budget enforcement is not allowed.'));
  if (containsSecretLikeValue(request)) errors.push(validationError('request', 'SECRET_LIKE_COST_GOVERNANCE_REQUEST_CONTENT', 'Cost governance requests must not contain credentials, tokens, or private URLs.'));
  return { valid: errors.length === 0, errors };
}

function normalizeUsage(result) {
  const usage = result.usage || {};
  const observations = [
    usageObservation('REQUEST_FEE', USAGE_UNITS.REQUEST, 1, 'DERIVED_FROM_EVALUATION_RESULT'),
    usageObservation('WORKLOAD_UNIT', USAGE_UNITS.WORKLOAD_UNIT, 1, 'DERIVED_FROM_EVALUATION_RESULT')
  ];
  let inputTokens = Number(usage.input_tokens ?? usage.inputTokens ?? 0);
  let outputTokens = Number(usage.output_tokens ?? usage.outputTokens ?? 0);
  if ((!Number.isFinite(inputTokens) || inputTokens <= 0) && (!Number.isFinite(outputTokens) || outputTokens <= 0)) {
    const syntheticLength = stableStringify(result.output || result.rawOutput || '').length;
    inputTokens = Math.max(1, Math.ceil(syntheticLength / 8));
    outputTokens = Math.max(1, Math.ceil(syntheticLength / 6));
  }
  if (Number.isFinite(inputTokens) && inputTokens > 0) observations.push(usageObservation('INPUT_TOKEN', USAGE_UNITS.INPUT_TOKEN, Math.trunc(inputTokens), 'MOCK_USAGE'));
  if (Number.isFinite(outputTokens) && outputTokens > 0) observations.push(usageObservation('OUTPUT_TOKEN', USAGE_UNITS.OUTPUT_TOKEN, Math.trunc(outputTokens), 'MOCK_USAGE'));
  if ((result.retryCount || 0) > 0) observations.push(usageObservation('RETRY', USAGE_UNITS.RETRY, result.retryCount, 'EVALUATION_RETRY_METADATA'));
  if (result.resultClass === 'TIMEOUT') observations.push(usageObservation('TIMEOUT', USAGE_UNITS.REQUEST, 1, 'EVALUATION_RESULT_CLASS'));
  if (result.resultClass === 'HUMAN_REVIEW_REQUIRED' || result.observations?.some((obs) => obs.domain === 'HUMAN_REVIEW')) observations.push(usageObservation('HUMAN_REVIEW_CASE', USAGE_UNITS.HUMAN_REVIEW_CASE, 1, 'SYNTHETIC_HUMAN_REVIEW_SIGNAL'));
  return observations;
}

function usageObservation(componentType, unitType, quantity, sourceId) {
  return { componentType, unitType, quantity, sourceId, sourceClass: COST_SOURCE_CLASSES.DERIVED };
}

function findPricingEntry(catalog, result, componentType, unitType) {
  const entries = catalog.entries || [];
  return entries.find((entry) => (
    entry.costComponentType === componentType &&
    entry.unitType === unitType &&
    (!entry.strategyId || entry.strategyId === result.strategy) &&
    (!entry.executorId || entry.executorId === result.executorId)
  )) || entries.find((entry) => entry.costComponentType === componentType && entry.unitType === unitType && !entry.strategyId && !entry.executorId) || null;
}

function classifyRawCost(result) {
  const raw = result.observations?.find((obs) => obs.evaluationType === 'COST_OBSERVATION')?.actual || result.cost || null;
  if (!raw || raw.knowledgeStatus === 'UNKNOWN') {
    return {
      status: COST_STATUSES.UNKNOWN,
      sourceClass: COST_SOURCE_CLASSES.UNKNOWN,
      amountMicroUsd: null,
      sourceId: raw?.source || 'UNKNOWN'
    };
  }
  if (raw.actualCostMicroUsd !== null && raw.actualCostMicroUsd !== undefined) {
    const amount = normalizeMicroUsd(raw.actualCostMicroUsd);
    return {
      status: amount === 0n ? COST_STATUSES.ZERO : COST_STATUSES.KNOWN,
      sourceClass: raw.source === 'MOCK_ZERO_COST' ? COST_SOURCE_CLASSES.MOCK : COST_SOURCE_CLASSES.MEASURED,
      amountMicroUsd: amount,
      sourceId: raw.source || 'EVALUATION_COST'
    };
  }
  if (raw.estimatedCostMicroUsd !== null && raw.estimatedCostMicroUsd !== undefined) {
    return {
      status: COST_STATUSES.ESTIMATED,
      sourceClass: COST_SOURCE_CLASSES.ESTIMATED,
      amountMicroUsd: normalizeMicroUsd(raw.estimatedCostMicroUsd),
      sourceId: raw.source || 'EVALUATION_ESTIMATED_COST'
    };
  }
  return {
    status: COST_STATUSES.UNKNOWN,
    sourceClass: COST_SOURCE_CLASSES.UNKNOWN,
    amountMicroUsd: null,
    sourceId: raw.source || 'UNKNOWN'
  };
}

function buildCostComponents(request, catalog, modelProfile, budgetProfile, scoreRecord, scoreRun, evaluationResult) {
  const components = [];
  const rawCost = classifyRawCost(evaluationResult);
  components.push(costComponent('RAW_EVALUATION_COST', 'DIRECT_VARIABLE', rawCost.sourceClass, rawCost.amountMicroUsd, rawCost.status, 1, 'REQUEST', rawCost.sourceId, 'Raw evaluation cost observation preserved separately.'));
  for (const usage of normalizeUsage(evaluationResult)) {
    const entry = findPricingEntry(catalog, evaluationResult, usage.componentType, usage.unitType);
    if (!entry) {
      components.push(costComponent(usage.componentType, 'DIRECT_VARIABLE', COST_SOURCE_CLASSES.UNKNOWN, null, COST_STATUSES.UNKNOWN, usage.quantity, usage.unitType, usage.sourceId, 'No compatible pricing entry.'));
      continue;
    }
    const amount = multiplyMicroUsd(BigInt(entry.priceMicroUsd), usage.quantity);
    const minimum = normalizeMicroUsd(entry.minimumChargeMicroUsd || 0);
    const charged = minimum !== null && amount !== null && amount < minimum ? minimum : amount;
    components.push(costComponent(entry.costComponentType, entry.fixedOrVariable === 'FIXED' ? 'DIRECT_FIXED' : 'DIRECT_VARIABLE', entry.sourceClass, charged, entry.sourceClass === COST_SOURCE_CLASSES.MOCK ? COST_STATUSES.MODELED : COST_STATUSES.ESTIMATED, usage.quantity, entry.unitType, entry.pricingEntryId, `Pricing entry ${entry.pricingEntryId}.`));
  }
  if (request.includeFixedCosts && modelProfile.includedCostComponents.includes('LOCAL_COMPUTE')) {
    const allocation = divideMicroUsd(BigInt(modelProfile.syntheticFixedPoolMicroUsd), Math.max(1, scoreRun.scoreRecords.length));
    components.push(costComponent(COST_COMPONENT_TYPES.LOCAL_COMPUTE, 'INDIRECT_FIXED', COST_SOURCE_CLASSES.MODELED, allocation, COST_STATUSES.MODELED, 1, USAGE_UNITS.REQUEST, modelProfile.costModelProfileId, 'Synthetic local compute fixed allocation.'));
  }
  if (request.includeHumanReviewCosts && scoreRecord.dimensionScores.some((dim) => dim.dimensionId === 'HUMAN_REVIEW_ALIGNMENT' && dim.status !== 'NOT_APPLICABLE')) {
    const entry = findPricingEntry(catalog, evaluationResult, COST_COMPONENT_TYPES.HUMAN_REVIEW_UNIT, USAGE_UNITS.HUMAN_REVIEW_CASE);
    const amount = entry ? normalizeMicroUsd(entry.priceMicroUsd) : null;
    components.push(costComponent(COST_COMPONENT_TYPES.HUMAN_REVIEW_UNIT, 'DIRECT_VARIABLE', entry ? entry.sourceClass : COST_SOURCE_CLASSES.UNKNOWN, amount, amount === null ? COST_STATUSES.UNKNOWN : COST_STATUSES.MODELED, 1, USAGE_UNITS.HUMAN_REVIEW_CASE, entry?.pricingEntryId || 'MISSING_HUMAN_REVIEW_COST', 'Synthetic human-review representation.'));
  }
  return components.sort((a, b) => `${a.componentType}:${a.sourceId}`.localeCompare(`${b.componentType}:${b.sourceId}`));
}

function costComponent(componentType, componentCategory, sourceClass, amountMicroUsd, status, usageQuantity, usageUnit, sourceId, note) {
  return {
    componentType,
    componentCategory,
    sourceClass,
    amountMicroUsd: microUsdToNumber(amountMicroUsd),
    amountUsd: amountMicroUsd === null ? null : microsToUsdString(amountMicroUsd),
    status,
    usageQuantity,
    usageUnit,
    sourceId,
    testOnly: true,
    productionApplicable: false,
    note
  };
}

function summarizeComponents(components) {
  const known = components.filter((item) => item.amountMicroUsd !== null);
  const unknown = components.filter((item) => item.amountMicroUsd === null);
  const total = known.length ? addMicroUsd(known.map((item) => item.amountMicroUsd)) : 0n;
  const hasEstimated = components.some((item) => item.status === COST_STATUSES.ESTIMATED);
  const hasModeled = components.some((item) => item.status === COST_STATUSES.MODELED);
  return {
    totalKnownCostMicroUsd: microUsdToNumber(total),
    totalKnownCostUsd: microsToUsdString(total),
    unknownComponentCount: unknown.length,
    knownComponentCount: known.length,
    status: unknown.length ? COST_STATUSES.MIXED : hasEstimated ? COST_STATUSES.ESTIMATED : hasModeled ? COST_STATUSES.MODELED : total === 0n ? COST_STATUSES.ZERO : COST_STATUSES.KNOWN
  };
}

function calculateCostMetrics(record) {
  const total = record.costSummary.totalKnownCostMicroUsd;
  const valid = record.scoreRecord.validity === 'VALID';
  const thresholdCompliant = record.scoreRecord.thresholds.every((item) => ['MET', 'NOT_APPLICABLE'].includes(item.status));
  const safetyCompliant = !record.scoreRecord.gates.some((gate) => gate.dimensionId === 'SAFETY' && gate.triggered);
  const unknown = record.costSummary.unknownComponentCount > 0;
  return {
    costPerAttemptedRequestMicroUsd: total,
    costPerCompletedEvaluationMicroUsd: record.evaluationResult.resultClass === 'SKIPPED' ? null : total,
    costPerValidResultMicroUsd: valid && !unknown ? total : null,
    costPerThresholdCompliantResultMicroUsd: valid && thresholdCompliant && !unknown ? total : null,
    costPerSafetyCompliantResultMicroUsd: safetyCompliant && !unknown ? total : null,
    costPerWorkloadUnitMicroUsd: total,
    thresholdCompliant,
    safetyCompliant,
    costEffectivenessEvidence: valid && safetyCompliant && !unknown ? 'DESCRIPTIVE_EVIDENCE_ONLY' : 'NOT_NUMERICALLY_COMPARABLE',
    frontierCategory: 'DESCRIPTIVE_ONLY_NO_WINNER'
  };
}

function evaluateBudget(record, budgetProfile, request) {
  const total = record.costSummary.totalKnownCostMicroUsd;
  const hasUnknown = record.costSummary.unknownComponentCount > 0;
  const hard = request.simulatedBudgetAmountMicroUsd || budgetProfile.hardLimitMicroUsd;
  const warningPct = request.warningThresholdOverride ?? budgetProfile.warningThresholdPct;
  const blockingPct = request.blockingThresholdOverride ?? budgetProfile.blockingThresholdPct;
  if (hasUnknown && budgetProfile.unknownCostPolicy === 'FAIL_CLOSED') {
    return {
      status: BUDGET_STATUSES.UNKNOWN_COST_FAIL_CLOSED,
      totalKnownCostMicroUsd: total,
      simulatedLimitMicroUsd: hard,
      percentConsumed: null,
      remainingMicroUsd: null,
      simulatedRuntimeBlock: false,
      reason: 'Unknown cost remains unknown and budget evaluation fails closed.'
    };
  }
  const pct = hard ? Math.floor((total / hard) * 10000) / 100 : 0;
  let status = BUDGET_STATUSES.WITHIN_LIMIT;
  if (pct >= blockingPct) status = BUDGET_STATUSES.SIMULATED_BLOCK;
  else if (pct >= budgetProfile.softLimitPct) status = BUDGET_STATUSES.SOFT_LIMIT_EXCEEDED;
  else if (pct >= warningPct) status = BUDGET_STATUSES.WARNING;
  return {
    status,
    totalKnownCostMicroUsd: total,
    simulatedLimitMicroUsd: hard,
    percentConsumed: pct,
    remainingMicroUsd: Math.max(0, hard - total),
    simulatedRuntimeBlock: false,
    reason: status === BUDGET_STATUSES.SIMULATED_BLOCK ? 'Simulated block only; no production request was blocked.' : 'Budget simulation only.'
  };
}

function calculateCompleteness(record) {
  const total = record.costComponents.length;
  const known = record.costComponents.filter((item) => item.amountMicroUsd !== null).length;
  const score = total ? Math.round((known / total) * 10000) / 100 : null;
  return {
    score,
    status: score === null ? 'UNKNOWN' : score === 100 ? 'COMPLETE' : score >= 50 ? 'PARTIAL' : 'INSUFFICIENT',
    unknownComponentCount: record.costSummary.unknownComponentCount,
    knownComponentCount: record.costSummary.knownComponentCount
  };
}

function calculateConfidence(record, catalog, modelProfile) {
  const syntheticPenalty = catalog.testOnly ? 30 : 0;
  const unknownPenalty = record.costSummary.unknownComponentCount * 10;
  const modeledPenalty = record.costComponents.some((item) => item.status === COST_STATUSES.MODELED) ? 15 : 0;
  const score = Math.max(0, 80 - syntheticPenalty - unknownPenalty - modeledPenalty);
  return {
    score,
    status: score >= 75 ? 'HIGH' : score >= 50 ? 'MODERATE' : score >= 25 ? 'LOW' : 'INSUFFICIENT',
    methodVersion: modelProfile.confidenceMethod,
    limitingFactors: ['synthetic pricing catalog', 'mock evaluation evidence'].concat(record.costSummary.unknownComponentCount ? ['unknown cost components'] : []),
    testOnly: true
  };
}

function buildCostRecord(request, catalog, modelProfile, budgetProfile, scoreRun, scoreRecord, evaluationRun, evaluationResult) {
  const costComponents = buildCostComponents(request, catalog, modelProfile, budgetProfile, scoreRecord, scoreRun, evaluationResult);
  const record = {
    schemaVersion: COST_RECORD_SCHEMA_VERSION,
    costRecordId: `${request.costGovernanceRequestId}.${scoreRecord.scoreId}`,
    costGovernanceRequestId: request.costGovernanceRequestId,
    costGovernanceEngineVersion: COST_GOVERNANCE_ENGINE_VERSION,
    pricingCatalogId: catalog.pricingCatalogId,
    pricingCatalogVersion: catalog.version,
    costModelProfileId: modelProfile.costModelProfileId,
    costModelProfileVersion: modelProfile.version,
    budgetProfileId: budgetProfile.budgetProfileId,
    budgetProfileVersion: budgetProfile.version,
    evaluationRunId: evaluationRun.runId,
    scoreId: scoreRecord.scoreId,
    capabilityId: scoreRecord.capabilityId,
    datasetId: scoreRecord.datasetId,
    candidateStrategyId: scoreRecord.candidateStrategyId,
    candidateExecutorId: scoreRecord.candidateExecutorId,
    resultClass: evaluationResult.resultClass,
    scoreRecord: {
      validity: scoreRecord.validity,
      gates: scoreRecord.gates,
      thresholds: scoreRecord.thresholds,
      compositeScore: scoreRecord.compositeScore.gateAdjustedComposite
    },
    evaluationResult: {
      resultId: evaluationResult.resultId,
      resultClass: evaluationResult.resultClass,
      retryCount: evaluationResult.retryCount || 0,
      durationMs: evaluationResult.durationMs,
      usage: evaluationResult.usage || null
    },
    costComponents,
    costSummary: summarizeComponents(costComponents),
    trace: {
      sourceEvaluationRunHash: evaluationRun.resultHash,
      sourceScoreHash: scoreRecord.scoreHash,
      pricingCatalogHash: pricingCatalogHash(catalog),
      costModelProfileHash: costModelProfileHash(modelProfile),
      budgetProfileHash: budgetProfileHash(budgetProfile),
      moneyUnit: 'MICRO_USD',
      roundingMode: modelProfile.roundingMode
    },
    testOnly: true,
    productionUseAllowed: false
  };
  record.costMetrics = calculateCostMetrics(record);
  record.budgetEvaluation = evaluateBudget(record, budgetProfile, request);
  record.completeness = calculateCompleteness(record);
  record.confidence = calculateConfidence(record, catalog, modelProfile);
  record.costRecordHash = costRecordHash(record);
  return record;
}

function findEvaluationResult(evaluationRun, scoreRecord) {
  return evaluationRun.results.find((result) => result.resultId === scoreRecord.calculationTrace.sourceResultId) || null;
}

function calculateCostGovernanceRun(requestOrId) {
  const request = typeof requestOrId === 'string' ? getCostGovernanceRequest(requestOrId) : requestOrId;
  if (!request) throw new Error(`Cost governance request not found: ${requestOrId}`);
  const requestValidation = validateCostGovernanceRequest(request);
  if (!requestValidation.valid) return { schemaVersion: 'intelligence.cost.governance.run.v1', costGovernanceRequestId: request.costGovernanceRequestId, valid: false, validationErrors: requestValidation.errors };
  const catalog = getPricingCatalog(request.pricingCatalogId, request.pricingCatalogVersion);
  const modelProfile = getCostModelProfile(request.costModelProfileId, request.costModelProfileVersion);
  const budgetProfile = getBudgetProfile(request.budgetProfileId, request.budgetProfileVersion);
  const validations = [validatePricingCatalog(catalog), validateCostModelProfile(modelProfile), validateBudgetProfile(budgetProfile)];
  const errors = validations.flatMap((item) => item.errors);
  if (errors.length) return { schemaVersion: 'intelligence.cost.governance.run.v1', costGovernanceRequestId: request.costGovernanceRequestId, valid: false, validationErrors: errors };
  const evaluationRuns = new Map(request.evaluationRunIds.map((runId) => [runId, evaluationEngine.runEvaluation(runId)]));
  const scoreRuns = request.scoreRunIds.map(resolveScoreRun);
  const records = [];
  for (const scoreRun of scoreRuns) {
    for (const scoreRecord of scoreRun.scoreRecords) {
      const evaluationRun = evaluationRuns.get(scoreRecord.evaluationRunId);
      const evaluationResult = evaluationRun ? findEvaluationResult(evaluationRun, scoreRecord) : null;
      if (evaluationRun && evaluationResult) records.push(buildCostRecord(request, catalog, modelProfile, budgetProfile, scoreRun, scoreRecord, evaluationRun, evaluationResult));
    }
  }
  const run = {
    schemaVersion: 'intelligence.cost.governance.run.v1',
    costGovernanceRequestId: request.costGovernanceRequestId,
    costGovernanceRequestVersion: request.version,
    costGovernanceEngineVersion: COST_GOVERNANCE_ENGINE_VERSION,
    pricingCatalogId: catalog.pricingCatalogId,
    pricingCatalogVersion: catalog.version,
    costModelProfileId: modelProfile.costModelProfileId,
    budgetProfileId: budgetProfile.budgetProfileId,
    currency: 'USD',
    requestHash: requestHash(request),
    pricingCatalogHash: pricingCatalogHash(catalog),
    costModelProfileHash: costModelProfileHash(modelProfile),
    budgetProfileHash: budgetProfileHash(budgetProfile),
    sourceEvaluationRunIds: [...evaluationRuns.keys()].sort(),
    sourceScoreRunIds: scoreRuns.map((runItem) => runItem.scoringRequestId).sort(),
    costRecords: records.sort((a, b) => a.costRecordId.localeCompare(b.costRecordId)),
    aggregates: {},
    sensitivityAnalysis: request.includeSensitivityAnalysis ? runCostSensitivityAnalysis(records, request, catalog, modelProfile, budgetProfile) : [],
    budgetExhaustionSimulation: simulateBudgetExhaustion(records, budgetProfile, request),
    testOnly: true,
    productionUseAllowed: false
  };
  run.aggregates.caseCosts = aggregateCostRecords(records, ['capabilityId', 'datasetId', 'costRecordId'], 'CASE');
  run.aggregates.datasetCosts = aggregateCostRecords(records, ['capabilityId', 'datasetId', 'candidateStrategyId', 'candidateExecutorId'], 'DATASET');
  run.aggregates.capabilityCosts = aggregateCostRecords(records, ['capabilityId', 'candidateStrategyId', 'candidateExecutorId'], 'CAPABILITY');
  run.aggregates.candidateCosts = aggregateCostRecords(records, ['candidateStrategyId', 'candidateExecutorId'], 'CANDIDATE');
  run.aggregates.evaluationRunCosts = aggregateCostRecords(records, ['evaluationRunId'], 'EVALUATION_RUN');
  run.costGovernanceRunHash = costGovernanceRunHash(run);
  return run;
}

function aggregateCostRecords(records, groupFields, level) {
  const groups = new Map();
  for (const record of records) {
    const key = groupFields.map((field) => record[field] || 'ALL').join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key, items]) => {
    const knownCosts = items.map((item) => item.costSummary.totalKnownCostMicroUsd);
    const total = addMicroUsd(knownCosts) || 0n;
    const aggregate = {
      aggregateCostId: `${level}.${sha256(key).slice(0, 16)}`,
      level,
      group: Object.fromEntries(groupFields.map((field, index) => [field, key.split('|')[index]])),
      costRecordCount: items.length,
      totalKnownCostMicroUsd: microUsdToNumber(total),
      totalKnownCostUsd: microsToUsdString(total),
      unknownCostRecordCount: items.filter((item) => item.costSummary.unknownComponentCount > 0).length,
      estimatedCostRecordCount: items.filter((item) => [COST_STATUSES.ESTIMATED, COST_STATUSES.MIXED].includes(item.costSummary.status)).length,
      budgetWarningCount: items.filter((item) => [BUDGET_STATUSES.WARNING, BUDGET_STATUSES.SOFT_LIMIT_EXCEEDED].includes(item.budgetEvaluation.status)).length,
      simulatedBlockCount: items.filter((item) => item.budgetEvaluation.status === BUDGET_STATUSES.SIMULATED_BLOCK).length,
      sourceCostRecordIds: items.map((item) => item.costRecordId).sort()
    };
    aggregate.aggregateHash = sha256(aggregate);
    return aggregate;
  }).sort((a, b) => a.aggregateCostId.localeCompare(b.aggregateCostId));
}

function runCostSensitivityAnalysis(records, request, catalog) {
  const variants = [];
  for (const pct of [10, 25]) {
    const base = addMicroUsd(records.map((item) => item.costSummary.totalKnownCostMicroUsd)) || 0n;
    variants.push({
      variantId: `${request.costGovernanceRequestId}.pricing_increase_${pct}`,
      changedParameter: 'pricingCatalog.entries.priceMicroUsd',
      originalValue: 'synthetic catalog',
      testValue: `+${pct}%`,
      totalCostDeltaMicroUsd: microUsdToNumber((base * BigInt(pct)) / 100n),
      budgetStatusDelta: 'SIMULATED_ONLY',
      recommendation: null,
      note: 'Deterministic cost sensitivity only; no optimized profile, winner, procurement action, or production recommendation is selected.'
    });
  }
  variants.push({
    variantId: `${request.costGovernanceRequestId}.cache_hit_rate`,
    changedParameter: 'cache.hit.rate',
    originalValue: 'not modeled',
    testValue: 'synthetic 20 percent cache-hit scenario',
    totalCostDeltaMicroUsd: 0,
    budgetStatusDelta: 'NO_RUNTIME_EFFECT',
    recommendation: null,
    note: `Catalog ${catalog.pricingCatalogId} remains synthetic and test-only.`
  });
  return variants;
}

function simulateBudgetExhaustion(records, budgetProfile, request) {
  const perRunCost = addMicroUsd(records.map((item) => item.costSummary.totalKnownCostMicroUsd)) || 0n;
  const hard = BigInt(request.simulatedBudgetAmountMicroUsd || budgetProfile.hardLimitMicroUsd);
  const runsUntilHardLimit = perRunCost > 0n ? Number(hard / perRunCost) : null;
  return {
    simulationOnly: true,
    period: request.simulatedPeriod,
    perRunKnownCostMicroUsd: microUsdToNumber(perRunCost),
    simulatedHardLimitMicroUsd: microUsdToNumber(hard),
    runsUntilHardLimit,
    runtimeBlocked: false,
    note: 'Budget exhaustion simulation does not enforce production runtime blocking.'
  };
}

function costRecordHash(record) {
  const copy = clone(record);
  delete copy.costRecordHash;
  return sha256(copy);
}

function costGovernanceRunHash(run) {
  const copy = clone(run);
  delete copy.costGovernanceRunHash;
  return sha256(copy);
}

function validateCostGovernanceRun(run) {
  const errors = [];
  if (run.valid === false) errors.push(...(run.validationErrors || []));
  if (run.testOnly !== true || run.productionUseAllowed === true) errors.push(validationError('productionUseAllowed', 'PRODUCTION_COST_GOVERNANCE_PROHIBITED', 'Initial cost governance runs must be test-only.'));
  if (containsSecretLikeValue(run)) errors.push(validationError('run', 'SECRET_LIKE_COST_GOVERNANCE_CONTENT', 'Cost governance output must not contain credentials, tokens, or private URLs.'));
  for (const record of run.costRecords || []) {
    if (record.costRecordHash !== costRecordHash({ ...record, costRecordHash: undefined })) errors.push(validationError('costRecordHash', 'COST_RECORD_HASH_MISMATCH', `Cost record hash mismatch for ${record.costRecordId}.`));
    if (/winner|bestValue|recommendedStrategy|procurementRecommendation|providerRanking|productionRecommendation/.test(stableStringify(record))) errors.push(validationError('costRecord', 'PROHIBITED_RECOMMENDATION_OR_PROCUREMENT_OUTPUT', 'Cost records must not contain winner, best-value, ranking, procurement, or production recommendation output.'));
    if (record.costSummary.unknownComponentCount > 0 && Object.values(record.costMetrics).some((value) => typeof value === 'number' && value < 0)) errors.push(validationError('costMetrics', 'UNKNOWN_COST_USED_NUMERICALLY', 'Unknown cost must not produce invalid numeric cost metrics.'));
    if (record.costMetrics.costPerSafetyCompliantResultMicroUsd !== null && !record.costMetrics.safetyCompliant) errors.push(validationError('costMetrics', 'SAFETY_FAILED_RESULT_COST_EFFECTIVE', 'Safety-failed results cannot appear cost-effective.'));
    if (record.budgetEvaluation.simulatedRuntimeBlock !== false) errors.push(validationError('budgetEvaluation', 'ACTUAL_RUNTIME_BLOCK_PERFORMED', 'Budget blocks must remain simulated only.'));
    const sum = addMicroUsd(record.costComponents.filter((item) => item.amountMicroUsd !== null).map((item) => item.amountMicroUsd)) || 0n;
    if (microUsdToNumber(sum) !== record.costSummary.totalKnownCostMicroUsd) errors.push(validationError('costSummary', 'TOTAL_COST_DOES_NOT_RECONCILE', 'Cost component total must reconcile.'));
  }
  if (run.costGovernanceRunHash !== costGovernanceRunHash({ ...run, costGovernanceRunHash: undefined })) errors.push(validationError('costGovernanceRunHash', 'COST_GOVERNANCE_RUN_HASH_MISMATCH', 'Cost governance run hash must match content.'));
  return { valid: errors.length === 0, errors };
}

function runInitialCostGovernance() {
  return loadCostGovernanceRequests().map((request) => calculateCostGovernanceRun(request));
}

function listCostGovernanceRuns() {
  return runInitialCostGovernance().map((run) => ({ costGovernanceRequestId: run.costGovernanceRequestId, pricingCatalogId: run.pricingCatalogId, costGovernanceRunHash: run.costGovernanceRunHash, testOnly: run.testOnly }));
}

function flattenCostRecords() {
  return runInitialCostGovernance().flatMap((run) => run.costRecords.map((record) => ({ costGovernanceRequestId: run.costGovernanceRequestId, ...record })));
}

function listCostsByCapability(capabilityId) {
  return flattenCostRecords().filter((record) => record.capabilityId === capabilityId);
}

function listCostsByDataset(datasetId) {
  return flattenCostRecords().filter((record) => record.datasetId === datasetId);
}

function listCostsByStrategy(strategy) {
  return flattenCostRecords().filter((record) => record.candidateStrategyId === strategy);
}

function listCostsByExecutor(executorId) {
  return flattenCostRecords().filter((record) => record.candidateExecutorId === executorId);
}

function listUnknownCostRecords() {
  return flattenCostRecords().filter((record) => record.costSummary.unknownComponentCount > 0);
}

function listEstimatedCostRecords() {
  return flattenCostRecords().filter((record) => [COST_STATUSES.ESTIMATED, COST_STATUSES.MODELED, COST_STATUSES.MIXED].includes(record.costSummary.status));
}

function listIncompleteCostRecords() {
  return flattenCostRecords().filter((record) => record.completeness.status !== 'COMPLETE');
}

function listBudgetWarnings() {
  return flattenCostRecords().filter((record) => [BUDGET_STATUSES.WARNING, BUDGET_STATUSES.SOFT_LIMIT_EXCEEDED].includes(record.budgetEvaluation.status));
}

function listSimulatedBlocks() {
  return flattenCostRecords().filter((record) => record.budgetEvaluation.status === BUDGET_STATUSES.SIMULATED_BLOCK);
}

function listPremiumRestrictions() {
  return loadBudgetProfiles().filter((profile) => profile.premiumExecutionAllowed === false || profile.premiumRequiresExplicitApproval === true);
}

function compareCostRuns(left, right) {
  const a = typeof left === 'string' ? calculateCostGovernanceRun(left) : left;
  const b = typeof right === 'string' ? calculateCostGovernanceRun(right) : right;
  return { equal: a.costGovernanceRunHash === b.costGovernanceRunHash, leftHash: a.costGovernanceRunHash, rightHash: b.costGovernanceRunHash };
}

function comparePricingCatalogs(left, right) {
  const a = typeof left === 'string' ? getPricingCatalog(left) : left;
  const b = typeof right === 'string' ? getPricingCatalog(right) : right;
  return { equal: pricingCatalogHash(a) === pricingCatalogHash(b), leftHash: pricingCatalogHash(a), rightHash: pricingCatalogHash(b) };
}

function compareBudgetProfiles(left, right) {
  const a = typeof left === 'string' ? getBudgetProfile(left) : left;
  const b = typeof right === 'string' ? getBudgetProfile(right) : right;
  return { equal: budgetProfileHash(a) === budgetProfileHash(b), leftHash: budgetProfileHash(a), rightHash: budgetProfileHash(b) };
}

function inspectCostTrace(costRecordId) {
  return flattenCostRecords().find((record) => record.costRecordId === costRecordId)?.trace || null;
}

function inspectBudgetTrace(costRecordId) {
  return flattenCostRecords().find((record) => record.costRecordId === costRecordId)?.budgetEvaluation || null;
}

module.exports = {
  COST_GOVERNANCE_ENGINE_VERSION,
  COST_GOVERNANCE_REQUEST_SCHEMA_VERSION,
  PRICING_CATALOG_SCHEMA_VERSION,
  COST_MODEL_PROFILE_SCHEMA_VERSION,
  BUDGET_PROFILE_SCHEMA_VERSION,
  COST_RECORD_SCHEMA_VERSION,
  MICRO_USD_PER_USD,
  COST_SOURCE_CLASSES,
  COST_COMPONENT_TYPES,
  USAGE_UNITS,
  CATALOG_LIFECYCLE_STATES,
  COST_STATUSES,
  BUDGET_STATUSES,
  loadPricingCatalogs,
  loadCostModelProfiles,
  loadBudgetProfiles,
  loadCostGovernanceRequests,
  getPricingCatalog,
  getCostModelProfile,
  getBudgetProfile,
  getCostGovernanceRequest,
  validatePricingCatalog,
  validateCostModelProfile,
  validateBudgetProfile,
  validateCostGovernanceRequest,
  calculateCostGovernanceRun,
  validateCostGovernanceRun,
  runInitialCostGovernance,
  listCostGovernanceRuns,
  listCostsByCapability,
  listCostsByDataset,
  listCostsByStrategy,
  listCostsByExecutor,
  listUnknownCostRecords,
  listEstimatedCostRecords,
  listIncompleteCostRecords,
  listBudgetWarnings,
  listSimulatedBlocks,
  listPremiumRestrictions,
  compareCostRuns,
  comparePricingCatalogs,
  compareBudgetProfiles,
  inspectCostTrace,
  inspectBudgetTrace,
  verifyCostRecordIntegrity: validateCostGovernanceRun,
  verifyDeterministicRecalculation: (requestId) => compareCostRuns(calculateCostGovernanceRun(requestId), calculateCostGovernanceRun(requestId)),
  pricingCatalogHash,
  costModelProfileHash,
  budgetProfileHash,
  requestHash,
  costRecordHash,
  costGovernanceRunHash,
  normalizeMicroUsd,
  microUsdToNumber,
  addMicroUsd,
  multiplyMicroUsd,
  divideMicroUsd,
  microsToUsdString,
  parseUsdToMicros,
  stable,
  stableStringify,
  sha256,
  paths: { backendRoot, repoRoot, costRoot, catalogRoot, modelProfileRoot, budgetProfileRoot, requestRoot }
};
