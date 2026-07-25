const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const enterpriseRegistry = require('./enterpriseCapabilityRegistry');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const backendRoot = path.resolve(__dirname, '..', '..');
const datasetsRoot = path.join(backendRoot, 'benchmarks', 'datasets');

const DATASET_SCHEMA_VERSION = 'benchmark.dataset.schema.v1';
const CASE_SCHEMA_VERSION = 'benchmark.case.schema.v1';
const FIXTURE_FORMAT_VERSION = 'benchmark.fixture.json.v1';
const BENCHMARK_PROTOCOL_VERSION = 'RESERVED_OWNER_DECISION';

const DATASET_LIFECYCLE_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  VALIDATING: 'VALIDATING',
  APPROVED_FOR_TEST: 'APPROVED_FOR_TEST',
  BENCHMARK_READY: 'BENCHMARK_READY',
  FROZEN: 'FROZEN',
  DEPRECATED: 'DEPRECATED',
  RETIRED: 'RETIRED'
});

const DATASET_APPROVAL_STATUSES = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  TECHNICAL_VALIDATION_COMPLETE: 'TECHNICAL_VALIDATION_COMPLETE',
  OWNER_APPROVED: 'OWNER_APPROVED',
  REJECTED: 'REJECTED'
});

const SOURCE_TYPES = Object.freeze({
  SYNTHETIC: 'SYNTHETIC',
  SANITIZED_INTERNAL: 'SANITIZED_INTERNAL',
  ANONYMIZED_INTERNAL: 'ANONYMIZED_INTERNAL',
  PSEUDONYMIZED_INTERNAL: 'PSEUDONYMIZED_INTERNAL',
  APPROVED_REAL_INTERNAL: 'APPROVED_REAL_INTERNAL',
  PUBLIC_OPEN_DATA: 'PUBLIC_OPEN_DATA',
  LICENSED_EXTERNAL: 'LICENSED_EXTERNAL',
  MANUALLY_AUTHORED: 'MANUALLY_AUTHORED',
  DERIVED: 'DERIVED',
  UNKNOWN: 'UNKNOWN'
});

const DATA_CLASSIFICATIONS = Object.freeze({
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
  UNKNOWN: 'UNKNOWN'
});

const ALLOWED_ENVIRONMENTS = Object.freeze({
  LOCAL_TEST: 'LOCAL_TEST',
  CI: 'CI',
  DEVELOPMENT: 'DEVELOPMENT',
  QA: 'QA',
  STAGING: 'STAGING',
  PRODUCTION_BENCHMARK: 'PRODUCTION_BENCHMARK',
  RESTRICTED_REVIEW: 'RESTRICTED_REVIEW'
});

const EVALUATION_TYPES = Object.freeze({
  EXACT_MATCH: 'EXACT_MATCH',
  NORMALIZED_TEXT_MATCH: 'NORMALIZED_TEXT_MATCH',
  STRUCTURED_SCHEMA: 'STRUCTURED_SCHEMA',
  FIELD_LEVEL_ASSERTION: 'FIELD_LEVEL_ASSERTION',
  NUMERICAL_TOLERANCE: 'NUMERICAL_TOLERANCE',
  CLASSIFICATION: 'CLASSIFICATION',
  MULTI_LABEL_CLASSIFICATION: 'MULTI_LABEL_CLASSIFICATION',
  RANKING: 'RANKING',
  ROUTE_CONSTRAINT: 'ROUTE_CONSTRAINT',
  GEOSPATIAL_TOLERANCE: 'GEOSPATIAL_TOLERANCE',
  SAFETY_CONSTRAINT: 'SAFETY_CONSTRAINT',
  POLICY_CONSTRAINT: 'POLICY_CONSTRAINT',
  REFUSAL_EXPECTED: 'REFUSAL_EXPECTED',
  INSUFFICIENT_EVIDENCE_EXPECTED: 'INSUFFICIENT_EVIDENCE_EXPECTED',
  HUMAN_REVIEW_EXPECTED: 'HUMAN_REVIEW_EXPECTED',
  RUBRIC_BASED: 'RUBRIC_BASED',
  REFERENCE_COMPARISON: 'REFERENCE_COMPARISON',
  HYBRID: 'HYBRID'
});

const RISK_TIERS = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN'
});

