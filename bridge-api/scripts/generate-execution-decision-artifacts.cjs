#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const decisions = require('../services/intelligenceExecution/executionDecisionEngine');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'execution-decision-engine', 'generated');
const generatedFrom = 'bridge-api/execution-decisions';
const generatedHeader = 'Generated from bridge-api/execution-decisions. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function json(value) {
  return `${JSON.stringify(decisions.stable(value), null, 2)}\n`;
}

function records() {
  return decisions.runInitialDecisions().sort((a, b) => a.decisionRequestId.localeCompare(b.decisionRequestId));
}

function profileSummary(profile) {
  return {
    decisionPolicyProfileId: profile.decisionPolicyProfileId,
    version: profile.version,
    lifecycleState: profile.lifecycleState,
    enabled: profile.enabled,
    testOnly: profile.testOnly,
    productionUseAllowed: profile.productionUseAllowed,
    utilityMethod: profile.utilityMethod,
    unknownCostPolicy: profile.unknownCostPolicy,
    allowedStrategyCount: profile.allowedStrategies.length,
    contentHash: decisions.policyProfileHash(profile)
  };
}

function requestSummary(request) {
  return {
    decisionRequestId: request.decisionRequestId,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion,
    executionProfileId: request.executionProfileId,
    decisionPolicyProfileId: request.decisionPolicyProfileId,
    dryRun: request.dryRun,
    simulationOnly: request.simulationOnly,
    productionExecutionRequested: request.productionExecutionRequested,
    liveProviderExecutionRequested: request.liveProviderExecutionRequested,
    requestHash: decisions.decisionRequestHash(request)
  };
}

function recordSummary(record) {
  const selected = record.enumeratedCandidates?.find((candidate) => candidate.candidateId === record.advisorySelectedCandidateId) || null;
  return {
    decisionRequestId: record.decisionRequestId,
    decisionRecordId: record.decisionRecordId,
    capabilityId: record.capabilityId,
    decisionPolicyProfileId: record.decisionPolicyProfileId,
    decisionOutcome: record.decisionOutcome,
    candidateCount: record.enumeratedCandidates?.length || 0,
    feasibleCandidateCount: record.feasibleCandidates?.length || 0,
    conditionalCandidateCount: record.conditionallyFeasibleCandidates?.length || 0,
    rejectedCandidateCount: record.rejectedCandidates?.length || 0,
    selectedStrategyId: selected?.strategyId || null,
    selectedComparableCostMicroUsd: record.selectedComparableCostMicroUsd,
    fallbackCount: record.fallbackPlan?.length || 0,
    testOnly: record.testOnly,
    productionUseAllowed: record.productionUseAllowed,
    decisionRecordHash: record.decisionRecordHash
  };
}

function candidateRows(allRecords) {
  return allRecords.flatMap((record) => (record.enumeratedCandidates || []).map((candidate) => ({
    decisionRequestId: record.decisionRequestId,
    candidateId: candidate.candidateId,
    strategyId: candidate.strategyId,
    runtimeStrategyId: candidate.runtimeStrategyId,
    executorId: candidate.executorId,
    capabilityId: candidate.capabilityId,
    feasibilityStatus: candidate.feasibilityStatus,
    authorizationStatus: candidate.authorizationStatus,
    availabilityStatus: candidate.availabilityStatus,
    evidenceStatus: candidate.evidenceStatus,
    comparableCostMicroUsd: candidate.costEvidence.comparableCostMicroUsd,
    unknownCost: candidate.costEvidence.unknownCost,
    confidenceScore: candidate.confidence.score,
    completenessScore: candidate.completeness.score,
    reasonCodes: candidate.reasonCodes,
    selected: candidate.candidateId === record.advisorySelectedCandidateId
  })));
}

function buildSummaryMd(allRecords) {
  const lines = [
    `<!-- ${generatedHeader} -->`,
    '# Execution Decision Summary',
    '',
    'Execution Decision Engine outputs are synthetic, offline, advisory, and test-only. They do not perform production runtime selection, provider procurement, live provider calls, real budget enforcement, or premium activation.',
    '',
    '| Request | Capability | Outcome | Candidates | Selected Strategy | Fallbacks |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  for (const record of allRecords.map(recordSummary)) {
    lines.push(`| ${record.decisionRequestId} | ${record.capabilityId} | ${record.decisionOutcome} | ${record.candidateCount} | ${record.selectedStrategyId || 'none'} | ${record.fallbackCount} |`);
  }
  return `${lines.join('\n')}\n`;
}

