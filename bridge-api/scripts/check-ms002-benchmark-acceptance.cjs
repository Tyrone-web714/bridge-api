#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildRegistry } = require('./generate-ms001-capability-classification-artifacts.cjs');
const { buildFramework, generate, paths, EXECUTION_STRATEGY_ORDER } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');

const REQUIRED_DOCS = Object.freeze([
  'README.md',
  'BENCHMARK_SCOPE.md',
  'ACCEPTANCE_CRITERIA.md',
  'CAPABILITY_ACCEPTANCE_CONTRACTS.md',
  'EVALUATION_METRICS.md',
  'CHEAPEST_SUFFICIENT_SELECTION.md',
  'SAFETY_AND_GOVERNANCE_GATES.md',
  'COST_AND_LATENCY_POLICY.md',
  'RELIABILITY_FAILURE_ACCOUNTING.md',
  'BENCHMARK_DATASET_GOVERNANCE.md',
  'REPRODUCIBILITY_CONTRACT.md',
  'AGGREGATE_SCORING_POLICY.md',
  'PROVIDER_MODEL_DECISION_BOUNDARY.md',
  'OWNER_DECISIONS_REQUIRED.md',
  'MS002_COMPLETION_REPORT.md',
  'generated/ms002_framework.json',
  'generated/ms002_summary.json',
  'generated/ms002_capability_acceptance_matrix.json',
  'generated/ms002_readiness_checklist.json',
  'generated/ms002_hash.json'
]);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateFramework(framework) {
  assert.strictEqual(framework.packageId, 'MS-002');
  assert.strictEqual(framework.sourcePackage, 'MS-001');
  assert.strictEqual(framework.scope.repositoryOnlyAnalysisDesign, true);
  assert.strictEqual(framework.scope.providerSelectionPerformed, false);
  assert.strictEqual(framework.scope.modelSelectionPerformed, false);
  assert.strictEqual(framework.scope.hostedBenchmarkingPerformed, false);
  assert.strictEqual(framework.scope.productionActivationPerformed, false);
  assert.strictEqual(framework.scope.deploymentPerformed, false);
  assert.strictEqual(framework.scope.migrationPerformed, false);
  assert.strictEqual(framework.scope.productionChangePerformed, false);
  assert.strictEqual(framework.scope.noNinthDomain, true);
  assert.strictEqual(framework.gateState.modelSelectionGateStatus, 'DEFERRED');
  assert.strictEqual(framework.gateState.modelSelectionGateComplete, false);
  assert.strictEqual(framework.gateState.modelSelectionGateActive, false);
  assert.strictEqual(framework.gateState.productionOrchestrationGateStatus, 'DEFERRED');
  assert.strictEqual(framework.gateState.productionOrchestrationGateComplete, false);
  assert.strictEqual(framework.gateState.productionOrchestrationGateActive, false);
  assert.deepStrictEqual(framework.executionStrategyOrder, EXECUTION_STRATEGY_ORDER);
  assert.strictEqual(framework.cheapestSufficientSelectionPolicy.highestRawQualityScoreWins, false);
  assert.ok(framework.cheapestSufficientSelectionPolicy.sequence.some((step) => step.includes('hard gate failure disqualifies')));
  assert.strictEqual(framework.benchmarkDatasetGovernance.providerOutputMayBecomeGroundTruth, false);
  assert.strictEqual(framework.benchmarkDatasetGovernance.datasetVersionHashTraceable, true);
  assert.ok(framework.reproducibilityRunRecordSchema.includes('benchmarkDatasetVersionHash'));
  assert.ok(framework.reproducibilityRunRecordSchema.includes('disqualificationReason'));

  const ms001 = buildRegistry();
  const expectedCandidates = ms001.capabilities.filter((capability) => capability.modelBenchmarkRequired).map((capability) => capability.capabilityId).sort();
  const expectedExclusions = ms001.capabilities.filter((capability) => !capability.modelBenchmarkRequired).map((capability) => capability.capabilityId).sort();
  const actualCandidates = framework.benchmarkCandidates.map((capability) => capability.capabilityId).sort();
  assert.deepStrictEqual(actualCandidates, expectedCandidates);
  assert.deepStrictEqual(framework.benchmarkExclusions, expectedExclusions);
  assert.strictEqual(framework.counts.sourceCapabilityCount, ms001.counts.totalCapabilityCount);
  assert.strictEqual(framework.counts.benchmarkCandidateCount, expectedCandidates.length);
  assert.strictEqual(framework.counts.benchmarkExcludedD0Count, expectedExclusions.length);
  assert.strictEqual(framework.counts.d1CandidateCount, framework.benchmarkCandidates.filter((c) => c.executionClass === 'D1').length);
  assert.strictEqual(framework.counts.d2CandidateCount, framework.benchmarkCandidates.filter((c) => c.executionClass === 'D2').length);
  assert.strictEqual(framework.counts.d3CandidateCount, framework.benchmarkCandidates.filter((c) => c.executionClass === 'D3').length);
  assert.strictEqual(framework.counts.ownerReviewRequiredCount, 0);
  assert.strictEqual(framework.counts.providerSelectedCount, 0);
  assert.strictEqual(framework.counts.modelSelectedCount, 0);
  assert.strictEqual(framework.counts.liveBenchmarkExecutedCount, 0);
  assert.strictEqual(framework.counts.productionActivationCount, 0);

  const seen = new Set();
  for (const candidate of framework.benchmarkCandidates) {
    if (seen.has(candidate.capabilityId)) fail(`Duplicate benchmark candidate: ${candidate.capabilityId}`);
    seen.add(candidate.capabilityId);
    if (candidate.executionClass === 'D0') fail(`D0 capability must not enter MS-002 candidate set: ${candidate.capabilityId}`);
    assert.strictEqual(candidate.modelBenchmarkRequired, true);
    assert.strictEqual(candidate.benchmarkPlanStatus, 'REPOSITORY_DEFINED');
    assert.strictEqual(candidate.liveBenchmarkStatus, 'NOT_STARTED');
    assert.strictEqual(candidate.providerSelectionStatus, 'NOT_STARTED');
    assert.strictEqual(candidate.modelSelectionStatus, 'NOT_STARTED');
    assert.strictEqual(candidate.productionActivationStatus, 'NOT_STARTED');
    assert.strictEqual(candidate.acceptanceDecisionState, 'OWNER_APPROVAL_REQUIRED_AFTER_EVIDENCE');
    assert.strictEqual(candidate.thresholdPolicy.includes('No numeric pass/fail threshold is approved by MS-002'), true);
    assert.strictEqual(candidate.thresholdState.ownerOrEmpiricalThresholdRequired, true);
    assert.strictEqual(candidate.thresholdState.passByDefaultAllowed, false);
    assert.ok(candidate.capabilityName);
    assert.ok(candidate.intendedFunction);
    assert.ok(Array.isArray(candidate.authoritativeInputs) && candidate.authoritativeInputs.length > 0);
    assert.ok(candidate.expectedOutputContract.outputType);
    assert.ok(Array.isArray(candidate.expectedOutputContract.requiredProperties) && candidate.expectedOutputContract.requiredProperties.length > 0);
    assert.strictEqual(candidate.benchmarkDatasetReference.versionHashRequiredForFutureRuns, true);
    assert.strictEqual(candidate.benchmarkDatasetReference.providerOutputMayBecomeGroundTruth, false);
    assert.ok(Array.isArray(candidate.qualityDimensions) && candidate.qualityDimensions.length > 0);
    assert.ok(Array.isArray(candidate.reliabilityRequirements) && candidate.reliabilityRequirements.includes('timeouts counted'));
    assert.strictEqual(candidate.latencyMeasurement.metricDefined, true);
    assert.strictEqual(candidate.latencyMeasurement.thresholdStatus, 'OWNER_OR_EMPIRICAL_THRESHOLD_REQUIRED');
    assert.strictEqual(candidate.usageMeasurement.inputUsageRequired, true);
    assert.strictEqual(candidate.usageMeasurement.outputUsageRequired, true);
    assert.strictEqual(candidate.costMeasurement.currentProviderPricingInserted, false);
    assert.strictEqual(candidate.costMeasurement.retryAndFailureOverheadIncluded, true);
    assert.ok(Array.isArray(candidate.failureConditions) && candidate.failureConditions.includes('schema failure'));
    assert.ok(Array.isArray(candidate.hardDisqualificationConditions) && candidate.hardDisqualificationConditions.includes('cross-Organization leakage'));
    if (candidate.safetyRelevant) {
      assert.ok(candidate.hardDisqualificationConditions.includes('suppressing known safety blocker'));
      assert.ok(candidate.hardDisqualificationConditions.includes('contradicting authoritative route restriction'));
    }
    assert.strictEqual(candidate.aggregateScoringPolicy.hardGatesBeforeAggregateScore, true);
    assert.strictEqual(candidate.aggregateScoringPolicy.aggregateScoreMayOverrideMandatoryGate, false);
    assert.strictEqual(candidate.aggregateScoringPolicy.safetyFailureCanBeAveragedOut, false);
    assert.strictEqual(candidate.aggregateScoringPolicy.selectionRule, 'cost_constrained_sufficiency_not_highest_score_wins');
    assert.ok(candidate.deterministicAuthorityBoundary);
    assert.ok(Array.isArray(candidate.reproducibilityRequirements) && candidate.reproducibilityRequirements.includes('run ID'));
    assert.ok(Array.isArray(candidate.minimumAcceptanceEvidence) && candidate.minimumAcceptanceEvidence.length >= 8);
    assert.ok(Array.isArray(candidate.rejectionConditions) && candidate.rejectionConditions.length >= 6);
    if (candidate.executionClass === 'D1') {
      assert.strictEqual(candidate.d1MustNotDefaultToGenerativeAi, true);
      assert.ok(candidate.allowedStrategiesForFutureEvaluation.includes('statistical_or_mathematical_methods'));
      assert.ok(!candidate.allowedStrategiesForFutureEvaluation.includes('balanced_hosted_models'));
      assert.ok(candidate.qualityDimensions.some((dimension) => dimension.includes('prediction_error')));
      assert.ok(candidate.qualityDimensions.some((dimension) => dimension.includes('calibration')));
    } else {
      assert.deepStrictEqual(candidate.allowedStrategiesForFutureEvaluation, EXECUTION_STRATEGY_ORDER);
      assert.ok(candidate.qualityDimensions.includes('factual_consistency'));
      assert.ok(candidate.qualityDimensions.includes('structured_output_validity'));
    }
  }

  const governanceText = JSON.stringify(framework.acceptanceGovernance).toLowerCase();
  for (const phrase of ['live provider output', 'hosted model benchmark result', 'provider ranking', 'model ranking', 'highest score wins', 'production orchestration evidence']) {
    if (!governanceText.includes(phrase)) fail(`Missing prohibited governance phrase: ${phrase}`);
  }
}

