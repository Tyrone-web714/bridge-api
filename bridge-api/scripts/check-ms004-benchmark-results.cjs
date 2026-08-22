#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildBenchmarkEvidence, generate, paths } = require('./generate-ms004-benchmark-artifacts.cjs');
const { buildCandidateSelection } = require('./generate-ms003-candidate-selection-artifacts.cjs');
const { buildMs004CandidateExpansion, UNRESOLVED_CAPABILITIES } = require('./ms004-candidate-expansion.cjs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readGeneratedEvidence() {
  const file = path.join(paths.generatedRoot, 'ms004_benchmark_evidence.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateEvidence(evidence) {
  const failures = [];
  const ms003 = buildCandidateSelection();
  const ms004Expansion = buildMs004CandidateExpansion();
  const allowedCapabilities = new Set(Object.keys(ms003.candidatesByCapability));
  const allowedCandidates = new Set([...ms003.candidates, ...ms004Expansion.candidates].map((candidate) => candidate.candidateId));
  const expansionCandidateIds = new Set(ms004Expansion.candidates.map((candidate) => candidate.candidateId));
  const d0Count = 36;

  if (evidence.packageId !== 'MS-004') failures.push('PACKAGE_ID');
  if (evidence.summary.benchmarkCapabilities !== 13) failures.push('BENCHMARK_CAPABILITY_COUNT');
  if (evidence.summary.d0Excluded !== d0Count) failures.push('D0_EXCLUSION_COUNT');
  if (evidence.summary.d1Capabilities !== 4 || evidence.summary.d2Capabilities !== 9 || evidence.summary.d3Capabilities !== 0) failures.push('EXECUTION_CLASS_COUNTS');
  if (evidence.summary.d1CandidateMethods !== 12 || evidence.summary.d2ModelCapabilityPairs !== 34) failures.push('CANDIDATE_COUNTS');
  if (evidence.summary.ms003D2ModelCapabilityPairs !== 28 || evidence.summary.ms004ExpansionModelCapabilityPairs !== 6) failures.push('EXPANSION_CANDIDATE_COUNTS');
  if (evidence.summary.uniqueHostedModels !== 12) failures.push('HOSTED_MODEL_COUNT');
  if (evidence.summary.openSelfHostedShortlisted !== 0) failures.push('SELF_HOSTED_COUNT');
  if (evidence.summary.originalProjectedMS004Calls !== 1440) failures.push('ORIGINAL_PROJECTED_CALLS');
  if (evidence.summary.projectedMS004Calls !== 320 || evidence.summary.revisedProjectedBenchmarkCalls !== 320) failures.push('REVISED_PROJECTED_CALLS');
  if (evidence.summary.ms004ExpansionExpectedHostedCalls !== 48) failures.push('EXPANSION_HOSTED_CALLS');
  if (evidence.summary.benchmarkBudgetCeilingUsd !== 10) failures.push('BUDGET_CEILING');
  if (evidence.summary.measuredTotalBenchmarkCostUsd > evidence.summary.benchmarkBudgetCeilingUsd) failures.push('BUDGET_EXCEEDED');
  if (evidence.summary.projectedBenchmarkCostRangeUsd.highEstimateUsd > evidence.summary.benchmarkBudgetCeilingUsd) failures.push('PROJECTED_BUDGET_EXCEEDED');
  if (evidence.summary.localPipelineEvaluations !== 48) failures.push('D1_LOCAL_PIPELINE_EVALUATION_COUNT');
  if (evidence.summary.hostedBenchmarkCalls !== 0) failures.push('HOSTED_CALL_COUNT');
  if (evidence.summary.totalBenchmarkCalls !== 48) failures.push('TOTAL_CALL_COUNT');
  if (evidence.summary.d2SyntheticBenchmarkDatasetReadyCount !== 9) failures.push('D2_DATASET_READY_COUNT');
  if (evidence.summary.representativeDataRequiredCount !== 4) failures.push('D1_REPRESENTATIVE_DATA_REQUIRED_COUNT');
  if (evidence.summary.insufficientComparativeEvidenceCount !== 9) failures.push('D2_INSUFFICIENT_EVIDENCE_COUNT');
  if (evidence.summary.blockerSummary.datasetBlockers !== 0) failures.push('DATASET_BLOCKERS_REMAIN');
  if (evidence.summary.blockerSummary.representativeDataRequired !== 4) failures.push('REPRESENTATIVE_DATA_BLOCKER_COUNT');
  if (evidence.summary.dryRunResult !== 'BLOCKED_PROVIDER_ACCESS' && evidence.summary.dryRunResult !== 'READY_FOR_EXECUTION') failures.push('DRY_RUN_STATUS');
  if (evidence.summary.dryRunResult === 'READY_FOR_EXECUTION' && evidence.summary.blockerSummary.providerAccessBlockers > 0) failures.push('READY_WITH_PROVIDER_BLOCKERS');
  if (evidence.summary.dryRunResult === 'READY_FOR_EXECUTION' && evidence.summary.projectedBenchmarkCostRangeUsd.highEstimateUsd > 10) failures.push('READY_OVER_BUDGET');
  if (evidence.summary.productionActivation !== 0 || evidence.scope.productionActivationPerformed !== false) failures.push('PRODUCTION_ACTIVATION');
  if (evidence.scope.deploymentPerformed || evidence.scope.migrationPerformed || evidence.scope.productionChangePerformed) failures.push('PRODUCTION_SIDE_EFFECT');
  if (evidence.scope.providerSelectionPerformed || evidence.scope.modelSelectionPerformed) failures.push('SELECTION_PERFORMED');
  if (evidence.scope.simulatedHostedOutputPresentedAsReal) failures.push('SIMULATED_OUTPUT_AS_REAL');
  if (evidence.scope.credentialsLogged) failures.push('CREDENTIALS_LOGGED');
  if (evidence.scope.productionDataUsed) failures.push('PRODUCTION_DATA_USED');
  if (evidence.scope.noNinthDomain !== true) failures.push('NINTH_DOMAIN');
  if (evidence.dryRun.noD0Included !== true) failures.push('D0_INCLUDED');
  if (evidence.dryRun.budgetCeilingUsd !== 10) failures.push('DRY_RUN_BUDGET');
  if (!Array.isArray(evidence.frozenBenchmarkDatasets) || evidence.frozenBenchmarkDatasets.length !== 13) failures.push('FROZEN_DATASET_COUNT');
  if (!evidence.candidateExpansionPlan || evidence.candidateExpansionPlan.summary.newModelCapabilityPairs !== 6) failures.push('EXPANSION_PLAN_MISSING');
  if (evidence.candidateExpansionPlan?.scope?.modelSelectionPerformed !== false || evidence.candidateExpansionPlan?.scope?.productionRoutingEnabled !== false) failures.push('EXPANSION_SCOPE_BOUNDARY');
  for (const candidate of evidence.candidateExpansionPlan?.candidates || []) {
    if (!UNRESOLVED_CAPABILITIES.includes(candidate.capabilityId)) failures.push(`EXPANSION_OUT_OF_SCOPE:${candidate.capabilityId}`);
    if (candidate.candidateStatus !== 'CANDIDATE_FOR_BENCHMARK') failures.push(`EXPANSION_SELECTION_STATUS:${candidate.candidateId}`);
    if (candidate.providerSelected || candidate.modelSelected || candidate.finalWinner || candidate.productionAssignment) failures.push(`EXPANSION_SELECTION_PERFORMED:${candidate.candidateId}`);
    if (!expansionCandidateIds.has(candidate.candidateId)) failures.push(`UNKNOWN_EXPANSION_CANDIDATE:${candidate.candidateId}`);
  }
  if (!evidence.finalD2Selection) {
    failures.push('FINAL_D2_SELECTION_MISSING');
  } else {
    const final = evidence.finalD2Selection;
    const expectedWinners = {
      'customer.account_guidance.presentation': 'customer.account_guidance.presentation::mistral-small-latest',
      'driver.copilot.contextual_response': 'driver.copilot.contextual_response::mistral-small-2603',
      'operations.executive_dashboard_synthesis': 'operations.executive_dashboard_synthesis::gemini-3.5-flash',
      'platform.legacy_structured_ai_response': 'platform.legacy_structured_ai_response::gemini-3.5-flash-lite',
      'route.risk_explanation.presentation': 'route.risk_explanation.presentation::mistral-medium-3-5',
      'safety.narrative_summary.presentation': 'safety.narrative_summary.presentation::gemini-3.7-flash',
      'supervisor.daily_operations_report.narrative': 'supervisor.daily_operations_report.narrative::mistral-small-latest',
      'supervisor.freeform_question_answer': 'supervisor.freeform_question_answer::gemini-3.5-flash',
      'warehouse.exception_summary.presentation': 'warehouse.exception_summary.presentation::mistral-small-latest'
    };
    if (final.d2ModelSelectionComplete !== true || final.allNineD2CapabilitiesFinalModelSelectionReady !== true) failures.push('FINAL_D2_NOT_COMPLETE');
    if (evidence.summary.d2ModelSelectionComplete !== true || evidence.summary.finalD2CapabilitiesReady !== 9) failures.push('FINAL_D2_SUMMARY_NOT_COMPLETE');
    if (evidence.summary.liveHostedBenchmarkExecuted !== true || evidence.summary.measuredLiveBenchmarkCostUsd !== final.measuredTotalBenchmarkCostUsd) failures.push('FINAL_D2_LIVE_SUMMARY_MISMATCH');
    if (final.completedLiveHostedCalls !== 257 || final.failedLiveHostedCalls !== 35 || final.measuredTotalBenchmarkCostUsd !== 1.4305707) failures.push('FINAL_D2_LIVE_TOTALS');
    if (final.driverReopenEvidence?.runtimeReliabilityStatus !== 'DRIVER_RUNTIME_RELIABILITY_PASS' || final.driverReopenEvidence?.completedRepetitions !== 20 || final.driverReopenEvidence?.hardGatePassCount !== 20 || final.driverReopenEvidence?.correctiveRetriesUsed !== 0) failures.push('DRIVER_V2_REOPEN_EVIDENCE');
    if (final.d1Status !== 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA') failures.push('D1_BOUNDARY_CHANGED');
    if (final.productionRoutingStatus !== 'NOT_ACTIVATED') failures.push('PRODUCTION_ROUTING_ACTIVATED');
    if (!Array.isArray(final.matrix) || final.matrix.length !== 9) failures.push('FINAL_D2_MATRIX_COUNT');
    for (const [capabilityId, candidateId] of Object.entries(expectedWinners)) {
      const row = final.matrix?.find((item) => item.capabilityId === capabilityId);
      if (!row || row.selectionStatus !== 'FINAL_MODEL_SELECTION_READY' || row.selectedCandidate !== candidateId) failures.push(`FINAL_D2_WINNER:${capabilityId}`);
    }
    if (final.providerDistribution?.google !== 4 || final.providerDistribution?.mistral !== 5 || final.providerDistribution?.openai !== 0 || final.providerDistribution?.anthropic !== 0) failures.push('FINAL_PROVIDER_DISTRIBUTION');
    const expansionFailures = final.expansionFailureReconciliation;
    if (expansionFailures?.exactExpansionFailureCount !== 10) failures.push('EXPANSION_FAILURE_COUNT');
    if (expansionFailures?.classificationCounts?.NON_MATERIAL_PROVIDER_FAILURE !== 10) failures.push('EXPANSION_FAILURE_CLASSIFICATION');
    if (expansionFailures?.classificationCounts?.MATERIAL_RETRY_REQUIRED !== 0) failures.push('MATERIAL_RETRY_REMAINS');
    if (!Array.isArray(final.furtherBenchmarkingDecisions) || final.furtherBenchmarkingDecisions.some((item) => item.decision !== 'NO_MORE_BENCHMARKING_REQUIRED')) failures.push('MORE_BENCHMARKING_REQUIRED');
  }

  const capabilityIds = new Set(evidence.capabilityResults.map((item) => item.capabilityId));
  if (capabilityIds.size !== 13) failures.push('CAPABILITY_RESULT_COUNT');
  for (const id of capabilityIds) {
    if (!allowedCapabilities.has(id)) failures.push(`UNKNOWN_CAPABILITY:${id}`);
  }
  for (const dataset of Object.values(evidence.datasetEvidenceByCapability || {})) {
    if (!dataset.datasetId || !dataset.datasetHash) failures.push('MISSING_FROZEN_DATASET');
    if (dataset.executionClass === 'D1') {
      if (dataset.status !== 'REPRESENTATIVE_DATA_REQUIRED') failures.push('D1_DATASET_STATUS');
      if (dataset.pipelineValidationReady !== true || dataset.performanceSelectionReady !== false) failures.push('D1_DATASET_READINESS');
    }
    if (dataset.executionClass === 'D2') {
      if (dataset.status !== 'BENCHMARK_DATASET_READY') failures.push('D2_DATASET_STATUS');
      if (dataset.benchmarkReady !== true || dataset.performanceSelectionReady !== true) failures.push('D2_DATASET_READINESS');
    }
  }
  for (const result of evidence.runResults) {
    if (!result.benchmarkRunId) failures.push('MISSING_RUN_ID');
    if (!result.capabilityId || !allowedCapabilities.has(result.capabilityId)) failures.push('RUN_UNKNOWN_CAPABILITY');
    if (!result.candidateId || !allowedCandidates.has(result.candidateId)) failures.push('RUN_UNKNOWN_CANDIDATE');
    if (result.hostedBenchmarkExecuted === true && !result.datasetVersionHash) failures.push('EXECUTED_WITHOUT_DATASET_HASH');
    if (result.hostedBenchmarkExecuted === true && result.outputHash === null) failures.push('EXECUTED_WITHOUT_OUTPUT_HASH');
    if (result.localBenchmarkExecuted === true && !result.datasetVersionHash) failures.push('LOCAL_EXECUTED_WITHOUT_DATASET_HASH');
    if (result.localBenchmarkExecuted === true && !result.outputHash) failures.push('LOCAL_EXECUTED_WITHOUT_OUTPUT_HASH');
    if (result.localBenchmarkExecuted === true && result.costUsd !== 0) failures.push('LOCAL_EXECUTION_COST');
    if (result.executionClass === 'D1' && result.status !== 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA') failures.push('D1_FINAL_SELECTION_PREMATURE');
    if (result.executionClass === 'D2' && result.hostedBenchmarkExecuted === true) failures.push('D2_HOSTED_EXECUTED_WITHOUT_READY_GATE');
    if (result.simulatedHostedOutputPresentedAsReal) failures.push('SIMULATED_OUTPUT_AS_REAL');
    if (result.hardGateResult === 'RUN_FAIL_HARD_GATE' && result.eligibilityResult !== 'BLOCKED' && result.status !== 'DISQUALIFIED') failures.push('HARD_GATE_FAILURE_MARKED_PASSING');
    if (result.hardGateResult === 'RUN_FAIL_HARD_GATE' && /PASS|SCORE/i.test(String(result.status || ''))) failures.push('SAFETY_FAILURE_RESCUED_BY_SCORE');
    if (result.costUsd > 10) failures.push('RUN_COST_EXCEEDS_BUDGET');
    if (result.usage?.fabricated === true) failures.push('USAGE_FABRICATED');
    if (result.costFabricated === true) failures.push('COST_FABRICATED');
    if (result.productionActivation === true) failures.push('RUN_PRODUCTION_ACTIVATION');
    if (result.providerSelected === true || result.modelSelected === true) failures.push('RUN_SELECTION');
  }
  for (const matrix of evidence.proposedExecutionModelMatrix) {
    if (!allowedCapabilities.has(matrix.capabilityId)) failures.push('MATRIX_UNKNOWN_CAPABILITY');
    if (matrix.selectedWinner === true) failures.push('MATRIX_SELECTED_WINNER');
    if (matrix.benchmarkStatus === 'PRODUCTION_CERTIFIED') failures.push('PRODUCTION_CERTIFIED');
    if (matrix.premiumRequired === 'PREMIUM_REQUIRED' && matrix.benchmarkWinner === null) failures.push('PREMIUM_WITHOUT_WINNER');
    if (matrix.executionClass === 'D1' && matrix.benchmarkStatus !== 'PIPELINE_VALIDATED_REPRESENTATIVE_DATA_REQUIRED') failures.push('D1_MATRIX_STATUS');
    if (matrix.executionClass === 'D2' && matrix.benchmarkStatus !== 'EXECUTION_BLOCKED') failures.push('D2_MATRIX_STATUS');
  }
  for (const winner of evidence.d1WinnerAnalysis || []) {
    if (winner.winnerStatus !== 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA') failures.push('D1_WINNER_STATUS');
    if (winner.benchmarkWinner !== null) failures.push('D1_WINNER_BEFORE_REPRESENTATIVE_DATA');
  }
  for (const winner of evidence.d2WinnerAnalysis || []) {
    if (winner.winnerStatus !== 'INSUFFICIENT_COMPARATIVE_EVIDENCE') failures.push('D2_WINNER_STATUS');
    if (winner.benchmarkWinner !== null) failures.push('D2_WINNER_WITHOUT_HOSTED_EVIDENCE');
  }
  if (evidence.summary.capabilitiesWithWinner > 0 && evidence.summary.hostedBenchmarkCalls === 0) failures.push('WINNER_WITHOUT_HOSTED_CALLS');
  if (evidence.summary.totalBenchmarkCalls !== evidence.summary.successfulCalls + evidence.summary.failedCalls) failures.push('CALL_ACCOUNTING');
  if (evidence.noCandidatePassed.length !== 0) failures.push('NO_CANDIDATE_PASSED_PREMATURE');
  return failures;
}

function expectInvalid(label, mutator) {
  const evidence = clone(buildBenchmarkEvidence());
  mutator(evidence);
  const failures = validateEvidence(evidence);
  assert.ok(failures.length > 0, `${label} should be invalid`);
}

function main() {
  const checkResult = generate({ check: true });
  assert.deepStrictEqual(checkResult.changed, [], `stale MS-004 artifacts: ${checkResult.changed.join(', ')}`);
  const generated = readGeneratedEvidence();
  const rebuilt = buildBenchmarkEvidence();
  assert.deepStrictEqual(generated, rebuilt, 'generated MS-004 evidence does not match rebuilt evidence');
  const failures = validateEvidence(generated);
  assert.deepStrictEqual(failures, [], `MS-004 evidence validation failed: ${failures.join(', ')}`);

  expectInvalid('D0 capability benchmark execution', (e) => { e.capabilityResults.push({ capabilityId: 'fleet.issue_anomaly_candidate' }); });
  expectInvalid('14th capability', (e) => { e.capabilityResults.push({ capabilityId: 'extra.capability' }); });
  expectInvalid('candidate not in MS-003 shortlist', (e) => { e.runResults[0].candidateId = 'unapproved.candidate'; });
  expectInvalid('simulated hosted output presented as real', (e) => { e.runResults[0].simulatedHostedOutputPresentedAsReal = true; });
  expectInvalid('missing run ID', (e) => { e.runResults[0].benchmarkRunId = ''; });
  expectInvalid('missing dataset hash on executed result', (e) => { e.runResults[0].hostedBenchmarkExecuted = true; e.runResults[0].datasetVersionHash = null; });
  expectInvalid('missing candidate ID', (e) => { e.runResults[0].candidateId = ''; });
  expectInvalid('hard-gate failure marked passing', (e) => { e.runResults[0].hardGateResult = 'RUN_FAIL_HARD_GATE'; e.runResults[0].eligibilityResult = 'PASSED'; });
  expectInvalid('safety failure rescued by score', (e) => { e.runResults[0].hardGateResult = 'RUN_FAIL_HARD_GATE'; e.runResults[0].status = 'PASSED_BY_SCORE'; });
  expectInvalid('cross-org leakage marked passing', (e) => { e.runResults[0].hardGateResult = 'RUN_FAIL_HARD_GATE'; e.runResults[0].eligibilityResult = 'PASSED'; });
  expectInvalid('failed API call omitted', (e) => { e.summary.totalBenchmarkCalls = 49; e.summary.successfulCalls = 48; e.summary.failedCalls = 0; });
  expectInvalid('retry omitted', (e) => { e.summary.totalBenchmarkCalls = 49; e.summary.successfulCalls = 0; e.summary.failedCalls = 0; });
  expectInvalid('usage fabricated', (e) => { e.runResults[0].usage = { fabricated: true }; });
  expectInvalid('cost fabricated', (e) => { e.runResults[0].costFabricated = true; });
  expectInvalid('benchmark spend over $10', (e) => { e.summary.measuredTotalBenchmarkCostUsd = 10.01; });
  expectInvalid('winner assigned where no candidate passed', (e) => { e.summary.capabilitiesWithWinner = 1; });
  expectInvalid('D1 winner assigned before representative data', (e) => { e.d1WinnerAnalysis[0].benchmarkWinner = 'gradient-boosted-trees'; });
  expectInvalid('D2 hosted run before provider readiness', (e) => { const run = e.runResults.find((item) => item.executionClass === 'D2'); run.hostedBenchmarkExecuted = true; run.outputHash = 'abc'; });
  expectInvalid('missing frozen dataset', (e) => { e.frozenBenchmarkDatasets.pop(); });
  expectInvalid('premium selected solely by score', (e) => { e.proposedExecutionModelMatrix[0].premiumRequired = 'PREMIUM_REQUIRED'; });
  expectInvalid('production activation', (e) => { e.scope.productionActivationPerformed = true; });
  expectInvalid('provider routing activated', (e) => { e.runResults[0].providerSelected = true; });
  expectInvalid('deployment', (e) => { e.scope.deploymentPerformed = true; });
  expectInvalid('migration', (e) => { e.scope.migrationPerformed = true; });
  expectInvalid('production-certified result', (e) => { e.proposedExecutionModelMatrix[0].benchmarkStatus = 'PRODUCTION_CERTIFIED'; });
  expectInvalid('stale generated artifact', (e) => { e.summary.benchmarkCapabilities = 12; });
  expectInvalid('missing final D2 selection evidence', (e) => { delete e.finalD2Selection; });
  expectInvalid('legacy dry-run summary misread as final D2 incomplete', (e) => { e.summary.d2ModelSelectionComplete = false; });
  expectInvalid('live D2 benchmark cost mismatch', (e) => { e.summary.measuredLiveBenchmarkCostUsd = 0; });

  console.log(`[ms004] validated benchmark evidence: capabilities=${generated.summary.benchmarkCapabilities}, localPipelineEvaluations=${generated.summary.localPipelineEvaluations}, dryRunHostedCalls=${generated.summary.hostedBenchmarkCalls}, dryRunCost=${generated.summary.measuredTotalBenchmarkCostUsd}, finalD2LiveHostedCalls=${generated.finalD2Selection.completedLiveHostedCalls}, finalD2FailedCalls=${generated.finalD2Selection.failedLiveHostedCalls}, finalD2MeasuredCost=${generated.finalD2Selection.measuredTotalBenchmarkCostUsd}, finalD2Complete=${generated.finalD2Selection.d2ModelSelectionComplete}, finalD2Ready=${generated.finalD2Selection.allNineD2CapabilitiesFinalModelSelectionReady}, blockers=${JSON.stringify(generated.summary.blockerSummary)}`);
}

if (require.main === module) main();
module.exports = { validateEvidence };
