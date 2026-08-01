#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const decisions = require('../services/intelligenceExecution/executionDecisionEngine');
const scoring = require('../services/intelligenceExecution/scoringEngine');
const cost = require('../services/intelligenceExecution/costGovernance');
const { generate } = require('./generate-execution-decision-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'execution-decision-engine', 'generated');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readGenerated() {
  if (!fs.existsSync(generatedDir)) return [];
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function assertRule(validation, rule) {
  assert.strictEqual(validation.valid, false, `expected invalid validation for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function expectPolicyInvalid(rule, mutate) {
  const profile = clone(decisions.getDecisionPolicyProfile('CHEAPEST_SUFFICIENT_TEST_POLICY', '0.1.0'));
  mutate(profile);
  assertRule(decisions.validateDecisionPolicyProfile(profile, [profile]), rule);
}

function expectRequestInvalid(rule, mutate) {
  const request = clone(decisions.getDecisionRequest('decision.text_cleanup.initial.offline.v1'));
  mutate(request);
  assertRule(decisions.validateDecisionRequest(request, { requests: [request] }), rule);
}

function assertNoProhibitedOutput(value) {
  const text = JSON.stringify(value);
  assert.ok(!/"bestValue"\s*:/.test(text), 'decision output must not expose best-value fields');
  assert.ok(!/"winner"\s*:/.test(text), 'decision output must not expose winner fields');
  assert.ok(!/"procurementRecommendation"\s*:/.test(text), 'decision output must not expose procurement recommendation fields');
  assert.ok(!/"productionRecommendation"\s*:/.test(text), 'decision output must not expose production recommendation fields');
  assert.ok(!/"providerRanking"\s*:/.test(text), 'decision output must not expose provider ranking fields');
}

function main() {
  assert.strictEqual(decisions.DECISION_ENGINE_VERSION, 'intelligence.execution.decision.engine.v1');
  assert.strictEqual(decisions.DECISION_REQUEST_SCHEMA_VERSION, 'intelligence.execution.decision.request.v1');
  assert.strictEqual(decisions.DECISION_POLICY_PROFILE_SCHEMA_VERSION, 'intelligence.execution.decision.policy.profile.v1');
  assert.strictEqual(decisions.DECISION_RECORD_SCHEMA_VERSION, 'intelligence.execution.decision.record.v1');

  assert.ok(scoring.validateScoreRun(scoring.calculateScoreRun('score.structured_output.initial.offline.v1')).valid);
  assert.ok(cost.validateCostGovernanceRun(cost.calculateCostGovernanceRun('cost.text_cleanup.initial.offline.v1')).valid);

  const profiles = decisions.loadDecisionPolicyProfiles();
  assert.strictEqual(profiles.length, 5);
  for (const profile of profiles) {
    const validation = decisions.validateDecisionPolicyProfile(profile);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(profile.testOnly, true);
    assert.strictEqual(profile.productionUseAllowed, false);
    assert.strictEqual(profile.criticalGatePolicy.safetyOverrideAllowed, false);
    assert.ok(profile.allowedStrategies.length > 0);
  }
  expectPolicyInvalid('INVALID_LIFECYCLE', (profile) => { profile.lifecycleState = 'ACTIVE'; });
  expectPolicyInvalid('PRODUCTION_APPROVED_SYNTHETIC_PROFILE', (profile) => { profile.productionUseAllowed = true; });
  expectPolicyInvalid('INVENTED_OWNER_APPROVAL', (profile) => { profile.approvedBy = 'owner'; });
  expectPolicyInvalid('UNKNOWN_STRATEGY', (profile) => { profile.allowedStrategies.push('MAGIC_STRATEGY'); });
  expectPolicyInvalid('DUPLICATE_STRATEGY_PREFERENCE', (profile) => { profile.defaultStrategyPreferenceOrder.push(profile.defaultStrategyPreferenceOrder[0]); });
  expectPolicyInvalid('CONTRADICTORY_PREMIUM_RULES', (profile) => { profile.premiumStrategyPolicy.premiumAllowed = true; profile.premiumStrategyPolicy.requiresExplicitApproval = false; });
  expectPolicyInvalid('SAFETY_OVERRIDE_PERMITTED', (profile) => { profile.criticalGatePolicy.safetyOverrideAllowed = true; });
  expectPolicyInvalid('MISSING_UNKNOWN_COST_POLICY', (profile) => { delete profile.costPolicy.unknownCostPolicy; });

  const requests = decisions.loadDecisionRequests();
  assert.strictEqual(requests.length, 4);
  for (const request of requests) {
    const validation = decisions.validateDecisionRequest(request);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(request.dryRun, true);
    assert.strictEqual(request.simulationOnly, true);
    assert.strictEqual(request.productionExecutionRequested, false);
    assert.strictEqual(request.liveProviderExecutionRequested, false);
  }
  expectRequestInvalid('UNKNOWN_CAPABILITY', (request) => { request.capabilityId = 'missing.capability'; });
  expectRequestInvalid('INVALID_CAPABILITY_VERSION', (request) => { request.capabilityVersion = 'wrong.version'; });
  expectRequestInvalid('UNKNOWN_DECISION_POLICY_PROFILE', (request) => { request.decisionPolicyProfileId = 'MISSING_POLICY'; });
  expectRequestInvalid('INVALID_SCORE_EVIDENCE_REFERENCE', (request) => { request.scoreRunIds = ['score.missing']; });
  expectRequestInvalid('INVALID_COST_EVIDENCE_REFERENCE', (request) => { request.costGovernanceRunIds = ['cost.missing']; });
  expectRequestInvalid('CONTRADICTORY_REQUIREMENTS', (request) => { request.requiredStrategies = ['CACHE']; request.prohibitedStrategies = ['CACHE']; });
  expectRequestInvalid('PRODUCTION_EXECUTION_REQUEST_PROHIBITED', (request) => { request.productionExecutionRequested = true; });
  expectRequestInvalid('LIVE_PROVIDER_EXECUTION_PROHIBITED', (request) => { request.liveProviderExecutionRequested = true; });
  expectRequestInvalid('UNAUTHORIZED_PREMIUM_REQUEST', (request) => { request.premiumExecutionAllowed = true; });

  const records = decisions.runInitialDecisions();
  assert.strictEqual(records.length, 4);
  for (const record of records) {
    const validation = decisions.validateDecisionRecord(record);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(record.testOnly, true);
    assert.strictEqual(record.advisoryOnly, true);
    assert.strictEqual(record.productionUseAllowed, false);
    assert.ok(record.enumeratedCandidates.length > 0);
    assert.ok(record.decisionConfidence);
    assert.ok(record.decisionCompleteness);
    assert.ok(record.counterfactualTrace.length > 0);
    assert.ok(record.sensitivityAnalysis.length > 0);
    assertNoProhibitedOutput(record);
  }

  assert.ok(records.some((record) => record.decisionOutcome === decisions.DECISION_OUTCOMES.SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK));
  assert.ok(records.some((record) => record.decisionOutcome === decisions.DECISION_OUTCOMES.HUMAN_REVIEW_REQUIRED));
  assert.ok(records.some((record) => record.decisionOutcome === decisions.DECISION_OUTCOMES.DEFER_PENDING_EVIDENCE));
  assert.ok(records.some((record) => record.enumeratedCandidates.some((candidate) => candidate.strategyId === decisions.DECISION_STRATEGIES.DETERMINISTIC_RULES)));
  assert.ok(records.some((record) => record.enumeratedCandidates.some((candidate) => candidate.strategyId === decisions.DECISION_STRATEGIES.HOSTED_BALANCED)));
  assert.ok(decisions.listHumanReviewDecisions().length > 0);
  assert.ok(decisions.listInsufficientEvidenceDecisions().length > 0);
  assert.ok(decisions.listFallbackPlans().some((item) => item.fallbackPlan.length > 0));
  assert.ok(decisions.verifyDeterministicReplay(records[0].decisionRequestId).equal);
  assert.ok(decisions.inspectTieBreakTrace(records.find((record) => record.advisorySelectedCandidateId)?.decisionRequestId));
  assert.ok(decisions.inspectFallbackTrace(records.find((record) => record.fallbackPlan.length > 0)?.decisionRequestId));

  const selectedRecord = records.find((record) => record.advisorySelectedCandidateId);
  assert.ok(selectedRecord, 'expected at least one advisory selected candidate');
  const selectedCandidate = decisions.inspectCandidateTrace(selectedRecord.advisorySelectedCandidateId);
  assert.ok(selectedCandidate);
  assert.ok([decisions.FEASIBILITY_STATUSES.FEASIBLE, decisions.FEASIBILITY_STATUSES.CONDITIONALLY_FEASIBLE].includes(selectedCandidate.feasibilityStatus));

  const mutated = clone(selectedRecord);
  mutated.productionUseAllowed = true;
  mutated.decisionRecordHash = decisions.decisionRecordHash(mutated);
  assert.strictEqual(decisions.validateDecisionRecord(mutated).valid, false);

  const prohibited = clone(selectedRecord);
  prohibited.bestValue = true;
  prohibited.decisionRecordHash = decisions.decisionRecordHash(prohibited);
  assert.strictEqual(decisions.validateDecisionRecord(prohibited).valid, false);

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);

  console.log('[test:execution-decisions] policy profiles, requests, advisory decisions, fallbacks, counterfactuals, sensitivity, generated artifacts, and production-safety boundaries verified.');
}

main();