function validateArtifacts(framework) {
  for (const doc of REQUIRED_DOCS) {
    const absolute = path.join(paths.docsRoot, doc);
    if (!fs.existsSync(absolute)) fail(`Missing MS-002 artifact: ${doc}`);
  }
  const generatedFramework = readJson(path.join(paths.generatedRoot, 'ms002_framework.json'));
  validateFramework(generatedFramework);
  assert.deepStrictEqual(generatedFramework.counts, framework.counts);
  assert.strictEqual(readJson(path.join(paths.generatedRoot, 'ms002_summary.json')).benchmarkCandidateCount, framework.counts.benchmarkCandidateCount);
  assert.strictEqual(readJson(path.join(paths.generatedRoot, 'ms002_hash.json')).frameworkHash, framework.frameworkHash);
  const stale = generate({ check: true }).changed;
  assert.deepStrictEqual(stale, [], `Generated MS-002 artifacts are stale: ${stale.join(', ')}`);
}

function expectInvalid(name, mutate) {
  const framework = clone(buildFramework());
  mutate(framework);
  assert.throws(() => validateFramework(framework), undefined, `Negative test did not fail: ${name}`);
}

function runNegativeTests() {
  expectInvalid('provider selected', (f) => {
    f.benchmarkCandidates[0].providerSelectionStatus = 'SELECTED';
    f.counts.providerSelectedCount = 1;
  });
  expectInvalid('model selected', (f) => {
    f.benchmarkCandidates[0].modelSelectionStatus = 'SELECTED';
    f.counts.modelSelectedCount = 1;
  });
  expectInvalid('hosted benchmark executed', (f) => {
    f.benchmarkCandidates[0].liveBenchmarkStatus = 'EXECUTED';
    f.counts.liveBenchmarkExecutedCount = 1;
  });
  expectInvalid('production activation', (f) => {
    f.benchmarkCandidates[0].productionActivationStatus = 'ACTIVE';
    f.counts.productionActivationCount = 1;
  });
  expectInvalid('D0 added to candidates', (f) => {
    f.benchmarkCandidates.push({
      ...f.benchmarkCandidates[0],
      capabilityId: 'route.clearance_eligibility',
      executionClass: 'D0'
    });
  });
  expectInvalid('benchmark candidate removed', (f) => {
    f.benchmarkCandidates.pop();
    f.counts.benchmarkCandidateCount -= 1;
  });
  expectInvalid('unauthorized 14th benchmark capability', (f) => {
    f.benchmarkCandidates.push({
      ...f.benchmarkCandidates[0],
      capabilityId: 'unauthorized.extra_capability'
    });
    f.counts.benchmarkCandidateCount += 1;
  });
  expectInvalid('gate marked active', (f) => {
    f.gateState.modelSelectionGateActive = true;
  });
  expectInvalid('production orchestration gate activated', (f) => {
    f.gateState.productionOrchestrationGateActive = true;
  });
  expectInvalid('scope claims hosted benchmarking', (f) => {
    f.scope.hostedBenchmarkingPerformed = true;
  });
  expectInvalid('threshold approved prematurely', (f) => {
    f.benchmarkCandidates[0].thresholdPolicy = '95 percent pass threshold approved';
  });
  expectInvalid('provider ranking', (f) => {
    f.acceptanceGovernance.prohibitedEvidenceThisPackage = f.acceptanceGovernance.prohibitedEvidenceThisPackage.filter((item) => item !== 'provider ranking');
  });
  expectInvalid('model ranking', (f) => {
    f.acceptanceGovernance.prohibitedEvidenceThisPackage = f.acceptanceGovernance.prohibitedEvidenceThisPackage.filter((item) => item !== 'model ranking');
  });
  expectInvalid('current provider pricing inserted', (f) => {
    f.benchmarkCandidates[0].costMeasurement.currentProviderPricingInserted = true;
  });
  expectInvalid('hard safety gate removed', (f) => {
    f.benchmarkCandidates.find((c) => c.hardDisqualificationConditions.includes('contradicting authoritative route restriction')).hardDisqualificationConditions = ['cross-Organization leakage'];
  });
  expectInvalid('safety failure allowed through aggregate score', (f) => {
    f.benchmarkCandidates[0].aggregateScoringPolicy.safetyFailureCanBeAveragedOut = true;
  });
  expectInvalid('unknown evidence pass by default', (f) => {
    f.benchmarkCandidates[0].thresholdState.passByDefaultAllowed = true;
  });
  expectInvalid('cross-Organization leakage allowed', (f) => {
    f.benchmarkCandidates[0].hardDisqualificationConditions = f.benchmarkCandidates[0].hardDisqualificationConditions.filter((item) => item !== 'cross-Organization leakage');
  });
  expectInvalid('D1 forced to generative AI', (f) => {
    const d1 = f.benchmarkCandidates.find((candidate) => candidate.executionClass === 'D1');
    d1.allowedStrategiesForFutureEvaluation = ['low_cost_hosted_models'];
  });
  expectInvalid('D3 capability introduced', (f) => {
    f.benchmarkCandidates[0].executionClass = 'D3';
    f.counts.d3CandidateCount = 1;
  });
  expectInvalid('ninth intelligence domain introduced', (f) => {
    f.scope.noNinthDomain = false;
  });
  expectInvalid('highest score wins enabled', (f) => {
    f.cheapestSufficientSelectionPolicy.highestRawQualityScoreWins = true;
  });
  expectInvalid('provider output becomes ground truth', (f) => {
    f.benchmarkDatasetGovernance.providerOutputMayBecomeGroundTruth = true;
  });
}

const framework = buildFramework();
validateFramework(framework);
validateArtifacts(framework);
runNegativeTests();

console.log(`[ms002] validated benchmark acceptance framework: candidates=${framework.counts.benchmarkCandidateCount}, excluded=${framework.counts.benchmarkExcludedD0Count}, providerSelected=${framework.counts.providerSelectedCount}, modelSelected=${framework.counts.modelSelectedCount}, liveBenchmarks=${framework.counts.liveBenchmarkExecutedCount}`);
