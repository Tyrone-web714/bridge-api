#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildRegistry } = require('./generate-ms001-capability-classification-artifacts.cjs');
const { buildCandidateSelection, generate, paths } = require('./generate-ms003-candidate-selection-artifacts.cjs');

const REQUIRED_DOCS = Object.freeze([
  'README.md',
  'MS003_CANDIDATE_MATRIX.json',
  'MS003_CANDIDATE_MATRIX.md',
  'D1_CANDIDATE_METHODS.md',
  'D2_CANDIDATE_MODELS.md',
  'CAPABILITY_CANDIDATE_MAP.md',
  'OFFICIAL_MODEL_SOURCE_REGISTER.md',
  'CURRENT_PRICING_REGISTER.md',
  'NORMALIZED_COST_COMPARISON.md',
  'OPEN_WEIGHT_SELF_HOSTED_ASSESSMENT.md',
  'PROVIDER_ADAPTER_COMPATIBILITY.md',
  'SCREENED_OUT_CANDIDATES.md',
  'PREMIUM_MODEL_ENTRY_JUSTIFICATIONS.md',
  'PRIVACY_SECURITY_PROVIDER_FACTS.md',
  'BENCHMARK_EXECUTION_SIZE_ESTIMATE.md',
  'MS004_BENCHMARK_BUDGET_FORECAST.md',
  'CROSS_CAPABILITY_CONSOLIDATION_CANDIDATES.md',
  'PROVIDER_CONCENTRATION_NOTES.md',
  'UNVERIFIED_CURRENT_INFORMATION.md',
  'MS003_COMPLETION_REPORT.md',
  'generated/ms003_candidate_selection_framework.json',
  'generated/ms003_candidate_summary.json',
  'generated/ms003_source_register.json',
  'generated/ms003_pricing_register.json',
  'generated/ms003_benchmark_budget_forecast.json',
  'generated/ms003_hash.json'
]);