const DATASET_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)*\.benchmark\.[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const PROVIDER_OR_MODEL_WORDS = /\b(openai|gpt|anthropic|claude|gemini|llama|mistral|cohere)\b/i;
const DISALLOWED_IDENTITY_WORDS = /(^|[._-])(org|organization|customer|employee|driver|route[-_ ]?\d+|invoice|arca|coca[-_ ]?cola|pilot[-_ ]?device)([._-]|$)/i;
const SECRET_PATTERNS = [
  /sk-[a-z0-9]{12,}/i,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i,
  /https:\/\/[^"'\s]+\.r2\.dev\/[^\s"']+/i
];

const TRANSITIONS = Object.freeze({
  [DATASET_LIFECYCLE_STATES.DRAFT]: Object.freeze([DATASET_LIFECYCLE_STATES.VALIDATING, DATASET_LIFECYCLE_STATES.RETIRED]),
  [DATASET_LIFECYCLE_STATES.VALIDATING]: Object.freeze([DATASET_LIFECYCLE_STATES.DRAFT, DATASET_LIFECYCLE_STATES.APPROVED_FOR_TEST, DATASET_LIFECYCLE_STATES.RETIRED]),
  [DATASET_LIFECYCLE_STATES.APPROVED_FOR_TEST]: Object.freeze([DATASET_LIFECYCLE_STATES.VALIDATING, DATASET_LIFECYCLE_STATES.BENCHMARK_READY, DATASET_LIFECYCLE_STATES.DEPRECATED, DATASET_LIFECYCLE_STATES.RETIRED]),
  [DATASET_LIFECYCLE_STATES.BENCHMARK_READY]: Object.freeze([DATASET_LIFECYCLE_STATES.FROZEN, DATASET_LIFECYCLE_STATES.DEPRECATED]),
  [DATASET_LIFECYCLE_STATES.FROZEN]: Object.freeze([DATASET_LIFECYCLE_STATES.DEPRECATED]),
  [DATASET_LIFECYCLE_STATES.DEPRECATED]: Object.freeze([DATASET_LIFECYCLE_STATES.RETIRED]),
  [DATASET_LIFECYCLE_STATES.RETIRED]: Object.freeze([])
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

function stripIntegrityHashes(value) {
  if (Array.isArray(value)) return value.map(stripIntegrityHashes);
  if (value && typeof value === 'object') {
    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '__filePath') continue;
      if (key === 'integrity' && child && typeof child === 'object') {
        const integrity = { ...child };
        delete integrity.contentHash;
        delete integrity.manifestHash;
        delete integrity.generatedArtifactsCurrent;
        clone[key] = stripIntegrityHashes(integrity);
      } else {
        clone[key] = stripIntegrityHashes(child);
      }
    }
    return clone;
  }
  return value;
}

function semanticDatasetPayload(dataset) {
  return stripIntegrityHashes(JSON.parse(JSON.stringify(dataset)));
}

function computeCaseHash(testCase) {
  const clone = JSON.parse(JSON.stringify(testCase));
  delete clone.integrity;
  delete clone.caseId;
  return sha256(clone);
}

function computeManifestHash(dataset) {
  return sha256(semanticDatasetPayload(dataset));
}

function validationError(dataset, field, rule, guidance, testCase = null) {
  return {
    datasetId: dataset?.datasetId || null,
    datasetVersion: dataset?.version || null,
    caseId: testCase?.caseId || null,
    field,
    rule,
    guidance
  };
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJsonFiles(fullPath));
    else if (entry.isFile() && entry.name === 'dataset.json') files.push(fullPath);
  }
  return files;
}

function loadDatasets(root = datasetsRoot) {
  return walkJsonFiles(root).map((filePath) => {
    const dataset = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    Object.defineProperty(dataset, '__filePath', { value: filePath, enumerable: false });
    return dataset;
  }).sort((a, b) => `${a.datasetId}@${a.version}`.localeCompare(`${b.datasetId}@${b.version}`));
}

