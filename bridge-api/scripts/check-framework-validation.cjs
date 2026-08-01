#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const framework = require('../services/intelligenceExecution/frameworkValidation');
const { generate } = require('./generate-framework-validation-artifacts.cjs');

const outDir = framework.paths.generatedRoot;
function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}
function assertNoProductionClaims(value) {
  const text = JSON.stringify(value);
  for (const pattern of [
    /"productionApplicable"\s*:\s*true/,
    /"productionReadinessClaimed"\s*:\s*true/,
    /providerCallInvoked|databaseWritePerformed|migrationExecuted|deploymentExecuted|runtimeExecution/
  ]) assert.ok(!pattern.test(text), `prohibited production/runtime claim found: ${pattern}`);
}
function main() {
  assert.strictEqual(framework.FRAMEWORK_VALIDATION_SCHEMA_VERSION, 'intelligence.framework.validation.v1');
  assert.strictEqual(framework.FRAMEWORK_VALIDATION_ENGINE_VERSION, 'intelligence.framework.validation.engine.v1');
  assert.strictEqual(framework.DETERMINISTIC_GENERATED_AT, '2026-07-25T00:00:00.000Z');

  const result = framework.buildFrameworkValidation();
  const again = framework.buildFrameworkValidation();
  const determinism = framework.determinismReport(result, again);
  const validation = framework.validateFramework(result);
  assert.strictEqual(determinism.identical, true, JSON.stringify(determinism, null, 2));
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.strictEqual(result.inventory.length, framework.SUBSYSTEM_ORDER.length);
  assert.ok(result.integration.every((row) => row.integrated));
  assert.ok(result.crossReferences.every((row) => row.valid));
  assert.ok(result.health.totals.capabilities > 0);
  assert.ok(result.health.totals.benchmarkDatasets > 0);
  assert.ok(result.health.totals.evaluations > 0);
  assert.ok(result.health.totals.scoreRuns > 0);
  assert.ok(result.health.totals.executionDecisions > 0);
  assert.ok(result.health.totals.historyRecords > 0);
  assert.ok(result.health.totals.governanceEvents > 0);
  assert.ok(result.health.totals.graphNodes > 0);
  assert.ok(result.health.totals.graphEdges > 0);
  assert.strictEqual(result.health.totals.dashboardDatasets, 30);
  assert.ok(result.readiness.every((item) => framework.READINESS_STATES.includes(item.readiness)));
  assert.ok(result.scorecard.every((item) => item.advisoryOnly === true && item.productionCertificationClaimed === false));
  assertNoProductionClaims(result);

  const broken = JSON.parse(JSON.stringify(result));
  broken.integration[0].integrated = false;
  assert.strictEqual(framework.validateFramework(broken).valid, false);
  assert.ok(framework.validateFramework(broken).errors.some((error) => error.rule === 'BROKEN_INTEGRATION_REFERENCE'));

  const before = readGenerated();
  const generated = generate({ check: true, result, secondResult: again });
  assert.deepStrictEqual(generated.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:framework-validation] subsystem inventory, integration matrix, cross-references, repository health, readiness, quality scorecard, determinism, artifacts, and runtime-safety boundaries verified.');
}
main();
