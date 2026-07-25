#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const engine = require('../services/intelligenceExecution/evaluationEngine');
const benchmarkFramework = require('../services/intelligenceExecution/benchmarkDatasetFramework');
const { EXECUTION_STRATEGIES } = require('../services/intelligenceExecution/constants');
const { generate } = require('./generate-execution-evaluation-artifacts.cjs');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'execution-strategy-evaluation-engine', 'generated');

function mutateRequest(runId, mutate) {
  const request = JSON.parse(JSON.stringify(engine.getEvaluationRequest(runId)));
  mutate(request);
  return request;
}

function assertInvalid(ruleName, request) {
  const validation = engine.validateEvaluationRequest(request, { requests: [request] });
  assert.strictEqual(validation.valid, false, `expected invalid request for ${ruleName}`);
  assert.ok(validation.errors.some((error) => error.rule === ruleName), `expected ${ruleName}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function readGenerated() {
  if (!fs.existsSync(generatedDir)) return [];
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function assertNoForbiddenArtifacts(value) {
  const text = JSON.stringify(value);
  assert.ok(!/"score"\s*:/.test(text), 'evaluation artifacts must not expose score fields');
  assert.ok(!/"weightedScore"\s*:/.test(text), 'evaluation artifacts must not expose weighted scores');
  assert.ok(!/"bestStrategy"\s*:/.test(text), 'evaluation artifacts must not expose best strategy');
  assert.ok(!/"recommendation"\s*:/.test(text), 'evaluation artifacts must not expose recommendations');
}

function assertRetiredDatasetFails() {
  const request = mutateRequest('eval.text.cleanup.core.offline.v1', () => {});
  const dataset = benchmarkFramework.getDataset('text.cleanup.benchmark.core');
  const retired = JSON.parse(JSON.stringify(dataset));
  retired.lifecycleState = benchmarkFramework.DATASET_LIFECYCLE_STATES.RETIRED;
  const original = benchmarkFramework.listDatasets;
  benchmarkFramework.listDatasets = () => [retired];
  try {
    const result = engine.validateEvaluationRequest(request, { requests: [request] });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.rule === 'RETIRED_DATASET'), `expected RETIRED_DATASET, got ${result.errors.map((error) => error.rule).join(', ')}`);
  } finally {
    benchmarkFramework.listDatasets = original;
  }
}
function main() {
  assert.strictEqual(engine.REQUEST_SCHEMA_VERSION, 'execution.evaluation.request.v1');
  assert.strictEqual(engine.PLAN_SCHEMA_VERSION, 'execution.evaluation.plan.v1');
  assert.strictEqual(engine.RUN_SCHEMA_VERSION, 'execution.evaluation.run.v1');
  assert.strictEqual(engine.OBSERVATION_SCHEMA_VERSION, 'execution.evaluation.observation.v1');

  const requests = engine.loadEvaluationRequests();
  assert.strictEqual(requests.length, 3);
  for (const request of requests) {
    const validation = engine.validateEvaluationRequest(request);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(request.productionDataUsed, false);
    assert.strictEqual(request.controls.offlineOnly, true);
    assert.strictEqual(request.controls.allowHostedExecution, false);
    assert.strictEqual(request.controls.allowPremiumExecution, false);
  }

  assertInvalid('UNKNOWN_CAPABILITY', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.capabilityId = 'missing.capability'; }));
  assertInvalid('UNKNOWN_DATASET', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.datasetId = 'missing.dataset.benchmark.core'; }));
  assertInvalid('INCOMPATIBLE_CAPABILITY_DATASET', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.datasetId = 'legacy.ai.structured_response.benchmark.schema_compliance'; }));
  assertInvalid('UNKNOWN_STRATEGY', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.candidates[0].strategy = 'MADE_UP_STRATEGY'; }));
  assertInvalid('UNKNOWN_EXECUTOR', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.candidates[0].executorId = 'missing.executor'; }));
  assertInvalid('HOSTED_EXECUTION_WITHOUT_AUTHORIZATION', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.candidates[3].authorizedMockExecution = false; }));
  assertInvalid('PREMIUM_EXECUTION_WITHOUT_AUTHORIZATION', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.candidates[0].strategy = EXECUTION_STRATEGIES.HOSTED_PREMIUM_MODEL; }));
  assertInvalid('HUMAN_REVIEW_WITHOUT_AUTHORIZATION', mutateRequest('eval.text.cleanup.core.offline.v1', (request) => { request.candidates[0].strategy = EXECUTION_STRATEGIES.HUMAN_REVIEW; request.candidates[0].authorizedMockExecution = false; }));

  assertRetiredDatasetFails();


  const textPlan = engine.createEvaluationPlan(engine.getEvaluationRequest('eval.text.cleanup.core.offline.v1'));
  const textPlanAgain = engine.createEvaluationPlan(engine.getEvaluationRequest('eval.text.cleanup.core.offline.v1'));
  assert.strictEqual(textPlan.planHash, textPlanAgain.planHash);
  assert.deepStrictEqual(textPlan.planItems.map((item) => item.planItemId), textPlanAgain.planItems.map((item) => item.planItemId));
  assert.ok(textPlan.planItems.some((item) => item.eligible));
  assert.ok(textPlan.planItems.some((item) => item.plannedResultClass === engine.RESULT_CLASSES.UNAUTHORIZED));

  const normalizedText = engine.normalizeExecutorOutput('text.cleanup', { normalizedText: 'Dock door ready', changed: true, originalLength: 21, normalizedLength: 15 });
  assert.strictEqual(normalizedText.normalizedOutput.normalizedText, 'Dock door ready');
  const malformed = engine.normalizeExecutorOutput('legacy.ai.structured_response', '{"missing":');
  assert.strictEqual(malformed.malformed, true);

  const runs = engine.runInitialEvaluations();
  assert.strictEqual(runs.length, 3);
  for (const run of runs) {
    const validation = engine.validateEvaluationRun(run);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(run.testOnly, true);
    assert.strictEqual(run.offlineOnly, true);
    assert.strictEqual(run.productionDataUsed, false);
    assert.ok(run.replay.replayable);
    assertNoForbiddenArtifacts(run);
  }

  assert.ok(runs.some((run) => run.results.some((result) => result.rawOutputHash && result.normalizedOutputHash)));
  assert.ok(runs.some((run) => run.results.some((result) => result.resultClass === engine.RESULT_CLASSES.SCHEMA_ERROR)));
  assert.ok(runs.some((run) => run.results.some((result) => result.resultClass === engine.RESULT_CLASSES.TIMEOUT)));
  assert.ok(runs.some((run) => run.results.some((result) => result.resultClass === engine.RESULT_CLASSES.EXECUTOR_ERROR)));
  assert.ok(runs.some((run) => run.results.some((result) => result.resultClass === engine.RESULT_CLASSES.UNAUTHORIZED)));
  assert.ok(runs.some((run) => run.results.some((result) => result.resultClass === engine.RESULT_CLASSES.PARTIAL_OUTPUT || result.resultClass === engine.RESULT_CLASSES.INSUFFICIENT_EVIDENCE)));
  assert.ok(engine.listPolicyFailures().length > 0);
  assert.ok(engine.listUnknownCostObservations().length > 0);
  assert.strictEqual(engine.listReplayableRuns().length, 3);
  assert.ok(engine.compareRawObservations(runs[0], engine.runEvaluation(runs[0].runId)).equal);

  const negativeDuration = JSON.parse(JSON.stringify(runs[0]));
  negativeDuration.results[0].durationMs = -1;
  negativeDuration.resultHash = engine.sha256({ ...negativeDuration, resultHash: undefined });
  assert.strictEqual(engine.validateEvaluationRun(negativeDuration).valid, false);

  const unknownZero = JSON.parse(JSON.stringify(runs[0]));
  unknownZero.results[0].cost = { knowledgeStatus: 'UNKNOWN', estimatedCostMicroUsd: 0, actualCostMicroUsd: null, source: 'BAD' };
  unknownZero.resultHash = engine.sha256({ ...unknownZero, resultHash: undefined });
  assert.strictEqual(engine.validateEvaluationRun(unknownZero).valid, false);

  const providerAdapterPath = path.join(backendRoot, 'services', 'intelligenceExecution', 'evaluationEngine.js');
  const engineSource = fs.readFileSync(providerAdapterPath, 'utf8');
  assert.ok(!engineSource.includes('providerAdapters'), 'evaluation engine must not import live provider adapters');
  assert.ok(!engineSource.includes('createStructuredResponse'), 'evaluation engine must not call live AI providers');

  const before = readGenerated();
  const generation = generate({ check: true });
  assert.deepStrictEqual(generation.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  for (const [, content] of before) assertNoForbiddenArtifacts(content);

  console.log('[test:evaluation-engine] offline execution strategy evaluation engine, fixtures, validation, observations, replay, generated artifacts, and safety boundaries verified.');
}

main();