function validateDatasetId(datasetId) {
  if (!datasetId || !DATASET_ID_PATTERN.test(datasetId)) return { field: 'datasetId', rule: 'INVALID_DATASET_ID', guidance: 'Use <capability-id>.benchmark.<purpose> with lowercase machine-readable segments.' };
  if (PROVIDER_OR_MODEL_WORDS.test(datasetId)) return { field: 'datasetId', rule: 'PROVIDER_OR_MODEL_IN_DATASET_ID', guidance: 'Dataset IDs must not contain provider or model names.' };
  if (DISALLOWED_IDENTITY_WORDS.test(datasetId)) return { field: 'datasetId', rule: 'PRODUCTION_IDENTITY_IN_DATASET_ID', guidance: 'Dataset IDs must not contain Organization, customer, employee, driver, invoice, or production route identifiers.' };
  return null;
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function assertArrayValues(dataset, field, values, allowed, errors) {
  if (!Array.isArray(values)) {
    errors.push(validationError(dataset, field, 'MISSING_ARRAY_FIELD', 'Use an explicit array, even when empty.'));
    return;
  }
  for (const value of values) {
    if (!Object.values(allowed).includes(value)) {
      errors.push(validationError(dataset, field, 'INVALID_ENUM_VALUE', `Use one of: ${Object.values(allowed).join(', ')}.`));
    }
  }
}

function validateDatasetShape(dataset, allDatasets, errors) {
  for (const field of ['datasetId', 'displayName', 'description', 'datasetFamily', 'version', 'schemaVersion', 'fixtureFormatVersion', 'capabilityId', 'inputSchemaId', 'outputSchemaId', 'lifecycleState', 'approvalStatus', 'qualityStatus', 'freshnessStatus', 'benchmarkPurpose', 'evaluationType', 'sourceType', 'sourceDescription', 'provenanceStatus', 'dataClassification']) {
    if (dataset[field] === undefined || dataset[field] === null || dataset[field] === '') {
      errors.push(validationError(dataset, field, 'MISSING_REQUIRED_FIELD', 'Provide an explicit value or UNKNOWN/null where the contract allows it.'));
    }
  }

  const idError = validateDatasetId(dataset.datasetId);
  if (idError) errors.push(validationError(dataset, idError.field, idError.rule, idError.guidance));
  if (!VERSION_PATTERN.test(dataset.version || '')) errors.push(validationError(dataset, 'version', 'INVALID_VERSION', 'Use semantic versioning such as 0.1.0.'));
  if (dataset.schemaVersion !== DATASET_SCHEMA_VERSION) errors.push(validationError(dataset, 'schemaVersion', 'INVALID_SCHEMA_VERSION', `Use ${DATASET_SCHEMA_VERSION}.`));
  if (dataset.fixtureFormatVersion !== FIXTURE_FORMAT_VERSION) errors.push(validationError(dataset, 'fixtureFormatVersion', 'INVALID_FIXTURE_FORMAT_VERSION', `Use ${FIXTURE_FORMAT_VERSION}.`));
  if (!Object.values(DATASET_LIFECYCLE_STATES).includes(dataset.lifecycleState)) errors.push(validationError(dataset, 'lifecycleState', 'INVALID_ENUM_VALUE', 'Use a controlled dataset lifecycle state.'));
  if (!Object.values(DATASET_APPROVAL_STATUSES).includes(dataset.approvalStatus)) errors.push(validationError(dataset, 'approvalStatus', 'INVALID_ENUM_VALUE', 'Use a controlled approval state.'));
  if (!Object.values(SOURCE_TYPES).includes(dataset.sourceType)) errors.push(validationError(dataset, 'sourceType', 'INVALID_ENUM_VALUE', 'Use a controlled source type.'));
  if (!Object.values(DATA_CLASSIFICATIONS).includes(dataset.dataClassification)) errors.push(validationError(dataset, 'dataClassification', 'INVALID_ENUM_VALUE', 'Use a controlled data classification.'));
  assertArrayValues(dataset, 'evaluationType', dataset.evaluationType, EVALUATION_TYPES, errors);
  assertArrayValues(dataset, 'allowedEnvironments', dataset.allowedEnvironments, ALLOWED_ENVIRONMENTS, errors);

  const capability = enterpriseRegistry.getEnterpriseCapability(dataset.capabilityId);
  if (!capability) {
    errors.push(validationError(dataset, 'capabilityId', 'UNKNOWN_CAPABILITY_ID', 'Reference a capability from enterpriseCapabilityRegistry.js.'));
  } else {
    if (!Array.isArray(dataset.supportedCapabilityVersions) || !dataset.supportedCapabilityVersions.includes(capability.capabilityVersion)) {
      errors.push(validationError(dataset, 'supportedCapabilityVersions', 'UNSUPPORTED_CAPABILITY_VERSION', `Include ${capability.capabilityVersion}.`));
    }
    if (dataset.inputSchemaId !== capability.inputSchemaId) errors.push(validationError(dataset, 'inputSchemaId', 'INCOMPATIBLE_INPUT_SCHEMA_ID', `Use ${capability.inputSchemaId}.`));
    if (dataset.outputSchemaId !== capability.outputSchemaId) errors.push(validationError(dataset, 'outputSchemaId', 'INCOMPATIBLE_OUTPUT_SCHEMA_ID', `Use ${capability.outputSchemaId}.`));
    if (capability.lifecycleState === enterpriseRegistry.LIFECYCLE_STATES.RETIRED && !dataset.historicalReason) {
      errors.push(validationError(dataset, 'capabilityId', 'RETIRED_CAPABILITY_WITHOUT_HISTORICAL_REASON', 'Retired capability datasets require explicit historical justification.'));
    }
  }

  if (dataset.enabled === true && dataset.lifecycleState === DATASET_LIFECYCLE_STATES.RETIRED) errors.push(validationError(dataset, 'enabled', 'RETIRED_DATASET_ENABLED', 'Retired datasets must be disabled.'));
  if (dataset.lifecycleState === DATASET_LIFECYCLE_STATES.BENCHMARK_READY && dataset.approvalStatus !== DATASET_APPROVAL_STATUSES.OWNER_APPROVED) errors.push(validationError(dataset, 'approvalStatus', 'BENCHMARK_READY_REQUIRES_OWNER_APPROVAL', 'Owner approval evidence is required before benchmark readiness.'));
  if (dataset.lifecycleState === DATASET_LIFECYCLE_STATES.FROZEN && (!dataset.integrity?.contentHash || !dataset.integrity?.manifestHash || dataset.integrity?.immutableWhenFrozen !== true)) errors.push(validationError(dataset, 'integrity', 'FROZEN_REQUIRES_INTEGRITY_METADATA', 'Frozen datasets require immutable integrity metadata.'));
  if (dataset.replacementDatasetId && dataset.replacementDatasetId === dataset.datasetId) errors.push(validationError(dataset, 'replacementDatasetId', 'SELF_REPLACEMENT', 'Replacement dataset must be a different dataset ID.'));
  if (dataset.replacementDatasetId && !allDatasets.some((item) => item.datasetId === dataset.replacementDatasetId)) errors.push(validationError(dataset, 'replacementDatasetId', 'UNKNOWN_REPLACEMENT_DATASET', 'Replacement dataset must exist in the authoritative dataset source.'));
  if (dataset.claimsCapabilityActivation === true) errors.push(validationError(dataset, 'claimsCapabilityActivation', 'DATASET_CLAIMS_CAPABILITY_ACTIVATION', 'Dataset presence must not activate runtime capability behavior.'));
}

function validatePrivacyAndProvenance(dataset, errors) {
  if (dataset.productionDataUsed === true && dataset.approvedRealDataUse !== true) errors.push(validationError(dataset, 'productionDataUsed', 'PRODUCTION_DATA_REQUIRES_APPROVAL', 'Production data is prohibited in this phase and requires future explicit approval.'));
  if (dataset.approvedRealDataUse === true && (!dataset.approvedBy || !dataset.approvedAt || !dataset.decisionRecordId)) errors.push(validationError(dataset, 'approvedRealDataUse', 'REAL_DATA_APPROVAL_EVIDENCE_REQUIRED', 'Approved real data requires approver, timestamp, and decision record.'));
  if (dataset.containsPersonalData === true && dataset.dataClassification === DATA_CLASSIFICATIONS.PUBLIC) errors.push(validationError(dataset, 'dataClassification', 'PERSONAL_DATA_CANNOT_BE_PUBLIC', 'Personal data cannot be classified PUBLIC.'));
  if (dataset.containsPreciseLocationData === true && dataset.allowedEnvironments?.includes(ALLOWED_ENVIRONMENTS.CI) && dataset.approvalStatus !== DATASET_APPROVAL_STATUSES.OWNER_APPROVED) errors.push(validationError(dataset, 'allowedEnvironments', 'PRECISE_LOCATION_CI_REQUIRES_APPROVAL', 'Precise location fixtures require explicit approval for unrestricted CI use.'));
  if (dataset.containsEmployeeData === true && dataset.allowedEnvironments?.includes(ALLOWED_ENVIRONMENTS.CI) && dataset.approvalStatus !== DATASET_APPROVAL_STATUSES.OWNER_APPROVED) errors.push(validationError(dataset, 'allowedEnvironments', 'EMPLOYEE_DATA_CI_REQUIRES_APPROVAL', 'Employee data fixtures require explicit approval for CI.'));
  if (dataset.sanitizedData === true && (!dataset.sanitizationMetadata || dataset.sanitizationMetadata.reviewStatus !== 'REVIEWED')) errors.push(validationError(dataset, 'sanitizationMetadata', 'SANITIZED_DATA_REQUIRES_METADATA', 'Sanitized data requires reviewed sanitization metadata.'));
  if (dataset.anonymizedData === true && !dataset.reidentificationRiskAssessment) errors.push(validationError(dataset, 'reidentificationRiskAssessment', 'ANONYMIZED_DATA_REQUIRES_REIDENTIFICATION_ASSESSMENT', 'Do not claim anonymization without reidentification-risk assessment.'));
  if (dataset.pseudonymizedData === true && dataset.anonymizedData === true) errors.push(validationError(dataset, 'anonymizedData', 'PSEUDONYMIZED_IS_NOT_ANONYMIZED', 'Pseudonymized data must not be labeled anonymized.'));
  if (dataset.sourceType === SOURCE_TYPES.SYNTHETIC && !dataset.syntheticDataMetadata) errors.push(validationError(dataset, 'syntheticDataMetadata', 'SYNTHETIC_DATA_REQUIRES_GENERATION_METADATA', 'Synthetic data requires generator metadata.'));
  if (dataset.sourceType === SOURCE_TYPES.PUBLIC_OPEN_DATA && (!dataset.sourceReferences || dataset.sourceReferences.length === 0)) errors.push(validationError(dataset, 'sourceReferences', 'PUBLIC_SOURCE_REQUIRES_REFERENCE', 'Public-source datasets require source references.'));
  if (dataset.sourceType === SOURCE_TYPES.LICENSED_EXTERNAL && !dataset.sourceLicense) errors.push(validationError(dataset, 'sourceLicense', 'LICENSED_SOURCE_REQUIRES_LICENSE', 'Licensed external data requires license metadata.'));
  if (dataset.sourceType === SOURCE_TYPES.DERIVED && (!dataset.upstreamSources || dataset.upstreamSources.length === 0)) errors.push(validationError(dataset, 'upstreamSources', 'DERIVED_SOURCE_REQUIRES_UPSTREAM_PROVENANCE', 'Derived datasets require upstream source references.'));
  if ([DATASET_LIFECYCLE_STATES.BENCHMARK_READY, DATASET_LIFECYCLE_STATES.FROZEN].includes(dataset.lifecycleState) && dataset.sourceType === SOURCE_TYPES.UNKNOWN) errors.push(validationError(dataset, 'sourceType', 'READY_DATASET_CANNOT_HAVE_UNKNOWN_SOURCE', 'Benchmark-ready datasets require known source classification.'));
  if (dataset.allowedEnvironments?.includes(ALLOWED_ENVIRONMENTS.PRODUCTION_BENCHMARK) && dataset.approvalStatus !== DATASET_APPROVAL_STATUSES.OWNER_APPROVED) errors.push(validationError(dataset, 'allowedEnvironments', 'PRODUCTION_BENCHMARK_REQUIRES_OWNER_APPROVAL', 'Production benchmark use requires owner approval metadata.'));
  if (containsSecretLikeValue(dataset)) errors.push(validationError(dataset, 'dataset', 'SECRET_LIKE_FIXTURE_CONTENT', 'Remove credentials, tokens, private URLs, and secret-like values from fixtures.'));
}

function validateCase(dataset, testCase, errors) {
  for (const field of ['caseId', 'datasetId', 'caseVersion', 'displayName', 'description', 'capabilityId', 'requestPayload', 'expectedResultType', 'assertions', 'canonicalFacts', 'lifecycleState']) {
    if (testCase[field] === undefined || testCase[field] === null || testCase[field] === '') {
      errors.push(validationError(dataset, field, 'MISSING_REQUIRED_CASE_FIELD', 'Provide the required benchmark case field.', testCase));
    }
  }
  if (testCase.datasetId !== dataset.datasetId) errors.push(validationError(dataset, 'datasetId', 'CASE_DATASET_MISMATCH', 'Case datasetId must match parent dataset.', testCase));
  if (testCase.capabilityId !== dataset.capabilityId) errors.push(validationError(dataset, 'capabilityId', 'CASE_CAPABILITY_MISMATCH', 'Case capabilityId must match parent dataset capabilityId.', testCase));
  if (!VERSION_PATTERN.test(testCase.caseVersion || '')) errors.push(validationError(dataset, 'caseVersion', 'INVALID_CASE_VERSION', 'Use semantic versioning such as 0.1.0.', testCase));
  if (!Object.values(DATASET_LIFECYCLE_STATES).includes(testCase.lifecycleState)) errors.push(validationError(dataset, 'lifecycleState', 'INVALID_CASE_LIFECYCLE', 'Use a controlled dataset lifecycle state.', testCase));
  if (!Array.isArray(testCase.evaluationTypes) || testCase.evaluationTypes.length === 0) errors.push(validationError(dataset, 'evaluationTypes', 'CASE_EVALUATION_TYPES_REQUIRED', 'Cases require at least one evaluation type.', testCase));
  else assertArrayValues(dataset, 'evaluationTypes', testCase.evaluationTypes, EVALUATION_TYPES, errors);
  if (testCase.evaluationTypes?.includes(EVALUATION_TYPES.EXACT_MATCH) && testCase.exactExpectedOutput === undefined) errors.push(validationError(dataset, 'exactExpectedOutput', 'EXACT_MATCH_REQUIRES_EXPECTED_OUTPUT', 'Exact-match cases require exactExpectedOutput.', testCase));
  if (testCase.evaluationTypes?.includes(EVALUATION_TYPES.NUMERICAL_TOLERANCE) && (!testCase.expectedNumericalValues || testCase.expectedNumericalValues.length === 0)) errors.push(validationError(dataset, 'expectedNumericalValues', 'NUMERICAL_TOLERANCE_REQUIRES_TARGET', 'Numerical tolerance cases require target and tolerance values.', testCase));
  if (testCase.evaluationTypes?.includes(EVALUATION_TYPES.ROUTE_CONSTRAINT) && (!testCase.expectedRouteProperties || Object.keys(testCase.expectedRouteProperties).length === 0)) errors.push(validationError(dataset, 'expectedRouteProperties', 'ROUTE_CONSTRAINT_REQUIRES_ROUTE_ASSERTIONS', 'Route constraint cases require route assertions.', testCase));
  if (testCase.expectedRefusal === true && !testCase.assertions?.refusalAssertion) errors.push(validationError(dataset, 'assertions.refusalAssertion', 'REFUSAL_EXPECTED_REQUIRES_REFUSAL_ASSERTION', 'Expected refusal cases require refusal assertions.', testCase));
  if (testCase.expectedHumanReview === true && testCase.humanReviewProhibited === true) errors.push(validationError(dataset, 'expectedHumanReview', 'HUMAN_REVIEW_EXPECTED_WHILE_PROHIBITED', 'Human review cannot be both expected and prohibited.', testCase));
  if (testCase.safetyImpact && testCase.safetyImpact !== 'NONE' && (!testCase.assertions?.safetyAssertions || testCase.assertions.safetyAssertions.length === 0)) errors.push(validationError(dataset, 'assertions.safetyAssertions', 'SAFETY_CRITICAL_REQUIRES_SAFETY_ASSERTIONS', 'Safety-impacting cases require explicit safety assertions.', testCase));
  if (testCase.employmentImpact && testCase.employmentImpact !== 'NONE' && (!testCase.assertions?.policyAssertions || !testCase.assertions.policyAssertions.includes('advisory_only'))) errors.push(validationError(dataset, 'assertions.policyAssertions', 'EMPLOYMENT_IMPACT_REQUIRES_ADVISORY_LIMITATION', 'Employment-impacting cases require advisory-only policy assertion.', testCase));
  if (Array.isArray(testCase.canonicalFacts) && testCase.canonicalFacts.length > 0 && (!testCase.minimumEvidenceRequirements || testCase.minimumEvidenceRequirements.length === 0)) errors.push(validationError(dataset, 'minimumEvidenceRequirements', 'CANONICAL_FACTS_REQUIRE_AUTHORITATIVE_REFERENCE', 'Canonical facts require authoritative evidence references.', testCase));
  if (testCase.assertions?.inclusionAssertions?.some((item) => testCase.assertions?.exclusionAssertions?.includes(item))) errors.push(validationError(dataset, 'assertions', 'CONTRADICTORY_ASSERTIONS', 'The same assertion cannot be both required and prohibited.', testCase));
  if (testCase.benchmarkEligible === true && dataset.lifecycleState !== DATASET_LIFECYCLE_STATES.BENCHMARK_READY && dataset.lifecycleState !== DATASET_LIFECYCLE_STATES.FROZEN) errors.push(validationError(dataset, 'benchmarkEligible', 'CASE_BENCHMARK_ELIGIBLE_BEFORE_DATASET_READY', 'Cases cannot be benchmark eligible before the dataset is benchmark-ready or frozen.', testCase));
  if (testCase.testOnly === true && dataset.allowedEnvironments?.includes(ALLOWED_ENVIRONMENTS.PRODUCTION_BENCHMARK)) errors.push(validationError(dataset, 'testOnly', 'TEST_ONLY_WITH_PRODUCTION_BENCHMARK_ENVIRONMENT', 'Test-only cases cannot be allowed in production benchmark environments.', testCase));
  if (containsSecretLikeValue(testCase)) errors.push(validationError(dataset, 'case', 'SECRET_LIKE_FIXTURE_CONTENT', 'Remove credentials, tokens, private URLs, and secret-like values from fixtures.', testCase));
}

function validateDatasets(datasets = loadDatasets()) {
  const errors = [];
  const keySet = new Set();
  const aliasSet = new Set();
  const contentHashes = new Map();
  for (const dataset of datasets) {
    const key = `${dataset.datasetId}@${dataset.version}`;
    if (keySet.has(key)) errors.push(validationError(dataset, 'datasetId', 'DUPLICATE_DATASET_ID_VERSION', 'Dataset ID and version pair must be unique.'));
    keySet.add(key);
    for (const alias of dataset.aliases || []) {
      if (aliasSet.has(alias) || datasets.some((item) => item.datasetId === alias)) errors.push(validationError(dataset, 'aliases', 'ALIAS_COLLISION', 'Aliases must not collide with dataset IDs or other aliases.'));
      aliasSet.add(alias);
    }
    validateDatasetShape(dataset, datasets, errors);
    validatePrivacyAndProvenance(dataset, errors);
    const cases = dataset.cases || [];
    if (!Array.isArray(cases)) errors.push(validationError(dataset, 'cases', 'CASES_MUST_BE_ARRAY', 'Cases must be stored as a deterministic array.'));
    if (dataset.caseCount !== cases.length) errors.push(validationError(dataset, 'caseCount', 'CASE_COUNT_MISMATCH', 'caseCount must equal the number of cases.'));
    const caseIds = new Set();
    for (const testCase of cases) {
      if (caseIds.has(testCase.caseId)) errors.push(validationError(dataset, 'caseId', 'DUPLICATE_CASE_ID', 'Case IDs must be unique within a dataset.', testCase));
      caseIds.add(testCase.caseId);
      validateCase(dataset, testCase, errors);
      const hash = computeCaseHash(testCase);
      if (testCase.integrity?.contentHash && testCase.integrity.contentHash !== hash) errors.push(validationError(dataset, 'integrity.contentHash', 'MISMATCHED_CASE_HASH', 'Case content hash must match semantic case content.', testCase));
      if (contentHashes.has(hash)) errors.push(validationError(dataset, 'case', 'DUPLICATE_CASE_CONTENT_HASH', `Duplicate case content hash also appears in ${contentHashes.get(hash)}.`, testCase));
      contentHashes.set(hash, `${dataset.datasetId}/${testCase.caseId}`);
    }
    if ((dataset.integrity?.caseCountVerified ?? null) !== cases.length) errors.push(validationError(dataset, 'integrity.caseCountVerified', 'FIXTURE_COUNT_NOT_VERIFIED', 'integrity.caseCountVerified must equal the case count.'));
    const manifestHash = computeManifestHash(dataset);
    if (dataset.integrity?.manifestHash && dataset.integrity.manifestHash !== manifestHash) errors.push(validationError(dataset, 'integrity.manifestHash', 'MISMATCHED_MANIFEST_HASH', 'Dataset manifest hash must match semantic dataset content.'));
    if (dataset.integrity?.contentHash && dataset.integrity.contentHash !== manifestHash) errors.push(validationError(dataset, 'integrity.contentHash', 'MISMATCHED_CONTENT_HASH', 'Dataset content hash must match semantic dataset content.'));
  }
  return { valid: errors.length === 0, errors };
}

function resolveDatasetAlias(alias, datasets = loadDatasets()) {
  const direct = datasets.find((dataset) => dataset.datasetId === alias);
  if (direct) return direct.datasetId;
  const match = datasets.find((dataset) => Array.isArray(dataset.aliases) && dataset.aliases.includes(alias));
  return match ? match.datasetId : null;
}

function listDatasets(datasets = loadDatasets()) {
  return datasets.slice().sort((a, b) => `${a.datasetId}@${a.version}`.localeCompare(`${b.datasetId}@${b.version}`));
}

function getDataset(datasetId, version = null, datasets = loadDatasets()) {
  const resolved = resolveDatasetAlias(datasetId, datasets) || datasetId;
  const candidates = datasets.filter((dataset) => dataset.datasetId === resolved);
  if (!version) return candidates.sort((a, b) => b.version.localeCompare(a.version))[0] || null;
  return candidates.find((dataset) => dataset.version === version) || null;
}

function listVersions(datasetId, datasets = loadDatasets()) {
  const resolved = resolveDatasetAlias(datasetId, datasets) || datasetId;
  return datasets.filter((dataset) => dataset.datasetId === resolved).map((dataset) => dataset.version).sort();
}

function getBenchmarkCases(datasetId, version = null, datasets = loadDatasets()) {
  return (getDataset(datasetId, version, datasets)?.cases || []).slice();
}

function getEnabledBenchmarkCases(datasetId, version = null, datasets = loadDatasets()) {
  return getBenchmarkCases(datasetId, version, datasets).filter((testCase) => testCase.enabled !== false);
}

function filterDatasets(predicate, datasets = loadDatasets()) {
  return listDatasets(datasets).filter(predicate);
}

function listByCapability(capabilityId, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.capabilityId === capabilityId, datasets); }
function listByLifecycle(lifecycleState, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.lifecycleState === lifecycleState, datasets); }
function listBySourceType(sourceType, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.sourceType === sourceType, datasets); }
function listByDataClassification(dataClassification, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.dataClassification === dataClassification, datasets); }
function listBenchmarkReady(datasets = loadDatasets()) { return listByLifecycle(DATASET_LIFECYCLE_STATES.BENCHMARK_READY, datasets); }
function listFrozen(datasets = loadDatasets()) { return listByLifecycle(DATASET_LIFECYCLE_STATES.FROZEN, datasets); }
function listRequiringApproval(datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.ownerDecisionRequired === true || dataset.approvalStatus === DATASET_APPROVAL_STATUSES.PENDING || dataset.approvalStatus === DATASET_APPROVAL_STATUSES.UNKNOWN, datasets); }
function listContainingSensitiveCategories(datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.containsSensitivePersonalData || dataset.containsEmployeeData || dataset.containsCustomerData || dataset.containsPreciseLocationData || dataset.containsOrganizationConfidentialData, datasets); }
function listAllowedInEnvironment(environment, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.allowedEnvironments?.includes(environment), datasets); }
function listByEvaluationType(evaluationType, datasets = loadDatasets()) { return filterDatasets((dataset) => dataset.evaluationType?.includes(evaluationType), datasets); }

