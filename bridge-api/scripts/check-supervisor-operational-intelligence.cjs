#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const supervisor = require('../services/intelligenceExecution/supervisorOperationalIntelligence');
const supervisorLegacy = require('../services/supervisorIntelligence');
const supervisorAiAdapter = require('../services/intelligenceExecution/supervisorAiAdapter');
const { generate } = require('./generate-supervisor-operational-intelligence-artifacts.cjs');

const outDir = supervisor.paths.generatedRoot;

function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}

function assertNoProhibited(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of [
    /employeeScore|driverScore|employeeRank|driverRank|disciplinaryRecommendation|terminationRecommendation|compensationDecision|bonusRecommendation|productivityRating|unsafeDriverLabel|fatiguePrediction|personalityInference|emotionalStateInference/,
    /providerCallInvoked"\s*:\s*true|hostedAiExpanded"\s*:\s*true|predictiveModelInvoked"\s*:\s*true/,
    /productionApiExposed"\s*:\s*true|productionNotificationSent"\s*:\s*true|migrationExecuted"\s*:\s*true|deploymentExecuted"\s*:\s*true|productionApplicable"\s*:\s*true/,
    /discipline driver|write up employee|terminate employee|reduce compensation|deny bonus|rank driver/i,
    /express\.Router|fetch\(|OpenAI|Anthropic|Gemini|new Client\(/i
  ]) assert.ok(!pattern.test(text), `prohibited marker found: ${pattern}`);
}

function assertNoProhibitedSourceBoundary(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of [
    /providerCallInvoked"\s*:\s*true|hostedAiExpanded"\s*:\s*true|predictiveModelInvoked"\s*:\s*true/,
    /productionApiExposed"\s*:\s*true|productionNotificationSent"\s*:\s*true|migrationExecuted"\s*:\s*true|deploymentExecuted"\s*:\s*true|productionApplicable"\s*:\s*true/,
    /discipline driver|write up employee|terminate employee|reduce compensation|deny bonus|rank driver/i,
    /express\.Router|fetch\(|OpenAI|Anthropic|Gemini|new Client\(/i
  ]) assert.ok(!pattern.test(text), `prohibited source marker found: ${pattern}`);
}

function caseResult(caseId) {
  const record = supervisor.querySyntheticSupervisorAssessments().find((item) => item.caseId === caseId);
  assert.ok(record, `missing case ${caseId}`);
  return record;
}

function main() {
  assert.strictEqual(supervisor.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION, 'supervisor.intelligence.foundation.v1');
  assert.strictEqual(supervisor.SUPERVISOR_INTELLIGENCE_ENGINE_VERSION, 'supervisor.intelligence.foundation.engine.v1');
  assert.strictEqual(supervisor.DETERMINISTIC_GENERATED_AT, '2026-08-01T00:00:00.000Z');
  for (const state of ['NOT_STARTED','IN_PROGRESS','DELAYED','BLOCKED','COMPLETE','INSUFFICIENT_EVIDENCE','UNKNOWN']) assert.ok(supervisor.ROUTE_STATES.includes(state));
  for (const state of ['NOT_STARTED','ARRIVED','COMPLETE','SKIPPED','UNRESOLVED','INSUFFICIENT_EVIDENCE','UNKNOWN']) assert.ok(supervisor.STOP_STATES.includes(state));
  for (const type of ['ROUTE_START_DELAY','ROUTE_PROGRESS_DELAY','LOW_BRIDGE_EVENT','RESTRICTED_ROAD_EVENT','NO_THROUGH_TRUCK_EVENT','ROAD_CLOSURE_EVENT','SPEED_ADVISORY_EVENT','SPEED_WARNING_EVENT','DRIVER_GPS_UNAVAILABLE','STOP_DELAY','STOP_SKIPPED','DELIVERY_EVIDENCE_MISSING','INSUFFICIENT_EVIDENCE']) assert.ok(supervisor.EXCEPTION_TYPES.includes(type));

  const context = supervisor.buildSyntheticSupervisorContext();
  assert.strictEqual(supervisor.validateSupervisorContext(context).valid, true);
  assert.strictEqual(supervisor.validateSupervisorContext({ ...context, organizationId: '' }).valid, false, 'trusted Organization scope is required');
  assert.strictEqual(supervisor.validateSupervisorContext({ ...context, authorizedRole: 'DRIVER' }).valid, false, 'unauthorized roles fail');
  assert.ok(supervisor.validateSupervisorContext({ ...context, model: 'caller-model' }).errors.some((error) => error.rule === 'CALLER_CONTROL_PROHIBITED'), 'caller model controls are rejected');
  assert.ok(supervisor.validateSupervisorContext({ ...context, organizationOverride: 'other-org' }).errors.some((error) => error.rule === 'CALLER_CONTROL_PROHIBITED'), 'caller Organization override is rejected');

  const portfolio = supervisor.buildRoutePortfolioState({ supervisorContext: context, routes: [supervisor.baseRoute()], now: supervisor.DETERMINISTIC_GENERATED_AT });
  assert.strictEqual(portfolio.contextValidation.valid, true);
  assert.strictEqual(portfolio.routes.length, 1);
  assert.strictEqual(portfolio.routes[0].routeProgressPercentage, 50);
  const unknownProgress = supervisor.buildRoutePortfolioState({ supervisorContext: context, routes: [{ routeId: 'r', organizationId: context.organizationId, scheduledStart: '2026-08-01T08:00:00.000Z', scheduledEnd: '2026-08-01T09:00:00.000Z', lastEvidenceTimestamp: '2026-08-01T08:10:00.000Z' }] });
  assert.strictEqual(unknownProgress.routes[0].routeProgressPercentage, null, 'unknown route progress remains unknown');
  const missingSchedule = supervisor.buildRoutePortfolioState({ supervisorContext: context, routes: [{ routeId: 'no-schedule', organizationId: context.organizationId, lastEvidenceTimestamp: '2026-08-01T08:10:00.000Z' }] });
  assert.strictEqual(missingSchedule.routes[0].routeStatus, 'INSUFFICIENT_EVIDENCE', 'missing schedule cannot fabricate delay');

  assert.strictEqual(caseResult('route_not_started_by_threshold').exceptions[0].reasonCodes[0], supervisor.REASON_CODES.ROUTE_NOT_STARTED_BY_THRESHOLD);
  assert.strictEqual(caseResult('route_delayed').exceptions[0].reasonCodes[0], supervisor.REASON_CODES.ROUTE_BEHIND_EXPECTED_PROGRESS);
  assert.ok(caseResult('route_blocked_low_bridge').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.LOW_BRIDGE_HAZARD_ACTIVE)));
  assert.ok(caseResult('route_deviation_active').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.ROUTE_DEVIATION_ACTIVE)));
  assert.ok(caseResult('route_deviation_resolved').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.ROUTE_DEVIATION_RESOLVED)));
  assert.ok(caseResult('restricted_road_event').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.RESTRICTED_ROAD_HAZARD_ACTIVE)));
  assert.ok(caseResult('no_through_truck_event').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.NO_THROUGH_TRUCK_HAZARD_ACTIVE)));
  assert.ok(caseResult('route_blocked_road_closure').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.ROAD_CLOSURE_ACTIVE)));
  assert.ok(caseResult('driver_speed_advisory').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.SPEED_ADVISORY_ACTIVE)));
  assert.ok(caseResult('driver_speed_warning').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.SPEED_WARNING_ACTIVE)));
  assert.ok(caseResult('gps_unavailable').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.GPS_EVIDENCE_UNAVAILABLE)));
  assert.ok(caseResult('stale_route_evidence').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.ROUTE_EVIDENCE_STALE)));
  assert.ok(caseResult('conflicting_route_evidence').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.ROUTE_EVIDENCE_CONFLICT)));
  assert.ok(caseResult('stop_delayed').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.STOP_PROGRESS_DELAYED)));
  assert.ok(caseResult('stop_skipped_unknown_reason').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.STOP_STATUS_UNRESOLVED)));
  assert.ok(caseResult('stop_unresolved').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.STOP_STATUS_UNRESOLVED)));
  assert.ok(caseResult('delivery_evidence_missing').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.DELIVERY_EVIDENCE_INCOMPLETE)));
  assert.strictEqual(caseResult('multiple_simultaneous_exceptions').exceptions.length, 4);

  const priorityCase = caseResult('safety_outranks_delay');
  assert.strictEqual(priorityCase.alerts[0].recommendedOperationalNextStep, 'ESCALATE_SAFETY_EVENT', 'safety exception outranks routine delay');
  assert.strictEqual(caseResult('unknown_severity').exceptions[0].severity, 'UNKNOWN', 'unknown severity remains unknown');
  assert.ok(caseResult('insufficient_evidence').exceptions.some((item) => item.reasonCodes.includes(supervisor.REASON_CODES.EVIDENCE_INSUFFICIENT)));
  assert.ok(caseResult('human_review').exceptions.some((item) => item.humanReviewRequired === true));

  const alert = caseResult('route_deviation_active').alerts[0];
  assert.strictEqual(supervisor.validateSupervisorAlert(alert).valid, true);
  assert.strictEqual(supervisor.acknowledgeSupervisorAlert(alert).acknowledgementState, 'ACKNOWLEDGED');
  assert.strictEqual(supervisor.resolveSupervisorAlert(alert).resolutionState, 'RESOLVED');
  assert.strictEqual(supervisor.invalidateSupervisorAlert(alert).resolutionState, 'INVALIDATED_BY_NEW_EVIDENCE');
  assert.ok(caseResult('multiple_simultaneous_exceptions').summary.unresolvedAlerts >= 4);
  assert.ok(caseResult('multiple_simultaneous_exceptions').summary.humanReviewItems >= 1);
  const explanation = supervisor.buildSupervisorExplanation({ alert });
  assert.strictEqual(explanation.derivedFromFacts, true);
  assert.strictEqual(explanation.intentInferred, false);
  assert.strictEqual(explanation.employeeMotivationInferred, false);

  const fallback = supervisorLegacy.deterministicReport({ routeDate: '2026-08-01', routePrediction: { routes: [] }, failurePrediction: { riskLevel: 'low' }, demandPrediction: { confidence: 'medium', products: [] }, undeliveredStops: [] });
  assert.ok(fallback.summary.includes('0 route(s) analyzed'), 'existing deterministic fallback remains compatible');
  const narrativeRequest = supervisorAiAdapter.buildSupervisorDailyReportRequest({ schedule: { id: 's1' }, sourceContext: { routeDate: '2026-08-01', routePrediction: { routes: [] }, failurePrediction: { riskLevel: 'low' }, demandPrediction: { confidence: 'medium', products: [] }, undeliveredStops: [] } });
  assert.strictEqual(narrativeRequest.capability, 'supervisor.daily_operations_report', 'existing hosted narrative path still enters through IEP');
  assert.strictEqual(narrativeRequest.allowPremiumEscalation, false, 'no provider/model expansion occurs');

  const evidence = supervisor.buildSupervisorIntelligenceEvidence();
  assert.deepStrictEqual(supervisor.buildSupervisorIntelligenceEvidence(), evidence, 'evidence must be deterministic');
  const validation = supervisor.validateSupervisorIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.strictEqual(evidence.catalog.integratedWithEnterpriseRegistry, true);
  assert.strictEqual(evidence.catalog.integratedWithCapabilityOrchestration, true);
  assert.strictEqual(evidence.catalog.integratedWithLifecycleFramework, true);
  assert.strictEqual(evidence.catalog.integratedWithRouteIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithDriverIntelligence, true);
  assert.strictEqual(evidence.catalog.existingDailyReportCompatibilityPreserved, true);
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.hostedAiExpanded, false);
  assertNoProhibited(evidence);

  const brokenAlert = JSON.parse(JSON.stringify(alert));
  brokenAlert.alertHash = 'broken';
  assert.ok(supervisor.validateSupervisorAlert(brokenAlert).errors.some((error) => error.rule === 'ALERT_HASH_MISMATCH'), 'controlled alert-hash mutation is detected');
  const brokenExpected = JSON.parse(JSON.stringify(evidence));
  brokenExpected.benchmarkCases[0].expectedExceptionCount = 99;
  assert.ok(supervisor.validateSupervisorIntelligenceEvidence(brokenExpected).errors.some((error) => error.rule === 'BENCHMARK_EXPECTATION_MISMATCH'), 'controlled expected-result mutation is detected');
  const employeeScoreClaim = JSON.parse(JSON.stringify(alert));
  employeeScoreClaim.employeeScore = 10;
  assert.ok(supervisor.validateSupervisorAlert(employeeScoreClaim).errors.some((error) => error.rule === 'PROHIBITED_EMPLOYMENT_FIELD'), 'controlled employeeScore field is rejected');
  const disciplineClaim = JSON.parse(JSON.stringify(alert));
  disciplineClaim.disciplinaryRecommendation = 'write up employee';
  assert.ok(supervisor.validateSupervisorAlert(disciplineClaim).errors.some((error) => error.rule === 'PROHIBITED_EMPLOYMENT_FIELD'), 'controlled disciplinaryRecommendation field is rejected');

  const serviceText = fs.readFileSync(path.join(supervisor.paths.backendRoot, 'services', 'intelligenceExecution', 'supervisorOperationalIntelligence.js'), 'utf8');
  assertNoProhibitedSourceBoundary(serviceText);
  assert.ok(!fs.existsSync(path.join(supervisor.paths.backendRoot, 'routes', 'supervisorOperationalIntelligence.js')), 'no public HTTP API is authorized');
  assert.ok(!fs.readdirSync(path.join(supervisor.paths.backendRoot, 'migrations')).some((file) => /supervisor.*operational/i.test(file)), 'no migration is created');

  const before = readGenerated();
  const generated = generate({ check: true });
  assert.deepStrictEqual(generated.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:supervisor-operational-intelligence] deterministic supervisor context, route portfolio, stop progress, exceptions, alerts, priorities, lifecycle, summaries, explanations, employment guardrails, platform integrations, generated artifacts, and existing daily-report compatibility verified.');
}

main();
