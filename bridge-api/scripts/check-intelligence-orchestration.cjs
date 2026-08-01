#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const orchestration = require('../services/intelligenceExecution/intelligenceCapabilityOrchestration');
const { generate } = require('./generate-intelligence-orchestration-artifacts.cjs');

const outDir = orchestration.paths.generatedRoot;
function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}
function expectInvalid(rule, mutate) {
  const evidence = orchestration.buildOrchestrationEvidence();
  const changed = mutate(JSON.parse(JSON.stringify(evidence)));
  const validation = orchestration.validateOrchestration(changed);
  assert.strictEqual(validation.valid, false, `expected invalid ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}
function assertNoRuntimeExecution(value) {
  const text = JSON.stringify(value);
  for (const pattern of [/providerCallInvoked"\s*:\s*true/, /runtimeExecutionInvoked"\s*:\s*true/, /productionApplicable"\s*:\s*true/, /predictiveModel|LLM prompt|publicEndpoint|deploymentExecuted|migrationExecuted/i]) {
    assert.ok(!pattern.test(text), `prohibited runtime or production marker found: ${pattern}`);
  }
}
function main() {
  assert.strictEqual(orchestration.ORCHESTRATION_SCHEMA_VERSION, 'intelligence.capability.orchestration.v1');
  assert.strictEqual(orchestration.ORCHESTRATION_ENGINE_VERSION, 'intelligence.capability.orchestration.engine.v1');
  const evidence = orchestration.buildOrchestrationEvidence();
  const again = orchestration.buildOrchestrationEvidence();
  assert.deepStrictEqual(again, evidence, 'orchestration evidence must be deterministic');
  assert.strictEqual(evidence.capabilities.length, 12);
  assert.strictEqual(evidence.contracts.length, evidence.capabilities.length);
  assert.strictEqual(evidence.plans.length, evidence.capabilities.length);
  assert.strictEqual(orchestration.validateOrchestration(evidence).valid, true, JSON.stringify(orchestration.validateOrchestration(evidence).errors, null, 2));
  assertNoRuntimeExecution(evidence);
  assert.ok(orchestration.DOMAINS.every((domain) => evidence.capabilities.some((capability) => capability.businessDomain === domain)));
  assert.ok(evidence.capabilities.every((capability) => capability.registeredWithEnterpriseCapabilityRegistry));
  assert.ok(evidence.capabilities.every((capability) => capability.documentationReferences.length));
  assert.ok(evidence.contracts.every((contract) => contract.inputSchema && contract.outputSchema && contract.contractHash));
  assert.ok(evidence.plans.every((plan) => plan.handsToIntelligenceExecutionPlatform && plan.runtimeExecutionInvoked === false && plan.providerCallInvoked === false));
  assert.ok(orchestration.capabilityReadiness(evidence).every((item) => item.executionContractPresent && item.executionPlanTemplatePresent));

  expectInvalid('DUPLICATE_CAPABILITY_ID', (item) => { item.capabilities[1].capabilityId = item.capabilities[0].capabilityId; return item; });
  expectInvalid('DUPLICATE_CAPABILITY_NAME', (item) => { item.capabilities[1].displayName = item.capabilities[0].displayName; return item; });
  expectInvalid('UNKNOWN_LIFECYCLE_STATE', (item) => { item.capabilities[0].lifecycleState = 'LIVE_PRODUCTION'; return item; });
  expectInvalid('UNKNOWN_DATA_SOURCE', (item) => { item.capabilities[0].requiredDataSources.push('Unknown Runtime Source'); return item; });
  expectInvalid('INVALID_DEPENDENCY_CHAIN', (item) => { item.capabilities[0].dependencies.push('missing.capability'); return item; });
  expectInvalid('MISSING_EXECUTION_CONTRACT', (item) => { item.contracts = item.contracts.slice(1); return item; });
  expectInvalid('MISSING_DOCUMENTATION', (item) => { item.capabilities[0].documentationReferences = []; return item; });
  expectInvalid('RUNTIME_EXECUTION_PROHIBITED', (item) => { item.plans[0].providerCallInvoked = true; return item; });

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:intelligence-orchestration] capability metadata, execution contracts, plan templates, dependencies, readiness, determinism, artifacts, and runtime-safety boundaries verified.');
}
main();
