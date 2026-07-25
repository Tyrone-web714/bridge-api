#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const framework = require('../services/intelligenceExecution/benchmarkDatasetFramework');
const enterpriseRegistry = require('../services/intelligenceExecution/enterpriseCapabilityRegistry');
const { generate } = require('./generate-benchmark-dataset-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'benchmark-dataset-framework', 'generated');

function cloneDatasets(mutate) {
  const clone = JSON.parse(JSON.stringify(framework.listDatasets()));
  mutate(clone);
  return clone;
}

function expectInvalid(rule, mutate) {
  const result = framework.validateDatasets(cloneDatasets(mutate));
  assert.strictEqual(result.valid, false, `expected invalid dataset for ${rule}`);
  assert.ok(result.errors.some((error) => error.rule === rule), `expected ${rule}, got ${result.errors.map((error) => error.rule).join(', ')}`);
}

function readGenerated() {
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function main() {
  const datasets = framework.listDatasets();
  const validation = framework.validateDatasets(datasets);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));

  assert.strictEqual(framework.DATASET_SCHEMA_VERSION, 'benchmark.dataset.schema.v1');
  assert.strictEqual(framework.CASE_SCHEMA_VERSION, 'benchmark.case.schema.v1');
  assert.strictEqual(framework.FIXTURE_FORMAT_VERSION, 'benchmark.fixture.json.v1');

  assert.deepStrictEqual(datasets.map((dataset) => dataset.datasetId).sort(), [
    'legacy.ai.structured_response.benchmark.schema_compliance',
    'supervisor.daily_operations_report.benchmark.safety_language',
    'text.cleanup.benchmark.core'
  ].sort());
  assert.strictEqual(new Set(datasets.map((dataset) => `${dataset.datasetId}@${dataset.version}`)).size, datasets.length);
  assert.strictEqual(framework.validateDatasetId('text.cleanup.benchmark.core'), null);
  assert.strictEqual(framework.validateDatasetId('text.cleanup.benchmark.gpt').rule, 'PROVIDER_OR_MODEL_IN_DATASET_ID');
  assert.strictEqual(framework.validateDatasetId('text.cleanup.benchmark.customer_alpha').rule, 'PRODUCTION_IDENTITY_IN_DATASET_ID');

  for (const dataset of datasets) {
    const capability = enterpriseRegistry.getEnterpriseCapability(dataset.capabilityId);
    assert.ok(capability, `${dataset.datasetId} must reference a known capability`);
    assert.ok(dataset.supportedCapabilityVersions.includes(capability.capabilityVersion), `${dataset.datasetId} must support ${capability.capabilityVersion}`);
    assert.strictEqual(dataset.inputSchemaId, capability.inputSchemaId);
    assert.strictEqual(dataset.outputSchemaId, capability.outputSchemaId);
    assert.strictEqual(dataset.productionDataUsed, false);
    assert.strictEqual(dataset.approvedRealDataUse, false);
    assert.ok(!dataset.allowedEnvironments.includes(framework.ALLOWED_ENVIRONMENTS.PRODUCTION_BENCHMARK));
  }

  assert.strictEqual(framework.getDataset('text.cleanup.benchmark.core').version, '0.1.0');
  assert.strictEqual(framework.getDataset('text.cleanup.core').datasetId, 'text.cleanup.benchmark.core');
  assert.deepStrictEqual(framework.listVersions('text.cleanup.benchmark.core'), ['0.1.0']);
  assert.strictEqual(framework.listByCapability('text.cleanup').length, 1);
  assert.strictEqual(framework.listByLifecycle(framework.DATASET_LIFECYCLE_STATES.APPROVED_FOR_TEST).length, 3);
  assert.strictEqual(framework.listBySourceType(framework.SOURCE_TYPES.SYNTHETIC).length, 3);
  assert.strictEqual(framework.listByDataClassification(framework.DATA_CLASSIFICATIONS.INTERNAL).length, 3);
  assert.strictEqual(framework.listBenchmarkReady().length, 0);
  assert.strictEqual(framework.listFrozen().length, 0);
  assert.strictEqual(framework.listRequiringApproval().length, 3);
  assert.strictEqual(framework.listContainingSensitiveCategories().length, 0);
  assert.strictEqual(framework.listAllowedInEnvironment(framework.ALLOWED_ENVIRONMENTS.CI).length, 3);
  assert.ok(framework.listByEvaluationType(framework.EVALUATION_TYPES.POLICY_CONSTRAINT).length >= 2);
  assert.strictEqual(framework.getBenchmarkCases('text.cleanup.benchmark.core').length, 5);
  assert.strictEqual(framework.getEnabledBenchmarkCases('text.cleanup.benchmark.core').length, 5);
  assert.deepStrictEqual(framework.verifyReplacementLinks(), []);
  assert.deepStrictEqual(framework.verifyCapabilityCompatibility(), []);

  const transitionReady = framework.validateLifecycleTransition(framework.DATASET_LIFECYCLE_STATES.APPROVED_FOR_TEST, framework.DATASET_LIFECYCLE_STATES.BENCHMARK_READY, {
    schemaValidation: true,
    caseValidation: true,
    sourceClassification: true,
    provenanceComplete: true,
    privacyReview: true,
    qualityReview: true,
    capabilityCompatibility: true,
    coverageMetadata: true,
    approvalMetadata: true,
    integrityHashes: true
  });
  assert.strictEqual(transitionReady.allowed, true);
  const transitionMissing = framework.validateLifecycleTransition(framework.DATASET_LIFECYCLE_STATES.APPROVED_FOR_TEST, framework.DATASET_LIFECYCLE_STATES.BENCHMARK_READY, {});
  assert.strictEqual(transitionMissing.conditionallyAllowed, true);
  assert.ok(transitionMissing.ownerApprovalRequired);
  assert.strictEqual(framework.validateLifecycleTransition(framework.DATASET_LIFECYCLE_STATES.RETIRED, framework.DATASET_LIFECYCLE_STATES.BENCHMARK_READY).prohibited, true);

  const hashA = framework.computeManifestHash(datasets[0]);
  const hashB = framework.computeManifestHash(JSON.parse(JSON.stringify(datasets[0])));
  assert.strictEqual(hashA, hashB, 'manifest hash must be stable');
  assert.strictEqual(framework.computeCaseHash(datasets[0].cases[0]), framework.computeCaseHash(JSON.parse(JSON.stringify(datasets[0].cases[0]))), 'case hash must be stable');

  const coverage = framework.summarizeCoverage(datasets);
  assert.strictEqual(coverage.reports.length, 3);
  assert.ok(coverage.reports.every((report) => Array.isArray(report.missingScenarioCategories)));
  assert.strictEqual(framework.listWithMissingCoverage().length, 0);

  expectInvalid('DUPLICATE_DATASET_ID_VERSION', (items) => { items[1].datasetId = items[0].datasetId; items[1].version = items[0].version; });
  expectInvalid('INVALID_DATASET_ID', (items) => { items[0].datasetId = 'Bad Dataset'; });
  expectInvalid('PROVIDER_OR_MODEL_IN_DATASET_ID', (items) => { items[0].datasetId = 'openai.cleanup.benchmark.core'; });
  expectInvalid('PRODUCTION_IDENTITY_IN_DATASET_ID', (items) => { items[0].datasetId = 'text.cleanup.benchmark.customer_alpha'; });
  expectInvalid('UNKNOWN_CAPABILITY_ID', (items) => { items[0].capabilityId = 'missing.capability'; });
  expectInvalid('UNSUPPORTED_CAPABILITY_VERSION', (items) => { items[0].supportedCapabilityVersions = ['text.cleanup.v9']; });
  expectInvalid('INVALID_ENUM_VALUE', (items) => { items[0].lifecycleState = 'ACTIVE'; });
  expectInvalid('RETIRED_DATASET_ENABLED', (items) => { items[0].lifecycleState = 'RETIRED'; items[0].enabled = true; });
  expectInvalid('FROZEN_REQUIRES_INTEGRITY_METADATA', (items) => { items[0].lifecycleState = 'FROZEN'; items[0].integrity = {}; });
  expectInvalid('BENCHMARK_READY_REQUIRES_OWNER_APPROVAL', (items) => { items[0].lifecycleState = 'BENCHMARK_READY'; items[0].approvalStatus = 'TECHNICAL_VALIDATION_COMPLETE'; });
  expectInvalid('UNKNOWN_REPLACEMENT_DATASET', (items) => { items[0].replacementDatasetId = 'text.cleanup.benchmark.replacement'; });
  expectInvalid('SELF_REPLACEMENT', (items) => { items[0].replacementDatasetId = items[0].datasetId; });
  expectInvalid('ALIAS_COLLISION', (items) => { items[1].aliases = [items[0].datasetId]; });
  expectInvalid('DUPLICATE_CASE_ID', (items) => { items[0].cases[1].caseId = items[0].cases[0].caseId; });
  expectInvalid('CASE_CAPABILITY_MISMATCH', (items) => { items[0].cases[0].capabilityId = 'text.cleanup'; });
  expectInvalid('MISSING_REQUIRED_CASE_FIELD', (items) => { delete items[0].cases[0].requestPayload; });
  expectInvalid('EXACT_MATCH_REQUIRES_EXPECTED_OUTPUT', (items) => { items[0].cases[0].evaluationTypes = ['EXACT_MATCH']; delete items[0].cases[0].exactExpectedOutput; });
  expectInvalid('NUMERICAL_TOLERANCE_REQUIRES_TARGET', (items) => { items[0].cases[0].evaluationTypes = ['NUMERICAL_TOLERANCE']; items[0].cases[0].expectedNumericalValues = []; });
  expectInvalid('ROUTE_CONSTRAINT_REQUIRES_ROUTE_ASSERTIONS', (items) => { items[0].cases[0].evaluationTypes = ['ROUTE_CONSTRAINT']; items[0].cases[0].expectedRouteProperties = {}; });
  expectInvalid('REFUSAL_EXPECTED_REQUIRES_REFUSAL_ASSERTION', (items) => { items[0].cases[0].expectedRefusal = true; delete items[0].cases[0].assertions.refusalAssertion; });
  expectInvalid('HUMAN_REVIEW_EXPECTED_WHILE_PROHIBITED', (items) => { items[0].cases[0].expectedHumanReview = true; items[0].cases[0].humanReviewProhibited = true; });
  expectInvalid('SAFETY_CRITICAL_REQUIRES_SAFETY_ASSERTIONS', (items) => { items[0].cases[0].safetyImpact = 'HIGH'; items[0].cases[0].assertions.safetyAssertions = []; });
  expectInvalid('EMPLOYMENT_IMPACT_REQUIRES_ADVISORY_LIMITATION', (items) => { items[0].cases[0].employmentImpact = 'HIGH'; items[0].cases[0].assertions.policyAssertions = ['no_fabrication']; });
  expectInvalid('CANONICAL_FACTS_REQUIRE_AUTHORITATIVE_REFERENCE', (items) => { items[0].cases[0].minimumEvidenceRequirements = []; });
  expectInvalid('CONTRADICTORY_ASSERTIONS', (items) => { items[0].cases[0].assertions.inclusionAssertions = ['x']; items[0].cases[0].assertions.exclusionAssertions = ['x']; });
  expectInvalid('PERSONAL_DATA_CANNOT_BE_PUBLIC', (items) => { items[0].containsPersonalData = true; items[0].dataClassification = 'PUBLIC'; });
  expectInvalid('PRODUCTION_DATA_REQUIRES_APPROVAL', (items) => { items[0].productionDataUsed = true; items[0].approvedRealDataUse = false; });
  expectInvalid('REAL_DATA_APPROVAL_EVIDENCE_REQUIRED', (items) => { items[0].approvedRealDataUse = true; items[0].approvedBy = null; });
  expectInvalid('SYNTHETIC_DATA_REQUIRES_GENERATION_METADATA', (items) => { delete items[0].syntheticDataMetadata; });
  expectInvalid('SANITIZED_DATA_REQUIRES_METADATA', (items) => { items[0].sanitizedData = true; items[0].sanitizationMetadata = null; });
  expectInvalid('ANONYMIZED_DATA_REQUIRES_REIDENTIFICATION_ASSESSMENT', (items) => { items[0].anonymizedData = true; items[0].reidentificationRiskAssessment = null; });
  expectInvalid('PSEUDONYMIZED_IS_NOT_ANONYMIZED', (items) => { items[0].pseudonymizedData = true; items[0].anonymizedData = true; items[0].reidentificationRiskAssessment = { status: 'reviewed' }; });
  expectInvalid('LICENSED_SOURCE_REQUIRES_LICENSE', (items) => { items[0].sourceType = 'LICENSED_EXTERNAL'; items[0].sourceLicense = null; });
  expectInvalid('PUBLIC_SOURCE_REQUIRES_REFERENCE', (items) => { items[0].sourceType = 'PUBLIC_OPEN_DATA'; items[0].sourceReferences = []; });
  expectInvalid('DERIVED_SOURCE_REQUIRES_UPSTREAM_PROVENANCE', (items) => { items[0].sourceType = 'DERIVED'; items[0].upstreamSources = []; });
  expectInvalid('SECRET_LIKE_FIXTURE_CONTENT', (items) => { items[0].cases[0].requestPayload.text = 'api_key: synthetic-secret-value'; });
  expectInvalid('PRODUCTION_BENCHMARK_REQUIRES_OWNER_APPROVAL', (items) => { items[0].allowedEnvironments = ['LOCAL_TEST', 'PRODUCTION_BENCHMARK']; });
  expectInvalid('CASE_COUNT_MISMATCH', (items) => { items[0].caseCount = 99; });
  expectInvalid('DUPLICATE_CASE_CONTENT_HASH', (items) => { items[0].cases.push(JSON.parse(JSON.stringify(items[0].cases[0]))); items[0].cases[items[0].cases.length - 1].caseId = 'duplicate-content-case'; items[0].caseCount = items[0].cases.length; items[0].integrity.caseCountVerified = items[0].cases.length; });
  expectInvalid('FIXTURE_COUNT_NOT_VERIFIED', (items) => { items[0].integrity.caseCountVerified = 99; });
  expectInvalid('DATASET_CLAIMS_CAPABILITY_ACTIVATION', (items) => { items[0].claimsCapabilityActivation = true; });

  const before = readGenerated();
  const checkResult = generate({ check: true });
  assert.deepStrictEqual(checkResult.changed, []);
  assert.deepStrictEqual(readGenerated(), before);

  console.log('[test:benchmark-datasets] dataset schema, case schema, validation rules, queries, lifecycle transitions, coverage, hashing, and generated artifacts verified.');
}

main();