function fail(message) {
  throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateFramework(framework) {
  assert.strictEqual(framework.packageId, 'MS-003');
  assert.strictEqual(framework.scope.repositoryOnlyResearchAndDesign, true);
  assert.strictEqual(framework.scope.currentPricingResearchPerformed, true);
  assert.strictEqual(framework.scope.providerSelectionPerformed, false);
  assert.strictEqual(framework.scope.modelSelectionPerformed, false);
  assert.strictEqual(framework.scope.hostedBenchmarkingPerformed, false);
  assert.strictEqual(framework.scope.productionActivationPerformed, false);
  assert.strictEqual(framework.scope.deploymentPerformed, false);
  assert.strictEqual(framework.scope.migrationPerformed, false);
  assert.strictEqual(framework.scope.productionChangePerformed, false);
  assert.strictEqual(framework.scope.noNinthDomain, true);
  assert.strictEqual(framework.gateState.modelSelectionGateComplete, false);
  assert.strictEqual(framework.gateState.modelSelectionGateActive, false);
  assert.strictEqual(framework.gateState.productionOrchestrationGateActive, false);
  assert.strictEqual(framework.gateState.ms004Status, 'NOT_STARTED');

  const ms001 = buildRegistry();
  const expected = ms001.capabilities.filter((capability) => capability.modelBenchmarkRequired).map((capability) => capability.capabilityId).sort();
  const actual = framework.benchmarkCapabilities.map((capability) => capability.capabilityId).sort();
  assert.deepStrictEqual(actual, expected);
  assert.strictEqual(framework.summary.totalBenchmarkCapabilities, 13);
  assert.strictEqual(framework.summary.d1Count, 4);
  assert.strictEqual(framework.summary.d2Count, 9);
  assert.strictEqual(framework.summary.d3Count, 0);
  assert.strictEqual(framework.summary.providerModelSelected, 0);
  assert.strictEqual(framework.summary.hostedBenchmarkExecuted, 0);
  assert.strictEqual(framework.summary.productionActivation, 0);

  const d0 = new Set(ms001.capabilities.filter((capability) => !capability.modelBenchmarkRequired).map((capability) => capability.capabilityId));
  const candidateCapabilities = new Set(framework.candidates.map((candidate) => candidate.capabilityId));
  for (const id of d0) {
    if (candidateCapabilities.has(id)) fail(`D0 capability entered MS-003 candidate matrix: ${id}`);
  }
  for (const id of expected) {
    const records = framework.candidates.filter((candidate) => candidate.capabilityId === id);
    if (!records.length) fail(`Benchmark capability omitted from MS-003 candidates: ${id}`);
    const sourceCapability = framework.benchmarkCapabilities.find((capability) => capability.capabilityId === id);
    if (sourceCapability.executionClass === 'D2' && records.length > 4) fail(`D2 capability exceeds candidate cap: ${id}`);
  }

  for (const candidate of framework.candidates) {
    assert.strictEqual(candidate.candidateStatus, 'SHORTLISTED');
    assert.strictEqual(candidate.providerSelected, false);
    assert.strictEqual(candidate.modelSelected, false);
    assert.strictEqual(candidate.finalWinner, false);
    assert.strictEqual(candidate.hostedBenchmarkExecuted, false);
    assert.strictEqual(candidate.productionAssignment, false);
    if (candidate.candidateType === 'HOSTED_MODEL') {
      assert.ok(candidate.provider);
      assert.ok(candidate.modelName);
      assert.ok(candidate.officialModelId);
      assert.ok(Array.isArray(candidate.sourceReferences) && candidate.sourceReferences.length >= 2);
      assert.strictEqual(candidate.pricingVerified, true);
      assert.strictEqual(candidate.pricingVerifiedDate, '2026-08-20');
      assert.strictEqual(Number.isFinite(candidate.inputPrice), true);
      assert.strictEqual(Number.isFinite(candidate.outputPrice), true);
      assert.ok(candidate.inclusionReason);
    }
    if (candidate.modelTier === 'PREMIUM_UPPER_BOUND') assert.ok(candidate.premiumEntryJustification);
    if (candidate.executionClass === 'D1') {
      assert.strictEqual(candidate.candidateType, 'D1_METHOD');
      assert.notStrictEqual(candidate.candidateType, 'HOSTED_MODEL');
    }
  }
  assert.ok(framework.screenedOutCandidates.length > 0);
  for (const screened of framework.screenedOutCandidates) {
    assert.ok(screened.reasonConsidered);
    assert.ok(screened.reasonExcluded);
    assert.strictEqual(screened.candidateStatus, 'SCREENED_OUT');
  }
  assert.ok(framework.sourceRegister.length >= framework.summary.uniqueHostedModelsShortlisted);
  for (const record of framework.sourceDiscrepancies) {
    assert.ok(record.status);
    assert.ok(record.issue);
    assert.ok(record.handling);
  }
  assert.strictEqual(framework.candidates.some((candidate) => candidate.candidateStatus === 'UNVERIFIED'), false);
}

function validateArtifacts(framework) {
  for (const doc of REQUIRED_DOCS) {
    const absolute = path.join(paths.docsRoot, doc);
    assert.ok(fs.existsSync(absolute), `Missing MS-003 artifact: ${doc}`);
  }
  const generated = JSON.parse(fs.readFileSync(path.join(paths.generatedRoot, 'ms003_candidate_selection_framework.json'), 'utf8'));
  validateFramework(generated);
  assert.deepStrictEqual(generated.summary, framework.summary);
  const stale = generate({ check: true }).changed;
  assert.deepStrictEqual(stale, [], `Generated MS-003 artifacts are stale: ${stale.join(', ')}`);
}

function expectInvalid(name, mutate) {
  const framework = clone(buildCandidateSelection());
  mutate(framework);
  assert.throws(() => validateFramework(framework), undefined, `Negative test did not fail: ${name}`);
}

function runNegativeTests() {
  expectInvalid('D0 capability added', (f) => {
    f.candidates.push({ ...f.candidates[0], capabilityId: 'route.clearance_eligibility' });
  });
  expectInvalid('14th capability added', (f) => {
    f.benchmarkCapabilities.push({ ...f.benchmarkCapabilities[0], capabilityId: 'unauthorized.extra' });
    f.summary.totalBenchmarkCapabilities = 14;
  });
  expectInvalid('benchmark capability omitted', (f) => {
    const removed = f.benchmarkCapabilities.pop();
    f.candidates = f.candidates.filter((candidate) => candidate.capabilityId !== removed.capabilityId);
  });
  expectInvalid('final winner assigned', (f) => { f.candidates[0].finalWinner = true; });
  expectInvalid('production provider assigned', (f) => { f.candidates[0].productionAssignment = true; });
  expectInvalid('hosted benchmark executed', (f) => { f.candidates[0].hostedBenchmarkExecuted = true; });
  expectInvalid('unverified candidate enabled', (f) => { f.candidates.find((candidate) => candidate.candidateType === 'HOSTED_MODEL').candidateStatus = 'UNVERIFIED'; });
  expectInvalid('pricing without official source', (f) => { f.candidates.find((c) => c.candidateType === 'HOSTED_MODEL').sourceReferences = []; });
  expectInvalid('verification date omitted', (f) => { delete f.candidates.find((c) => c.candidateType === 'HOSTED_MODEL').pricingVerifiedDate; });
  expectInvalid('too many D2 candidates', (f) => {
    const d2 = f.benchmarkCapabilities.find((capability) => capability.executionClass === 'D2').capabilityId;
    f.candidates.push({ ...f.candidates.find((candidate) => candidate.capabilityId === d2), candidateId: `${d2}::extra1` });
    f.candidates.push({ ...f.candidates.find((candidate) => candidate.capabilityId === d2), candidateId: `${d2}::extra2` });
  });
  expectInvalid('premium candidate without justification', (f) => {
    const premium = f.candidates.find((candidate) => candidate.modelTier === 'PREMIUM_UPPER_BOUND');
    premium.premiumEntryJustification = null;
  });
  expectInvalid('production orchestration activation', (f) => { f.gateState.productionOrchestrationGateActive = true; });
  expectInvalid('deployment claim', (f) => { f.scope.deploymentPerformed = true; });
  expectInvalid('migration claim', (f) => { f.scope.migrationPerformed = true; });
  expectInvalid('ninth domain', (f) => { f.scope.noNinthDomain = false; });
  expectInvalid('MS-004 marked complete', (f) => { f.gateState.ms004Status = 'COMPLETE'; });
  expectInvalid('provider selected', (f) => { f.candidates[0].providerSelected = true; });
  expectInvalid('model selected', (f) => { f.candidates[0].modelSelected = true; });
}

const framework = buildCandidateSelection();
validateFramework(framework);
validateArtifacts(framework);
runNegativeTests();
console.log(`[ms003] validated candidate selection: capabilities=${framework.summary.totalBenchmarkCapabilities}, d1=${framework.summary.d1Count}, d2=${framework.summary.d2Count}, d1Methods=${framework.summary.totalShortlistedD1Methods}, d2Pairs=${framework.summary.totalShortlistedD2ModelCapabilityPairs}, hostedBenchmarks=${framework.summary.hostedBenchmarkExecuted}, selected=${framework.summary.providerModelSelected}`);
