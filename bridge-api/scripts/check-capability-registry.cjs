#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const registry = require('../services/intelligenceExecution/enterpriseCapabilityRegistry');
const runtimeRegistry = require('../services/intelligenceExecution/capabilityRegistry');
const { EXECUTION_STRATEGIES } = require('../services/intelligenceExecution/constants');
const { generate } = require('./generate-capability-registry-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'enterprise-intelligence-capability-registry', 'generated');

function cloneCapabilities(mutate) {
  const clone = JSON.parse(JSON.stringify(registry.listEnterpriseCapabilities()));
  mutate(clone);
  return clone;
}

function expectInvalid(rule, mutate) {
  const result = registry.validateEnterpriseRegistry(cloneCapabilities(mutate));
  assert.strictEqual(result.valid, false, `expected invalid registry for ${rule}`);
  assert.ok(result.errors.some((error) => error.rule === rule), `expected rule ${rule}, got ${result.errors.map((error) => error.rule).join(', ')}`);
}

function readGenerated() {
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function main() {
  const validation = registry.validateEnterpriseRegistry();
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));

  const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'intelligenceExecution', 'capabilityRegistry.js'), 'utf8');
  assert.ok(runtimeSource.includes('enterpriseCapabilityRegistry'), 'runtime capability registry must consume the enterprise registry');
  assert.ok(!runtimeSource.includes('const CAPABILITIES'), 'runtime capability registry must not define a duplicate hand-maintained capability source');

  const capabilities = registry.listEnterpriseCapabilities();
  const ids = capabilities.map((capability) => capability.capabilityId);
  assert.deepStrictEqual(ids.sort(), [
    'delivery_note.summarize',
    'legacy.ai.structured_response',
    'policy.answer',
    'route.risk_explanation',
    'supervisor.daily_operations_report',
    'text.cleanup'
  ].sort());
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => registry.validateCapabilityId(id) === null));
  assert.ok(registry.validateCapabilityId('openai.summary').rule === 'PROVIDER_OR_MODEL_IN_CAPABILITY_ID');
  assert.ok(registry.validateCapabilityId('gpt.summary').rule === 'PROVIDER_OR_MODEL_IN_CAPABILITY_ID');

  assert.strictEqual(registry.listByLifecycleState(registry.LIFECYCLE_STATES.PILOT).length, 3);
  assert.strictEqual(registry.listByImplementationStatus(registry.IMPLEMENTATION_STATUSES.PLACEHOLDER).length, 3);
  assert.strictEqual(registry.listByOperationalStatus(registry.OPERATIONAL_STATUSES.DISABLED).length, 3);
  assert.strictEqual(registry.listByDomain('routing').map((capability) => capability.capabilityId)[0], 'route.risk_explanation');
  assert.ok(registry.listByAllowedExecutionStrategy(EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL).some((capability) => capability.capabilityId === 'legacy.ai.structured_response'));
  assert.ok(registry.listSafetyImpactingCapabilities().some((capability) => capability.capabilityId === 'route.risk_explanation'));
  assert.ok(registry.listEmploymentImpactingCapabilities().some((capability) => capability.capabilityId === 'supervisor.daily_operations_report'));
  assert.deepStrictEqual(registry.listHumanReviewRequiredCapabilities().map((capability) => capability.capabilityId).sort(), [
    'policy.answer',
    'route.risk_explanation',
    'supervisor.daily_operations_report'
  ].sort());
  assert.ok(registry.listBenchmarkRequiredCapabilities().length >= 5);

  const pilot = registry.validateLifecycleTransition(registry.LIFECYCLE_STATES.BENCHMARKING, registry.LIFECYCLE_STATES.PILOT, {});
  assert.strictEqual(pilot.conditionallyAllowed, true);
  assert.strictEqual(pilot.ownerApprovalRequired, true);
  const production = registry.validateLifecycleTransition(registry.LIFECYCLE_STATES.PILOT, registry.LIFECYCLE_STATES.PRODUCTION, {
    ownerApprovalRequired: true,
    benchmarkEvidenceRequired: true,
    rollbackPlanRequired: true,
    securityReviewRequired: true,
    costGovernanceRequired: true,
    policyApprovalRequired: true,
    dataReadinessRequired: true,
    executorAvailabilityRequired: true
  });
  assert.strictEqual(production.allowed, true);
  assert.strictEqual(registry.validateLifecycleTransition(registry.LIFECYCLE_STATES.RETIRED, registry.LIFECYCLE_STATES.PRODUCTION).allowed, false);

  assert.strictEqual(registry.resolveAlias('text.cleanup'), 'text.cleanup');
  expectInvalid('DUPLICATE_CAPABILITY_ID', (items) => { items[1].capabilityId = items[0].capabilityId; });
  expectInvalid('INVALID_CAPABILITY_ID', (items) => { items[0].capabilityId = 'Bad ID'; });
  expectInvalid('PROVIDER_OR_MODEL_IN_CAPABILITY_ID', (items) => { items[0].capabilityId = 'openai.cleanup'; });
  expectInvalid('INVALID_ENUM_VALUE', (items) => { items[0].lifecycleState = 'ACTIVE'; });
  expectInvalid('RETIRED_CAPABILITY_ENABLED', (items) => { items[0].lifecycleState = 'RETIRED'; items[0].enabled = true; });
  expectInvalid('PRODUCTION_NOT_IMPLEMENTED', (items) => { items[0].lifecycleState = 'PRODUCTION'; items[0].implementationStatus = 'NOT_IMPLEMENTED'; });
  expectInvalid('DEFAULT_STRATEGY_NOT_ALLOWED', (items) => { items[0].defaultExecutionStrategy = EXECUTION_STRATEGIES.HOSTED_BALANCED_MODEL; });
  expectInvalid('STRATEGY_OVERLAP', (items) => { items[0].prohibitedExecutionStrategies.push(items[0].allowedExecutionStrategies[0]); });
  expectInvalid('PREMIUM_TIER_CONFLICT', (items) => { items[0].premiumAllowed = true; });
  expectInvalid('HUMAN_REVIEW_NOT_ALLOWED', (items) => { items[0].humanReviewRequired = true; items[0].humanReviewAllowed = false; });
  expectInvalid('AUTONOMOUS_ACTION_UNAPPROVED', (items) => { items[0].autonomousActionAllowed = true; });
  expectInvalid('UNKNOWN_DEPENDENCY', (items) => { items[0].upstreamCapabilityIds = ['missing.capability']; });
  expectInvalid('SELF_DEPENDENCY', (items) => { items[0].upstreamCapabilityIds = [items[0].capabilityId]; });
  expectInvalid('DEPENDENCY_CYCLE', (items) => { items[0].upstreamCapabilityIds = [items[1].capabilityId]; items[1].upstreamCapabilityIds = [items[0].capabilityId]; });
  expectInvalid('UNKNOWN_REPLACEMENT', (items) => { items[0].replacementCapabilityId = 'missing.replacement'; });
  expectInvalid('SELF_REPLACEMENT', (items) => { items[0].replacementCapabilityId = items[0].capabilityId; });
  expectInvalid('ALIAS_COLLISION', (items) => { items[0].aliases = [items[1].capabilityId]; });
  expectInvalid('NEGATIVE_LATENCY', (items) => { items[0].targetLatencyMs = -1; });
  expectInvalid('INVALID_MICRO_USD', (items) => { items[0].provisionalCostCeilingMicroUsd = 0.1; });
  expectInvalid('NEGATIVE_COST', (items) => { items[0].provisionalCostCeilingMicroUsd = -1; });
  expectInvalid('UNKNOWN_COST_AS_ZERO', (items) => { items[1].costClass = 'UNKNOWN'; items[1].provisionalCostCeilingMicroUsd = 0; });
  expectInvalid('ACTIVE_CAPABILITY_WITHOUT_EVIDENCE', (items) => { items[0].sourceFiles = []; });
  expectInvalid('AUTHORITATIVE_OUTPUT_WITHOUT_SOURCE', (items) => { items[0].authoritativeSources = []; });
  expectInvalid('CROSS_ORG_EVIDENCE_REQUIRED', (items) => { items[0].crossOrganizationUseAllowed = true; });

  const before = readGenerated();
  const checkResult = generate({ check: true });
  assert.deepStrictEqual(checkResult.changed, []);
  assert.deepStrictEqual(readGenerated(), before);

  const runtimeIds = runtimeRegistry.listCapabilities().map((capability) => capability.id).sort();
  assert.deepStrictEqual(runtimeIds, ids.sort());
  assert.strictEqual(runtimeRegistry.getCapability('text.cleanup').active, true);
  assert.strictEqual(runtimeRegistry.getCapability('legacy.ai.structured_response').active, true);
  assert.strictEqual(runtimeRegistry.getCapability('supervisor.daily_operations_report').active, true);
  assert.strictEqual(runtimeRegistry.getCapability('delivery_note.summarize').active, false);
  assert.strictEqual(runtimeRegistry.getCapability('policy.answer').active, false);
  assert.strictEqual(runtimeRegistry.getCapability('route.risk_explanation').active, false);
  assert.deepStrictEqual(runtimeRegistry.getCapability('text.cleanup').allowedExecutionStrategies, [EXECUTION_STRATEGIES.DETERMINISTIC_RULES]);
  assert.strictEqual(runtimeRegistry.getCapability('legacy.ai.structured_response').defaultExecutionProfile, 'BALANCED');

  console.log('[test:capability-registry] enterprise registry validation, queries, lifecycle transitions, artifacts, and IEP compatibility verified.');
}

main();