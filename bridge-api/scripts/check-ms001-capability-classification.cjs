#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  buildRegistry,
  generate,
  paths,
  DOMAINS,
  EXECUTION_CLASSES,
  FUTURE_AI_ROLES,
  BENCHMARK_REQUIREMENTS
} = require('./generate-ms001-capability-classification-artifacts.cjs');

const REQUIRED_DOCS = Object.freeze([
  'README.md',
  'TSR_AI_CAPABILITY_REGISTRY.json',
  'TSR_AI_CAPABILITY_REGISTRY.md',
  'EXECUTION_CLASSIFICATION_MATRIX.md',
  'DETERMINISTIC_NO_AI_REGISTER.md',
  'AI_REQUIRED_CAPABILITY_REGISTER.md',
  'HYBRID_EXECUTION_BOUNDARIES.md',
  'SAFETY_AUTHORITY_MATRIX.md',
  'EXISTING_AI_PROVIDER_USAGE_AUDIT.md',
  'PREDICTIVE_EXECUTION_CLASSIFICATION.md',
  'VOICE_EXECUTION_DECOMPOSITION.md',
  'FUTURE_BENCHMARK_REQUIREMENTS.md',
  'COST_SENSITIVITY_CLASSIFICATION.md',
  'UNAPPROVED_IDEAS_FOR_OWNER_REVIEW.md',
  'MS001_COMPLETION_REPORT.md',
  'generated/ms001_summary.json',
  'generated/ms001_capability_index.json',
  'generated/ms001_domain_counts.json',
  'generated/ms001_benchmark_candidates.json',
  'generated/ms001_no_model_exclusions.json',
  'generated/ms001_provider_usage_audit.json',
  'generated/ms001_registry_hash.json'
]);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireFile(relativePath) {
  const absolute = path.join(paths.repoRoot, relativePath);
  if (!fs.existsSync(absolute)) fail(`Missing repository evidence: ${relativePath}`);
}