function summarizeCoverage(datasets = loadDatasets()) {
  const reports = listDatasets(datasets).map((dataset) => {
    const covered = new Set(dataset.coveredScenarioCategories || []);
    const required = new Set(dataset.requiredScenarioCategories || []);
    const missing = [...required].filter((category) => !covered.has(category)).sort();
    const countByCategory = {};
    const riskTierCoverage = {};
    const evaluationTypeCoverage = {};
    const capabilityVersionCoverage = {};
    for (const testCase of dataset.cases || []) {
      for (const category of testCase.coverageCategories || []) countByCategory[category] = (countByCategory[category] || 0) + 1;
      riskTierCoverage[testCase.riskTier || RISK_TIERS.UNKNOWN] = (riskTierCoverage[testCase.riskTier || RISK_TIERS.UNKNOWN] || 0) + 1;
      for (const evaluationType of testCase.evaluationTypes || []) evaluationTypeCoverage[evaluationType] = (evaluationTypeCoverage[evaluationType] || 0) + 1;
      for (const version of dataset.supportedCapabilityVersions || []) capabilityVersionCoverage[version] = (capabilityVersionCoverage[version] || 0) + 1;
    }
    return {
      datasetId: dataset.datasetId,
      version: dataset.version,
      capabilityId: dataset.capabilityId,
      requiredScenarioCategories: [...required].sort(),
      coveredScenarioCategories: [...covered].sort(),
      missingScenarioCategories: missing,
      caseCountsByCategory: stable(countByCategory),
      riskTierCoverage: stable(riskTierCoverage),
      evaluationTypeCoverage: stable(evaluationTypeCoverage),
      capabilityVersionCoverage: stable(capabilityVersionCoverage),
      thresholdDecision: 'OWNER_DECISION_REQUIRED'
    };
  });
  return { generatedFrom: 'bridge-api/benchmarks/datasets', generatedArtifact: true, reports };
}

