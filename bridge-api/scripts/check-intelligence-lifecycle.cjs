#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lifecycle = require('../services/intelligenceExecution/intelligenceLifecycleFramework');
const { generate } = require('./generate-intelligence-lifecycle-artifacts.cjs');

const outDir = lifecycle.paths.generatedRoot;
function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}
function expectInvalid(rule, mutate) {
  const evidence = lifecycle.buildLifecycleEvidence();
  const changed = mutate(JSON.parse(JSON.stringify(evidence)));
  const validation = lifecycle.validateLifecycle(changed);
  assert.strictEqual(validation.valid, false, `expected invalid ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}
function assertNoRuntime(value) {
  const text = JSON.stringify(value);
  for (const pattern of [/providerCallInvoked"\s*:\s*true/, /runtimeExecution/i, /productionApplicable"\s*:\s*true/, /predictive models? implemented/i, /migrationExecuted|deploymentExecuted/i]) assert.ok(!pattern.test(text), `prohibited runtime marker found ${pattern}`);
}
function main() {
  assert.strictEqual(lifecycle.LIFECYCLE_SCHEMA_VERSION, 'intelligence.lifecycle.framework.v1');
  assert.strictEqual(lifecycle.LIFECYCLE_ENGINE_VERSION, 'intelligence.lifecycle.framework.engine.v1');
  assert.strictEqual(lifecycle.isLegalTransition('DESIGNED', 'REGISTERED'), true);
  assert.strictEqual(lifecycle.isLegalTransition('DRAFT', 'PRODUCTION'), false);
  const evidence = lifecycle.buildLifecycleEvidence();
  const again = lifecycle.buildLifecycleEvidence();
  assert.deepStrictEqual(again, evidence, 'lifecycle evidence must be deterministic');
  const validation = lifecycle.validateLifecycle(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.strictEqual(evidence.lifecycleRecords.length, 12);
  assert.strictEqual(evidence.maturityMatrix.length, 12);
  assert.strictEqual(evidence.readinessMatrix.length, 12);
  assert.strictEqual(evidence.learningPolicies.length, 12);
  assert.strictEqual(evidence.versionEvolution.length, 12);
  assert.ok(evidence.maturityMatrix.every((item) => lifecycle.MATURITY_DIMENSIONS.every((dimension) => Object.prototype.hasOwnProperty.call(item.dimensions, dimension))));
  assert.ok(evidence.learningPolicies.every((item) => item.learningAllowed === false && item.learningProhibited === true));
  assertNoRuntime(evidence);
  expectInvalid('DUPLICATE_LIFECYCLE_ID', (item) => { item.lifecycleRecords[1].lifecycleId = item.lifecycleRecords[0].lifecycleId; return item; });
  expectInvalid('UNKNOWN_LIFECYCLE_STATE', (item) => { item.lifecycleRecords[0].currentState = 'UNKNOWN'; return item; });
  expectInvalid('INVALID_TRANSITION', (item) => { item.lifecycleRecords[0].previousState = 'DRAFT'; item.lifecycleRecords[0].currentState = 'PRODUCTION'; return item; });
  expectInvalid('DUPLICATE_MATURITY_ID', (item) => { item.maturityMatrix[1].maturityId = item.maturityMatrix[0].maturityId; return item; });
  expectInvalid('MISSING_READINESS', (item) => { delete item.readinessMatrix[0].dataReadiness; return item; });
  expectInvalid('INVALID_LEARNING_POLICY', (item) => { item.learningPolicies[0].learningAllowed = true; return item; });
  expectInvalid('MISSING_VERSION', (item) => { item.versionEvolution[0].currentVersion = null; return item; });
  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:intelligence-lifecycle] lifecycle transitions, maturity, readiness, learning policy, version evolution, determinism, artifacts, and runtime-safety boundaries verified.');
}
main();
