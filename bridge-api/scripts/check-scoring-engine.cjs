#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const scoring = require('../services/intelligenceExecution/scoringEngine');
const evaluationEngine = require('../services/intelligenceExecution/evaluationEngine');
const { generate } = require('./generate-scoring-engine-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'scoring-engine', 'generated');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectProfileInvalid(rule, mutate) {
  const profile = clone(scoring.getScoringProfile('CORE_BALANCED_TEST_PROFILE', '0.1.0'));
  mutate(profile);
  const validation = scoring.validateScoringProfile(profile, [profile]);
  assert.strictEqual(validation.valid, false, `expected invalid profile for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function expectRequestInvalid(rule, mutate) {
  const request = clone(scoring.getScoringRequest('score.core_balanced.initial.offline.v1'));
  mutate(request);
  const validation = scoring.validateScoringRequest(request, [request]);
  assert.strictEqual(validation.valid, false, `expected invalid request for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function readGenerated() {
  if (!fs.existsSync(generatedDir)) return [];
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function assertNoProhibitedOutput(value) {
  const text = JSON.stringify(value);
  assert.ok(!/"winner"\s*:/.test(text), 'score output must not expose winner fields');
  assert.ok(!/"bestStrategy"\s*:/.test(text), 'score output must not expose best strategy fields');
  assert.ok(!/"recommendedStrategy"\s*:/.test(text), 'score output must not expose recommended strategy fields');
  assert.ok(!/"productionRecommendation"\s*:/.test(text), 'score output must not expose production recommendation fields');
  assert.ok(!/"costPerSuccess"\s*:/.test(text), 'score output must not expose cost per success');
  assert.ok(!/"TCO"\s*:/.test(text), 'score output must not expose TCO');
  assert.ok(!/"ROI"\s*:/.test(text), 'score output must not expose ROI');
}

function main() {
  assert.strictEqual(scoring.SCORING_REQUEST_SCHEMA_VERSION, 'intelligence.scoring.request.v1');
  assert.strictEqual(scoring.SCORING_PROFILE_SCHEMA_VERSION, 'intelligence.scoring.profile.v1');
  assert.strictEqual(scoring.SCORE_RECORD_SCHEMA_VERSION, 'intelligence.score.record.v1');
  assert.ok(scoring.SCORE_DIMENSIONS.CORRECTNESS);
  assert.ok(scoring.SCORE_DIMENSIONS.SAFETY);
  assert.ok(scoring.NORMALIZATION_METHODS.PERCENTAGE);

  const profiles = scoring.loadScoringProfiles();
  assert.strictEqual(profiles.length, 3);
  for (const profile of profiles) {
    const validation = scoring.validateScoringProfile(profile);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(profile.testOnly, true);
    assert.strictEqual(profile.productionUseAllowed, false);
    assert.strictEqual(profile.approvedBy, null);
    assert.strictEqual(profile.dimensions.reduce((sum, item) => sum + item.weight, 0), profile.dimensionWeightTotal);
  }

  expectProfileInvalid('INVALID_LIFECYCLE', (profile) => { profile.lifecycleState = 'ACTIVE'; });
  expectProfileInvalid('NEGATIVE_WEIGHT', (profile) => { profile.dimensions[0].weight = -1; });
  expectProfileInvalid('INVALID_WEIGHT_TOTAL', (profile) => { profile.dimensions[0].weight += 1; });
  expectProfileInvalid('UNSUPPORTED_DIMENSION', (profile) => { profile.dimensions[0].dimensionId = 'MADE_UP'; });
  expectProfileInvalid('UNSUPPORTED_NORMALIZATION', (profile) => { profile.dimensions[0].normalizationMethod = 'MAGIC'; });
  expectProfileInvalid('CRITICAL_DIMENSION_NEUTRALIZED', (profile) => { const d = profile.dimensions.find((item) => item.critical); d.weight = 0; profile.dimensionWeightTotal -= 12; });

  const requests = scoring.loadScoringRequests();
  assert.strictEqual(requests.length, 3);
  for (const request of requests) {
    const validation = scoring.validateScoringRequest(request);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(request.testOnly, true);
    assert.strictEqual(request.productionDataUsed, false);
  }
  expectRequestInvalid('UNKNOWN_PROFILE', (request) => { request.scoringProfileId = 'MISSING_PROFILE'; });
  expectRequestInvalid('UNKNOWN_EVALUATION_RUN', (request) => { request.evaluationRunIds = ['missing.run']; });
  expectRequestInvalid('UNSUPPORTED_OVERRIDE', (request) => { request.profileOverrides = { dimensions: { SAFETY: 0 } }; });
  expectRequestInvalid('UNSUPPORTED_AGGREGATION', (request) => { request.requestedAggregationLevels = ['PRODUCTION']; });
  expectRequestInvalid('CONTRADICTORY_MISSING_DATA_CONTROLS', (request) => { request.includeUnknown = false; request.failOnIncompleteEvidence = false; });

  const runs = scoring.runInitialScoring();
  assert.strictEqual(runs.length, 3);
  for (const run of runs) {
    const validation = scoring.validateScoreRun(run);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(run.testOnly, true);
    assert.strictEqual(run.productionUseAllowed, false);
    assert.ok(run.scoreRecords.length > 0);
    assert.ok(run.aggregates.caseScores.length > 0);
    assert.ok(run.aggregates.datasetScores.length > 0);
    assert.ok(run.aggregates.capabilityScores.length > 0);
    assert.ok(run.aggregates.candidateScores.length > 0);
    assert.ok(run.aggregates.evaluationRunScores.length > 0);
    assert.ok(run.sensitivityAnalysis.length > 0);
    assertNoProhibitedOutput(run);
  }

  const allRecords = runs.flatMap((run) => run.scoreRecords);
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'SAFETY' && dim.score !== null)));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'POLICY_COMPLIANCE' && dim.score !== null)));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'PRIVACY' && dim.status === 'NOT_APPLICABLE')));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'EMPLOYMENT_GOVERNANCE')));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'COST_OBSERVABILITY')));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.dimensionId === 'LATENCY')));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.status === 'UNKNOWN')));
  assert.ok(allRecords.some((record) => record.dimensionScores.some((dim) => dim.status === 'NOT_APPLICABLE')));
  assert.ok(allRecords.some((record) => record.gates.some((gate) => gate.triggered)));
  assert.ok(allRecords.some((record) => record.thresholds.some((threshold) => threshold.status === 'NOT_MET' || threshold.status === 'UNKNOWN')));
  assert.ok(allRecords.some((record) => record.completeness.status !== 'COMPLETE'));
  assert.ok(allRecords.some((record) => ['LOW', 'INSUFFICIENT', 'MODERATE'].includes(record.confidence.status)));
  assert.ok(allRecords.every((record) => record.calculationTrace.sourceObservationIds.length > 0));
  assert.ok(allRecords.every((record) => record.scoreHash === scoring.scoreHash({ ...record, scoreHash: undefined })));
  assert.ok(scoring.listCriticalGateFailures().length > 0);
  assert.ok(scoring.listThresholdFailures().length > 0);
  assert.ok(scoring.listIncompleteScores().length > 0);
  assert.ok(scoring.listUnknownDimensionScores().length > 0);
  assert.ok(scoring.listLowConfidenceScores().length > 0);
  assert.ok(scoring.compareScoreRuns(runs[0], scoring.calculateScoreRun(runs[0].scoringRequestId)).equal);
  assert.ok(scoring.compareScoringProfiles(scoring.getScoringProfile('CORE_BALANCED_TEST_PROFILE'), scoring.getScoringProfile('CORE_BALANCED_TEST_PROFILE')).equal);
  assert.ok(scoring.inspectCalculationTrace(allRecords[0].scoreId));

  const obs = evaluationEngine.runEvaluation('eval.supervisor.daily_operations_report.safety_language.offline.v1').results.flatMap((result) => result.observations.map((observation) => ({ observation, result })));
  assert.ok(obs.some(({ observation, result }) => observation.domain === 'SAFETY' && scoring.mapObservationToDimension(observation, result) === 'SAFETY'));
  assert.ok(obs.some(({ observation, result }) => observation.domain === 'POLICY' && scoring.mapObservationToDimension(observation, result) === 'POLICY_COMPLIANCE'));
  assert.strictEqual(scoring.normalizeMetric({ denominator: 0, matchRate: null }, 'PERCENTAGE').score, null);
  assert.strictEqual(scoring.normalizeMetric({ denominator: 1, matched: 1, failed: 0, unavailable: 0, matchRate: 1 }, 'BINARY_PASS_FAIL').score, 100);
  assert.strictEqual(scoring.normalizeMetric({ denominator: 2, matched: 1, failed: 1, unavailable: 0, matchRate: 0.5 }, 'PERCENTAGE').score, 50);

  const mutated = clone(runs[0]);
  mutated.scoreRecords[0].dimensionScores[0].score = 101;
  mutated.scoreRecords[0].scoreHash = scoring.scoreHash({ ...mutated.scoreRecords[0], scoreHash: undefined });
  mutated.scoreRunHash = scoring.scoreRunHash({ ...mutated, scoreRunHash: undefined });
  assert.strictEqual(scoring.validateScoreRun(mutated).valid, false);

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);

  console.log('[test:scoring-engine] profiles, requests, mappings, metrics, normalization, gates, thresholds, weights, scores, confidence, completeness, sensitivity, artifacts, and boundaries verified.');
}

main();