function listWithMissingCoverage(datasets = loadDatasets()) {
  return summarizeCoverage(datasets).reports.filter((report) => report.missingScenarioCategories.length > 0);
}

function verifyReplacementLinks(datasets = loadDatasets()) {
  return validateDatasets(datasets).errors.filter((error) => error.rule.includes('REPLACEMENT'));
}

function verifyCapabilityCompatibility(datasets = loadDatasets()) {
  return validateDatasets(datasets).errors.filter((error) => error.rule.includes('CAPABILITY') || error.rule.includes('SCHEMA'));
}

function validateLifecycleTransition(fromState, toState, evidence = {}) {
  const allowedTargets = TRANSITIONS[fromState] || [];
  const result = {
    fromState,
    toState,
    allowed: false,
    conditionallyAllowed: false,
    prohibited: !allowedTargets.includes(toState),
    ownerApprovalRequired: false,
    governanceApprovalRequired: false,
    privacyReviewRequired: false,
    provenanceReviewRequired: false,
    qualityReviewRequired: false,
    integrityFreezeRequired: false,
    benchmarkProtocolCompatibilityRequired: false,
    rollbackOrSupersessionPlanRequired: false,
    missingEvidence: []
  };
  if (result.prohibited) return result;
  const requirements = [];
  if (toState === DATASET_LIFECYCLE_STATES.BENCHMARK_READY) {
    requirements.push('schemaValidation', 'caseValidation', 'sourceClassification', 'provenanceComplete', 'privacyReview', 'qualityReview', 'capabilityCompatibility', 'coverageMetadata', 'approvalMetadata', 'integrityHashes');
    result.ownerApprovalRequired = true;
    result.governanceApprovalRequired = true;
    result.privacyReviewRequired = true;
    result.provenanceReviewRequired = true;
    result.qualityReviewRequired = true;
  }
  if (toState === DATASET_LIFECYCLE_STATES.FROZEN) {
    requirements.push('immutableVersion', 'deterministicGeneration', 'manifestHash', 'generatedCatalogFresh', 'decisionRecordReference', 'approvalEvidence', 'supersessionRules');
    result.integrityFreezeRequired = true;
    result.benchmarkProtocolCompatibilityRequired = true;
    result.rollbackOrSupersessionPlanRequired = true;
  }
  result.missingEvidence = requirements.filter((item) => evidence[item] !== true);
  result.allowed = result.missingEvidence.length === 0;
  result.conditionallyAllowed = !result.allowed;
  result.prohibited = false;
  return result;
}

