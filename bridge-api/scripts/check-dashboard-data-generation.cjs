#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dashboards = require('../services/intelligenceExecution/dashboardDataGeneration');
const { generate } = require('./generate-dashboard-data-artifacts.cjs');

const outDir = dashboards.paths.dashboardDataRoot;

function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}
function expectInvalid(rule, baseDashboards, mutate) {
  const changed = mutate(JSON.parse(JSON.stringify(baseDashboards)));
  const validation = dashboards.validateDashboards(changed);
  assert.strictEqual(validation.valid, false, `expected invalid ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}
function assertNoRuntimeFields(value) {
  const text = JSON.stringify(value);
  for (const key of dashboards.PROHIBITED_KEYS) assert.ok(!new RegExp(`"${key}"\\s*:`).test(text), `${key} must not appear in dashboard data`);
  assert.ok(!/providerCallInvoked|databaseWritePerformed|migrationExecuted|deploymentExecuted/.test(text), 'dashboard data must not include runtime execution claims');
}
function main() {
  assert.strictEqual(dashboards.DASHBOARD_SCHEMA_VERSION, 'intelligence.dashboard.dataset.v1');
  assert.strictEqual(dashboards.DASHBOARD_ENGINE_VERSION, 'intelligence.dashboard.generation.engine.v1');
  assert.strictEqual(dashboards.DETERMINISTIC_GENERATED_AT, '2026-07-25T00:00:00.000Z');

  const all = dashboards.buildDashboards();
  const again = dashboards.buildDashboards();
  assert.deepStrictEqual(again, all, 'dashboard generation must be deterministic');
  assert.strictEqual(all.length, 30);
  assert.deepStrictEqual(new Set(all.map((dashboard) => dashboard.dashboardId)).size, all.length);
  assert.strictEqual(dashboards.validateDashboards(all).valid, true, JSON.stringify(dashboards.validateDashboards(all).errors, null, 2));
  assertNoRuntimeFields(all);

  for (const dashboard of all) {
    assert.strictEqual(dashboard.schemaVersion, dashboards.DASHBOARD_SCHEMA_VERSION);
    assert.strictEqual(dashboard.generatedAt, dashboards.DETERMINISTIC_GENERATED_AT);
    assert.strictEqual(dashboard.testOnly, true);
    assert.strictEqual(dashboard.productionApplicable, false);
    assert.ok(dashboard.generationHash);
    assert.ok(dashboard.sourceSubsystems.length);
    assert.ok(dashboard.authoritativeSources.length);
    assert.ok(dashboard.documentationReferences.length);
    assert.ok(dashboard.generatedArtifacts.length);
  }

  for (const id of ['executive.summary','capability.overview','capability.coverage','capability.lifecycle','benchmark.dataset','evaluation.runs','execution.strategy','scoring.overview','cost.governance','budget.overview','execution.decision','decision.history','governance.overview','human.review','exception.overview','findings.overview','attestation.overview','knowledge.graph','dependency.overview','impact.analysis','validation.overview','test.coverage','documentation.overview','generated.artifacts','repository.health','technical.debt','owner.decisions','deferred.work','platform.readiness','overall.platform']) {
    assert.ok(all.some((dashboard) => dashboard.dashboardId === id), `missing dashboard ${id}`);
  }
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'knowledge.graph').summary.valid);
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'dependency.overview').statistics.nodesWithDependencies >= 0);
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'impact.analysis').statistics.impactedNodes >= 0);
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'execution.decision').statistics.policyUsage);
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'cost.governance').statistics.unknownCosts >= 0);
  assert.ok(all.find((dashboard) => dashboard.dashboardId === 'governance.overview').statistics.review);

  const catalog = dashboards.buildCatalog(all);
  assert.strictEqual(catalog.length, all.length);
  const hashes = dashboards.dashboardHashes(all);
  assert.strictEqual(Object.keys(hashes).length, all.length);
  assert.ok(dashboards.REQUIRED_ARTIFACTS.every((name) => name.endsWith('.json') || name.endsWith('.csv') || name.endsWith('.md')));

  expectInvalid('DUPLICATE_DASHBOARD_ID', all, (items) => { items[1].dashboardId = items[0].dashboardId; return items; });
  expectInvalid('UNKNOWN_DASHBOARD_SCHEMA', all, (items) => { items[0].schemaVersion = 'bad'; return items; });
  expectInvalid('NON_DETERMINISTIC_GENERATED_AT', all, (items) => { items[0].generatedAt = new Date().toISOString(); return items; });
  expectInvalid('MISSING_GENERATION_HASH', all, (items) => { delete items[0].generationHash; return items; });
  expectInvalid('MISSING_SOURCE_REFERENCES', all, (items) => { items[0].sourceSubsystems = []; return items; });
  expectInvalid('PRODUCTION_DASHBOARD_PROHIBITED', all, (items) => { items[0].productionApplicable = true; return items; });
  expectInvalid('PROHIBITED_RUNTIME_FIELD', all, (items) => { items[0].providerCallInvoked = true; return items; });
  expectInvalid('GENERATION_HASH_MISMATCH', all, (items) => { items[0].summary.mutated = true; return items; });

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:dashboard-data] deterministic dashboard datasets, catalog, hashes, validation, subsystem linkages, stale artifacts, and runtime-safety boundaries verified.');
}
main();