function buildPolicyMd(profiles) {
  const lines = [
    `<!-- ${generatedHeader} -->`,
    '# Decision Policy Profile Index',
    '',
    'Profiles are test-only policy inputs used for deterministic offline advisory decisions.',
    '',
    '| Profile | Version | Lifecycle | Utility | Production Use |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const profile of profiles.map(profileSummary)) lines.push(`| ${profile.decisionPolicyProfileId} | ${profile.version} | ${profile.lifecycleState} | ${profile.utilityMethod} | ${profile.productionUseAllowed} |`);
  return `${lines.join('\n')}\n`;
}

function buildCandidateMd(rows) {
  const lines = [
    `<!-- ${generatedHeader} -->`,
    '# Decision Candidate Index',
    '',
    'Candidate rows are trace evidence for advisory decisions only.',
    '',
    '| Request | Strategy | Feasibility | Cost Micro-USD | Selected | Reasons |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  for (const row of rows) lines.push(`| ${row.decisionRequestId} | ${row.strategyId} | ${row.feasibilityStatus} | ${row.comparableCostMicroUsd ?? 'unknown'} | ${row.selected} | ${row.reasonCodes.join('|') || 'none'} |`);
  return `${lines.join('\n')}\n`;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generate(options = {}) {
  ensureDir();
  const profiles = decisions.loadDecisionPolicyProfiles();
  const requests = decisions.loadDecisionRequests();
  const allRecords = records();
  const candidates = candidateRows(allRecords);
  const summaries = allRecords.map(recordSummary);
  const outputs = {
    'decision_policy_profile_index.json': json({ generatedFrom, generatedArtifact: true, policyProfiles: profiles.map(profileSummary) }),
    'DECISION_POLICY_PROFILE_INDEX.md': buildPolicyMd(profiles),
    'decision_request_index.json': json({ generatedFrom, generatedArtifact: true, decisionRequests: requests.map(requestSummary) }),
    'decision_record_index.json': json({ generatedFrom, generatedArtifact: true, decisionRecords: summaries }),
    'decision_record_index.csv': ['# ' + generatedHeader, 'decisionRequestId,capabilityId,decisionOutcome,candidateCount,selectedStrategyId,selectedComparableCostMicroUsd,fallbackCount,testOnly,productionUseAllowed,decisionRecordHash'].concat(summaries.map((item) => ['decisionRequestId', 'capabilityId', 'decisionOutcome', 'candidateCount', 'selectedStrategyId', 'selectedComparableCostMicroUsd', 'fallbackCount', 'testOnly', 'productionUseAllowed', 'decisionRecordHash'].map((column) => csvEscape(item[column])).join(','))).join('\n') + '\n',
    'decision_candidate_index.json': json({ generatedFrom, generatedArtifact: true, candidates }),
    'decision_candidate_index.csv': ['# ' + generatedHeader, 'decisionRequestId,candidateId,strategyId,runtimeStrategyId,executorId,feasibilityStatus,authorizationStatus,comparableCostMicroUsd,unknownCost,selected,reasonCodes'].concat(candidates.map((item) => ['decisionRequestId', 'candidateId', 'strategyId', 'runtimeStrategyId', 'executorId', 'feasibilityStatus', 'authorizationStatus', 'comparableCostMicroUsd', 'unknownCost', 'selected', 'reasonCodes'].map((column) => csvEscape(item[column])).join(','))).join('\n') + '\n',
    'DECISION_CANDIDATE_INDEX.md': buildCandidateMd(candidates),
    'decision_fallback_plan_index.json': json({ generatedFrom, generatedArtifact: true, fallbackPlans: allRecords.map((record) => ({ decisionRequestId: record.decisionRequestId, fallbackPlan: record.fallbackPlan })) }),
    'decision_counterfactual_report.json': json({ generatedFrom, generatedArtifact: true, counterfactuals: allRecords.flatMap((record) => (record.counterfactualTrace || []).map((item) => ({ decisionRequestId: record.decisionRequestId, ...item }))) }),
    'decision_sensitivity_report.json': json({ generatedFrom, generatedArtifact: true, sensitivity: allRecords.flatMap((record) => (record.sensitivityAnalysis || []).map((item) => ({ decisionRequestId: record.decisionRequestId, ...item }))) }),
    'decision_abstention_report.json': json({ generatedFrom, generatedArtifact: true, abstentions: decisions.listAbstentions().map(recordSummary) }),
    'decision_human_review_report.json': json({ generatedFrom, generatedArtifact: true, humanReview: decisions.listHumanReviewDecisions().map(recordSummary) }),
    'decision_insufficient_evidence_report.json': json({ generatedFrom, generatedArtifact: true, insufficientEvidence: decisions.listInsufficientEvidenceDecisions().map(recordSummary) }),
    'decision_premium_restriction_report.json': json({ generatedFrom, generatedArtifact: true, premiumRestrictedCandidates: decisions.listPremiumRestrictedCandidates() }),
    'decision_over_budget_report.json': json({ generatedFrom, generatedArtifact: true, overBudgetCandidates: decisions.listOverBudgetCandidates() }),
    'decision_critical_gate_rejection_report.json': json({ generatedFrom, generatedArtifact: true, criticalGateRejections: decisions.listCriticalGateRejections() }),
    'DECISION_SUMMARY.md': buildSummaryMd(allRecords)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[execution-decisions] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[execution-decisions] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, records: allRecords };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });

module.exports = { generate };
