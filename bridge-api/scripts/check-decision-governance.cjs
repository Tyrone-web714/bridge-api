#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const governance = require('../services/intelligenceExecution/decisionGovernance');
const decisions = require('../services/intelligenceExecution/executionDecisionEngine');
const { generate } = require('./generate-decision-governance-artifacts.cjs');
const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'decision-history-and-governance', 'generated');
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readGenerated() { if (!fs.existsSync(generatedDir)) return []; return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]); }
function expectInvalid(rule, fn) { const result = fn(); assert.strictEqual(result.valid, false, `expected invalid ${rule}`); assert.ok(result.errors.some((e) => e.rule === rule), `expected ${rule}, got ${result.errors.map((e) => e.rule).join(', ')}`); }
function assertNoProhibitedOutput(value) { const text = JSON.stringify(value); for (const key of governance.PROHIBITED_OUTPUT_KEYS) assert.ok(!new RegExp(`"${key}"\\s*:\\s*true`).test(text), `${key} must not be true`); }
function main() {
  assert.strictEqual(governance.DECISION_HISTORY_RECORD_SCHEMA_VERSION, 'intelligence.decision.history.record.v1');
  assert.strictEqual(governance.GOVERNANCE_EVENT_SCHEMA_VERSION, 'intelligence.decision.governance.event.v1');
  assert.strictEqual(governance.GOVERNANCE_POLICY_PROFILE_SCHEMA_VERSION, 'intelligence.decision.governance.policy.profile.v1');
  assert.strictEqual(governance.HUMAN_REVIEW_RECORD_SCHEMA_VERSION, 'intelligence.decision.governance.human_review.v1');
  assert.strictEqual(governance.EXCEPTION_REQUEST_SCHEMA_VERSION, 'intelligence.decision.governance.exception.request.v1');
  assert.strictEqual(governance.EXCEPTION_DECISION_SCHEMA_VERSION, 'intelligence.decision.governance.exception.decision.v1');
  assert.strictEqual(governance.FINDING_RECORD_SCHEMA_VERSION, 'intelligence.decision.governance.finding.v1');
  assert.strictEqual(governance.ATTESTATION_RECORD_SCHEMA_VERSION, 'intelligence.decision.governance.attestation.v1');
  assert.strictEqual(governance.REPLAY_RECORD_SCHEMA_VERSION, 'intelligence.decision.governance.replay.v1');

  const profiles = governance.loadGovernancePolicyProfiles();
  assert.strictEqual(profiles.length, 3);
  for (const profile of profiles) assert.strictEqual(governance.validateGovernancePolicyProfile(profile).valid, true);
  expectInvalid('DUPLICATE_GOVERNANCE_POLICY_ID_VERSION', () => governance.validateGovernancePolicyProfile(profiles[0], [profiles[0], clone(profiles[0])]));
  expectInvalid('PRODUCTION_GOVERNANCE_APPROVAL_PROHIBITED', () => { const p = clone(profiles[0]); p.productionUseAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });
  expectInvalid('CERTIFICATION_CLAIM_PROHIBITED', () => { const p = clone(profiles[0]); p.certificationClaimsAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });
  expectInvalid('SAFETY_EXCEPTION_PROHIBITED', () => { const p = clone(profiles[0]); p.safetyExceptionAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });
  expectInvalid('PRIVACY_EXCEPTION_PROHIBITED', () => { const p = clone(profiles[0]); p.privacyExceptionAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });
  expectInvalid('TENANT_ISOLATION_EXCEPTION_PROHIBITED', () => { const p = clone(profiles[0]); p.tenantIsolationExceptionAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });
  expectInvalid('EMPLOYMENT_GOVERNANCE_EXCEPTION_PROHIBITED', () => { const p = clone(profiles[0]); p.employmentGovernanceExceptionAllowed = true; return governance.validateGovernancePolicyProfile(p, [p]); });

  const decisionRecords = decisions.runInitialDecisions();
  assert.strictEqual(decisionRecords.length, 4);
  assert.ok(decisionRecords.every((record) => decisions.validateDecisionRecord(record).valid));
  const histories = governance.runInitialDecisionHistory();
  assert.strictEqual(histories.length, 4);
  for (const history of histories) {
    const validation = governance.validateDecisionHistoryRecord(history);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(history.testOnly, true);
    assert.strictEqual(history.productionUseAllowed, false);
    assert.strictEqual(history.productionApprovalPresent, false);
    assert.strictEqual(history.certificationClaimPresent, false);
    assert.strictEqual(history.immutableDecisionSnapshot, true);
    assert.strictEqual(history.decisionSnapshotHash, decisions.decisionRecordHash(history.decisionSnapshot));
    assert.strictEqual(history.eventChainHash, history.governanceEvents.at(-1).chainHash);
    assert.deepStrictEqual(history.currentGovernanceProjection, governance.projectGovernanceState(history.governanceEvents));
    assert.strictEqual(governance.validateEventChain(history.governanceEvents).valid, true);
    assert.strictEqual(governance.validateHumanReviewRecord(history.humanReviewRecord || { schemaVersion: governance.HUMAN_REVIEW_RECORD_SCHEMA_VERSION, reviewer: governance.unknownActor(), containsEmployeeData: false, testOnly: true, productionApplicable: false }).valid, true);
    if (history.exceptionRequestRecord) assert.strictEqual(governance.validateExceptionRequest(history.exceptionRequestRecord).valid, true);
    if (history.exceptionDecisionRecord) assert.strictEqual(governance.validateExceptionDecision(history.exceptionDecisionRecord).valid, true);
    for (const finding of history.findingRecords) assert.strictEqual(governance.validateFindingRecord(finding).valid, true);
    for (const attestation of history.attestationRecords) assert.strictEqual(governance.validateAttestationRecord(attestation).valid, true);
    for (const replay of history.replayRecords) assert.strictEqual(governance.validateReplayRecord(replay).valid, true);
    assertNoProhibitedOutput(history);
  }
  assert.ok(histories.some((h) => h.approvalState === 'APPROVED_WITH_CONDITIONS'));
  assert.ok(histories.some((h) => h.approvalState === 'NOT_REQUESTED'));
  assert.ok(histories.some((h) => h.reviewState === 'COMPLETED' && h.approvalState === 'NOT_REQUESTED'));
  assert.ok(histories.some((h) => h.humanReviewState === 'UNRESOLVED'));
  assert.ok(histories.some((h) => h.exceptionState === 'GRANTED'));
  assert.ok(histories.some((h) => h.currentGovernanceProjection.policyDriftDetected));
  assert.ok(histories.some((h) => h.currentGovernanceProjection.evidenceStaleDetected));
  assert.ok(governance.listUnresolvedGovernanceItems().length > 0);
  assert.ok(governance.listFindings().length > 0);
  assert.ok(governance.listAttestations().length > 0);
  assert.ok(governance.listReplayRecords().every((r) => r.exactReplay));
  assert.ok(governance.buildLineageGraph().nodes.length === histories.length);

  const first = clone(histories[0]);
  expectInvalid('DUPLICATE_DECISION_HISTORY_ID', () => governance.validateDecisionHistoryRecord(first, [first, clone(first)]));
  expectInvalid('UNKNOWN_DECISION_RECORD', () => { const h = clone(first); h.decisionRecordId = 'missing.record'; h.historyRecordHash = governance.decisionHistoryRecordHash(h); return governance.validateDecisionHistoryRecord(h, [h]); });
  expectInvalid('DECISION_SNAPSHOT_HASH_MISMATCH', () => { const h = clone(first); h.decisionSnapshotHash = 'bad'; h.historyRecordHash = governance.decisionHistoryRecordHash(h); return governance.validateDecisionHistoryRecord(h, [h]); });
  expectInvalid('DECISION_SNAPSHOT_MUTATION_DETECTED', () => { const h = clone(first); h.decisionSnapshot.decisionRecordHash = 'changed'; h.decisionSnapshotHash = decisions.decisionRecordHash(h.decisionSnapshot); h.historyRecordHash = governance.decisionHistoryRecordHash(h); return governance.validateDecisionHistoryRecord(h, [h]); });
  expectInvalid('DUPLICATE_GOVERNANCE_EVENT_ID', () => { const h = clone(first); h.governanceEvents[1].governanceEventId = h.governanceEvents[0].governanceEventId; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('DUPLICATE_GOVERNANCE_EVENT_SEQUENCE', () => { const h = clone(first); h.governanceEvents[1].eventSequence = h.governanceEvents[0].eventSequence; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('GOVERNANCE_EVENT_SEQUENCE_GAP', () => { const h = clone(first); h.governanceEvents[1].eventSequence = 9; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('GOVERNANCE_PREVIOUS_EVENT_ID_MISMATCH', () => { const h = clone(first); h.governanceEvents[1].previousEventId = 'bad'; h.governanceEvents[1].payloadHash = governance.governanceEventPayloadHash(h.governanceEvents[1]); h.governanceEvents[1].eventHash = governance.governanceEventHash(h.governanceEvents[1]); h.governanceEvents[1].chainHash = governance.governanceEventChainHash(h.governanceEvents[1]); return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('GOVERNANCE_EVENT_PAYLOAD_HASH_MISMATCH', () => { const h = clone(first); h.governanceEvents[0].summary = 'mutated'; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('GOVERNANCE_EVENT_HASH_MISMATCH', () => { const h = clone(first); h.governanceEvents[0].eventHash = 'bad'; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('GOVERNANCE_EVENT_CHAIN_HASH_MISMATCH', () => { const h = clone(first); h.governanceEvents[0].chainHash = 'bad'; return governance.validateEventChain(h.governanceEvents); });
  expectInvalid('UNKNOWN_ACTOR_NOT_EXPLICIT', () => governance.validateGovernanceEvent({ ...first.governanceEvents[0], actor: { ...governance.unknownActor(), actorId: 'not-explicit' } }, [first.governanceEvents[0]]));
  expectInvalid('SYNTHETIC_ACTOR_PRODUCTION_AUTHORIZED', () => governance.validateGovernanceEvent({ ...first.governanceEvents[0], actor: { ...governance.reviewerActor(), productionAuthorized: true } }, [first.governanceEvents[0]]));
  expectInvalid('PRODUCTION_APPROVAL_PROHIBITED', () => { const h = clone(first); h.productionUseAllowed = true; h.historyRecordHash = governance.decisionHistoryRecordHash(h); return governance.validateDecisionHistoryRecord(h, [h]); });
  expectInvalid('CERTIFICATION_CLAIM_PROHIBITED', () => governance.validateAttestationRecord({ ...histories[0].attestationRecords[0], certificationClaim: true }));
  expectInvalid('EXACT_REPLAY_HASH_MISMATCH', () => governance.validateReplayRecord({ ...histories[0].replayRecords[0], replayDecisionRecordHash: 'bad' }));
  expectInvalid('LIVE_REPLAY_EXECUTION_PROHIBITED', () => governance.validateReplayRecord({ ...histories[0].replayRecords[0], liveExecutionInvoked: true }));
  expectInvalid('FINDING_RESOLUTION_REQUIRES_EVENT', () => governance.validateFindingRecord({ ...histories.find((h) => h.findingRecords.length).findingRecords[0], status: 'RESOLVED' }));
  expectInvalid('SAFETY_EXCEPTION_PROHIBITED', () => governance.validateExceptionRequest({ ...histories.find((h) => h.exceptionRequestRecord).exceptionRequestRecord, safetyImpact: true }));
  expectInvalid('PRIVACY_EXCEPTION_PROHIBITED', () => governance.validateExceptionRequest({ ...histories.find((h) => h.exceptionRequestRecord).exceptionRequestRecord, privacyImpact: true }));
  expectInvalid('TENANT_ISOLATION_EXCEPTION_PROHIBITED', () => governance.validateExceptionRequest({ ...histories.find((h) => h.exceptionRequestRecord).exceptionRequestRecord, tenantIsolationImpact: true }));
  expectInvalid('EMPLOYMENT_GOVERNANCE_EXCEPTION_PROHIBITED', () => governance.validateExceptionRequest({ ...histories.find((h) => h.exceptionRequestRecord).exceptionRequestRecord, employmentGovernanceImpact: true }));

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:decision-governance] history records, governance events, chains, projections, reviews, approvals, human review, exceptions, findings, attestations, replay, artifacts, and production-safety boundaries verified.');
}
main();