module.exports = {
  ALLOWED_ENVIRONMENTS,
  BENCHMARK_PROTOCOL_VERSION,
  CASE_SCHEMA_VERSION,
  DATASET_APPROVAL_STATUSES,
  DATASET_ID_PATTERN,
  DATASET_LIFECYCLE_STATES,
  DATASET_SCHEMA_VERSION,
  DATA_CLASSIFICATIONS,
  EVALUATION_TYPES,
  FIXTURE_FORMAT_VERSION,
  RISK_TIERS,
  SOURCE_TYPES,
  TRANSITIONS,
  backendRoot,
  computeCaseHash,
  computeManifestHash,
  datasetsRoot,
  getBenchmarkCases,
  getDataset,
  getEnabledBenchmarkCases,
  listAllowedInEnvironment,
  listBenchmarkReady,
  listByCapability,
  listByDataClassification,
  listByEvaluationType,
  listByLifecycle,
  listBySourceType,
  listDatasets,
  listFrozen,
  listRequiringApproval,
  listContainingSensitiveCategories,
  listVersions,
  listWithMissingCoverage,
  loadDatasets,
  repoRoot,
  resolveDatasetAlias,
  sha256,
  stripIntegrityHashes,
  stable,
  stableStringify,
  summarizeCoverage,
  validateDatasetId,
  validateDatasets,
  validateLifecycleTransition,
  verifyCapabilityCompatibility,
  verifyReplacementLinks
};