function validateRegistry(registry) {
  assert.strictEqual(registry.packageId, 'MS-001');
  assert.strictEqual(registry.scope.noNinthDomain, true);
  assert.strictEqual(registry.scope.modelSelectionPerformed, false);
  assert.strictEqual(registry.scope.providerSelectionPerformed, false);
  assert.strictEqual(registry.scope.pricingResearchPerformed, false);
  assert.strictEqual(registry.scope.productionOrchestrationActivated, false);
  assert.strictEqual(registry.scope.deploymentPerformed, false);
  assert.strictEqual(registry.scope.migrationPerformed, false);
  assert.strictEqual(registry.scope.productionChangePerformed, false);
  assert.deepStrictEqual(registry.scope.exactlyEightSourceIntelligenceDomains, DOMAINS);

  const ids = new Set();
  for (const capability of registry.capabilities) {
    if (!capability.capabilityId) fail('Capability missing capabilityId');
    if (ids.has(capability.capabilityId)) fail(`Duplicate capabilityId: ${capability.capabilityId}`);
    ids.add(capability.capabilityId);
    if (!DOMAINS.includes(capability.domain)) fail(`Unauthorized domain for ${capability.capabilityId}: ${capability.domain}`);
    if (!EXECUTION_CLASSES.includes(capability.executionClass)) fail(`Invalid execution class for ${capability.capabilityId}`);
    if (!BENCHMARK_REQUIREMENTS.includes(capability.benchmarkRequirement)) fail(`Invalid benchmark requirement for ${capability.capabilityId}`);
    if (!Array.isArray(capability.futureAiRoles) || capability.futureAiRoles.length === 0) fail(`Missing future AI roles for ${capability.capabilityId}`);
    for (const role of capability.futureAiRoles) {
      if (!FUTURE_AI_ROLES.includes(role)) fail(`Invalid future AI role for ${capability.capabilityId}: ${role}`);
    }
    if (!Array.isArray(capability.repositoryEvidence) || capability.repositoryEvidence.length === 0) fail(`Missing evidence for ${capability.capabilityId}`);
    capability.repositoryEvidence.forEach(requireFile);

    if (capability.executionClass === 'D0') {
      assert.strictEqual(capability.modelBenchmarkRequired, false, `${capability.capabilityId} D0 must not require model benchmark`);
      assert.strictEqual(capability.benchmarkRequirement, 'NOT_REQUIRED_D0', `${capability.capabilityId} D0 benchmark requirement must be NOT_REQUIRED_D0`);
      assert.deepStrictEqual(capability.futureAiRoles, ['NONE'], `${capability.capabilityId} D0 must not claim future AI role`);
    } else if (capability.benchmarkRequirement !== 'REQUIRES_OWNER_REVIEW') {
      assert.strictEqual(capability.modelBenchmarkRequired, true, `${capability.capabilityId} non-D0 must require benchmark unless owner-review gated`);
      assert.strictEqual(capability.benchmarkRequirement, `REQUIRED_${capability.executionClass}`);
    } else {
      assert.strictEqual(capability.modelBenchmarkRequired, false, `${capability.capabilityId} owner-review gated capability must not enter benchmark queue`);
    }

    assert.strictEqual(capability.modelOutputMayOverrideDeterministicResults, false);
    assert.strictEqual(capability.unsupportedPredictionAdded, false);
    assert.strictEqual(capability.unapprovedVoiceCapabilityAdded, false);
    assert.strictEqual(capability.fabricatedBenchmarkThreshold, null);
    assert.strictEqual(capability.providerSelected, null);
    assert.strictEqual(capability.modelSelected, null);
    assert.strictEqual(capability.providerRanking, null);
    assert.strictEqual(capability.modelRanking, null);
    assert.strictEqual(capability.pricingBenchmarkPerformed, false);
    assert.strictEqual(capability.productionOrchestrationActive, false);
    assert.strictEqual(capability.deploymentClaimed, false);
    assert.strictEqual(capability.migrationClaimed, false);
    assert.strictEqual(capability.premiumModelDesignated, false);
    assert.strictEqual(capability.costMayOverrideSafety, false);
    if (capability.safetyRelevant && !capability.safetyAuthority) fail(`Missing safety authority for ${capability.capabilityId}`);
  }

  assert.strictEqual(ids.size, registry.counts.totalCapabilityCount);
  assert.strictEqual(registry.counts.sourceDomainCount, 8);
  assert.strictEqual(registry.counts.d0Count, registry.capabilities.filter((c) => c.executionClass === 'D0').length);
  assert.strictEqual(registry.counts.d1Count, registry.capabilities.filter((c) => c.executionClass === 'D1').length);
  assert.strictEqual(registry.counts.d2Count, registry.capabilities.filter((c) => c.executionClass === 'D2').length);
  assert.strictEqual(registry.counts.d3Count, registry.capabilities.filter((c) => c.executionClass === 'D3').length);
  assert.strictEqual(registry.counts.modelBenchmarkRequiredCount, registry.capabilities.filter((c) => c.modelBenchmarkRequired).length);
  assert.strictEqual(registry.counts.modelBenchmarkExcludedCount, registry.capabilities.filter((c) => !c.modelBenchmarkRequired).length);
  assert.strictEqual(registry.counts.voiceRelatedCapabilityCount, 0);
  assert(registry.counts.d0Count > registry.counts.modelBenchmarkRequiredCount, 'D0 exclusion must materially reduce benchmark scope');
  assert(registry.unapprovedIdeasForOwnerReview.some((idea) => idea.idea.includes('voice')), 'Voice pipeline owner-review idea must be captured');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectInvalid(name, mutate) {
  const registry = clone(buildRegistry());
  mutate(registry);
  assert.throws(() => validateRegistry(registry), undefined, `Negative test did not fail: ${name}`);
}

function validateArtifacts(registry) {
  for (const doc of REQUIRED_DOCS) {
    const absolute = path.join(paths.docsRoot, doc);
    if (!fs.existsSync(absolute)) fail(`Missing MS-001 artifact: ${doc}`);
  }
  const generatedRegistry = readJson(path.join(paths.docsRoot, 'TSR_AI_CAPABILITY_REGISTRY.json'));
  validateRegistry(generatedRegistry);
  assert.deepStrictEqual(generatedRegistry.counts, registry.counts);
  assert.strictEqual(readJson(path.join(paths.generatedRoot, 'ms001_summary.json')).totalCapabilityCount, registry.counts.totalCapabilityCount);
  assert.strictEqual(readJson(path.join(paths.generatedRoot, 'ms001_registry_hash.json')).registryHash, registry.registryHash);
  const stale = generate({ check: true }).changed;
  assert.deepStrictEqual(stale, [], `Generated MS-001 artifacts are stale: ${stale.join(', ')}`);
}

function runNegativeTests() {
  expectInvalid('ninth domain', (r) => { r.capabilities[0].domain = 'Ninth Intelligence'; });
  expectInvalid('duplicate capability id', (r) => { r.capabilities[1].capabilityId = r.capabilities[0].capabilityId; });
  expectInvalid('invalid execution class', (r) => { r.capabilities[0].executionClass = 'D4'; });
  expectInvalid('D0 model benchmark', (r) => { r.capabilities.find((c) => c.executionClass === 'D0').modelBenchmarkRequired = true; });
  expectInvalid('D0 AI role', (r) => { r.capabilities.find((c) => c.executionClass === 'D0').futureAiRoles = ['REASONING']; });
  expectInvalid('D2 missing benchmark', (r) => { r.capabilities.find((c) => c.executionClass === 'D2').modelBenchmarkRequired = false; });
  expectInvalid('provider selected', (r) => { r.capabilities[0].providerSelected = 'openai'; });
  expectInvalid('model selected', (r) => { r.capabilities[0].modelSelected = 'example-model'; });
  expectInvalid('provider ranking', (r) => { r.capabilities[0].providerRanking = 1; });
  expectInvalid('pricing benchmark', (r) => { r.capabilities[0].pricingBenchmarkPerformed = true; });
  expectInvalid('production orchestration', (r) => { r.capabilities[0].productionOrchestrationActive = true; });
  expectInvalid('deployment claim', (r) => { r.capabilities[0].deploymentClaimed = true; });
  expectInvalid('migration claim', (r) => { r.capabilities[0].migrationClaimed = true; });
  expectInvalid('premium model', (r) => { r.capabilities[0].premiumModelDesignated = true; });
  expectInvalid('safety override', (r) => { r.capabilities.find((c) => c.safetyRelevant).modelOutputMayOverrideDeterministicResults = true; });
  expectInvalid('cost overrides safety', (r) => { r.capabilities.find((c) => c.safetyRelevant).costMayOverrideSafety = true; });
  expectInvalid('fabricated threshold', (r) => { r.capabilities[0].fabricatedBenchmarkThreshold = '95%'; });
  expectInvalid('unapproved prediction', (r) => { r.capabilities[0].unsupportedPredictionAdded = true; });
  expectInvalid('unapproved voice', (r) => { r.capabilities[0].unapprovedVoiceCapabilityAdded = true; });
  expectInvalid('missing evidence', (r) => { r.capabilities[0].repositoryEvidence = ['docs/does-not-exist.md']; });
}

const registry = buildRegistry();
validateRegistry(registry);
validateArtifacts(registry);
runNegativeTests();

console.log(`[ms001] validated ${registry.counts.totalCapabilityCount} capabilities: D0=${registry.counts.d0Count}, D1=${registry.counts.d1Count}, D2=${registry.counts.d2Count}, D3=${registry.counts.d3Count}, benchmarkRequired=${registry.counts.modelBenchmarkRequiredCount}, excluded=${registry.counts.modelBenchmarkExcludedCount}`);
