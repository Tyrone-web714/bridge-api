#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const governance = require('../services/intelligenceExecution/decisionGovernance');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'decision-history-and-governance', 'generated');
const generatedFrom = 'bridge-api/decision-governance';
const generatedHeader = 'Generated from bridge-api/decision-governance. Do not hand-edit.';
function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function csvEscape(value) { const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function json(value) { return `${JSON.stringify(governance.stable(value), null, 2)}\n`; }
function records() { return governance.listDecisionHistoryRecords().sort((a, b) => a.decisionHistoryRecordId.localeCompare(b.decisionHistoryRecordId)); }
function historySummary(r) { return { decisionHistoryRecordId: r.decisionHistoryRecordId, decisionRecordId: r.decisionRecordId, capabilityId: r.capabilityId, decisionOutcome: r.decisionOutcome, governanceLifecycleState: r.governanceLifecycleState, reviewState: r.reviewState, approvalState: r.approvalState, humanReviewState: r.humanReviewState, exceptionState: r.exceptionState, eventCount: r.eventCount, testOnly: r.testOnly, productionUseAllowed: r.productionUseAllowed, historyRecordHash: r.historyRecordHash }; }
function eventSummary(e) { return { decisionHistoryRecordId: e.decisionHistoryRecordId, governanceEventId: e.governanceEventId, eventType: e.eventType, subjectType: e.subjectType, subjectId: e.subjectId, actorType: e.actor.actorType, eventSequence: e.eventSequence, previousEventId: e.previousEventId, eventHash: e.eventHash, chainHash: e.chainHash, testOnly: e.testOnly, productionApplicable: e.productionApplicable }; }
function profileSummary(p) { return { governancePolicyProfileId: p.governancePolicyProfileId, version: p.version, lifecycleState: p.lifecycleState, testOnly: p.testOnly, productionUseAllowed: p.productionUseAllowed, productionApprovalAllowed: p.productionApprovalAllowed, certificationClaimsAllowed: p.certificationClaimsAllowed, contentHash: governance.governancePolicyProfileHash(p) }; }
function summaryMd(all) { const lines = [`<!-- ${generatedHeader} -->`, '# Decision Governance Summary', '', 'Decision governance artifacts are synthetic, offline, test-only, and repository-only. They do not grant owner approval, production approval, certification, procurement approval, runtime activation, or deployment authority.', '', '| History | Capability | Lifecycle | Review | Approval | Human Review | Events |', '| --- | --- | --- | --- | --- | --- | --- |']; for (const item of all.map(historySummary)) lines.push(`| ${item.decisionHistoryRecordId} | ${item.capabilityId} | ${item.governanceLifecycleState} | ${item.reviewState} | ${item.approvalState} | ${item.humanReviewState} | ${item.eventCount} |`); return `${lines.join('\n')}\n`; }
function historyMd(all) { const lines = [`<!-- ${generatedHeader} -->`, '# Decision History Record Index', '', '| History | Decision | Outcome | Hash |', '| --- | --- | --- | --- |']; for (const item of all.map(historySummary)) lines.push(`| ${item.decisionHistoryRecordId} | ${item.decisionRecordId} | ${item.decisionOutcome} | ${item.historyRecordHash} |`); return `${lines.join('\n')}\n`; }
function eventMd(events) { const lines = [`<!-- ${generatedHeader} -->`, '# Governance Event Catalog', '', '| Event | Type | Sequence | Actor | Chain Hash |', '| --- | --- | --- | --- | --- |']; for (const e of events.map(eventSummary)) lines.push(`| ${e.governanceEventId} | ${e.eventType} | ${e.eventSequence} | ${e.actorType} | ${e.chainHash} |`); return `${lines.join('\n')}\n`; }
function writeIfChanged(fileName, content, options = {}) { const filePath = path.join(outDir, fileName); const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null; const changed = existing !== content; if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8'); return changed; }
function generate(options = {}) {
  ensureDir();
  const all = records();
  const events = governance.listGovernanceEvents();
  const outputs = {
    'decision_history_record_index.json': json({ generatedFrom, generatedArtifact: true, histories: all.map(historySummary) }),
    'decision_history_record_index.csv': ['# ' + generatedHeader, 'decisionHistoryRecordId,decisionRecordId,capabilityId,decisionOutcome,governanceLifecycleState,reviewState,approvalState,humanReviewState,eventCount,testOnly,productionUseAllowed,historyRecordHash'].concat(all.map(historySummary).map((item) => ['decisionHistoryRecordId', 'decisionRecordId', 'capabilityId', 'decisionOutcome', 'governanceLifecycleState', 'reviewState', 'approvalState', 'humanReviewState', 'eventCount', 'testOnly', 'productionUseAllowed', 'historyRecordHash'].map((c) => csvEscape(item[c])).join(','))).join('\n') + '\n',
    'DECISION_HISTORY_RECORD_INDEX.md': historyMd(all),
    'governance_event_catalog.json': json({ generatedFrom, generatedArtifact: true, events: events.map(eventSummary) }),
    'governance_event_catalog.csv': ['# ' + generatedHeader, 'decisionHistoryRecordId,governanceEventId,eventType,subjectType,subjectId,actorType,eventSequence,previousEventId,eventHash,chainHash'].concat(events.map(eventSummary).map((item) => ['decisionHistoryRecordId', 'governanceEventId', 'eventType', 'subjectType', 'subjectId', 'actorType', 'eventSequence', 'previousEventId', 'eventHash', 'chainHash'].map((c) => csvEscape(item[c])).join(','))).join('\n') + '\n',
    'GOVERNANCE_EVENT_CATALOG.md': eventMd(events),
    'governance_current_state.json': json({ generatedFrom, generatedArtifact: true, currentState: all.map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, projection: r.currentGovernanceProjection })) }),
    'governance_review_report.json': json({ generatedFrom, generatedArtifact: true, reviews: all.map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, reviewState: r.reviewState, reviewRecord: r.reviewRecord })) }),
    'governance_approval_report.json': json({ generatedFrom, generatedArtifact: true, approvals: all.map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, approvalState: r.approvalState, approvalRecord: r.approvalRecord })) }),
    'governance_human_review_report.json': json({ generatedFrom, generatedArtifact: true, humanReviews: governance.listHistoryWithHumanReview().map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, humanReviewState: r.humanReviewState, humanReviewRecord: r.humanReviewRecord })) }),
    'governance_exception_report.json': json({ generatedFrom, generatedArtifact: true, exceptions: governance.listExceptionRecords() }),
    'governance_finding_report.json': json({ generatedFrom, generatedArtifact: true, findings: governance.listFindings() }),
    'governance_attestation_report.json': json({ generatedFrom, generatedArtifact: true, attestations: governance.listAttestations() }),
    'governance_annotation_report.json': json({ generatedFrom, generatedArtifact: true, annotations: all.flatMap((r) => r.annotationRecords.map((a) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, ...a }))) }),
    'decision_supersession_report.json': json({ generatedFrom, generatedArtifact: true, supersession: all.map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, supersedesHistoryRecordId: r.supersedesHistoryRecordId, supersededByHistoryRecordId: r.supersededByHistoryRecordId, lineageRootId: r.lineageRootId })) }),
    'decision_lineage_graph.json': json({ generatedFrom, generatedArtifact: true, graph: governance.buildLineageGraph(all) }),
    'policy_drift_report.json': json({ generatedFrom, generatedArtifact: true, policyDrift: governance.listPolicyDriftRecords().map(historySummary) }),
    'evidence_staleness_report.json': json({ generatedFrom, generatedArtifact: true, evidenceStaleness: governance.listEvidenceStalenessRecords().map(historySummary) }),
    'decision_replay_report.json': json({ generatedFrom, generatedArtifact: true, replays: governance.listReplayRecords() }),
    'event_chain_integrity_report.json': json({ generatedFrom, generatedArtifact: true, chains: all.map((r) => ({ decisionHistoryRecordId: r.decisionHistoryRecordId, eventChainHash: r.eventChainHash, valid: governance.validateEventChain(r.governanceEvents).valid })) }),
    'unresolved_governance_items.json': json({ generatedFrom, generatedArtifact: true, unresolved: governance.listUnresolvedGovernanceItems().map(historySummary) }),
    'governance_policy_profile_index.json': json({ generatedFrom, generatedArtifact: true, profiles: governance.loadGovernancePolicyProfiles().map(profileSummary) }),
    'DECISION_GOVERNANCE_SUMMARY.md': summaryMd(all)
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) { console.error(`[decision-governance] generated artifacts are stale: ${changed.join(', ')}`); process.exitCode = 1; }
  else if (!options.check) console.log(`[decision-governance] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  return { changed, records: all };
}
if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
