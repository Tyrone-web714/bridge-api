#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const driverIntel = require('../services/intelligenceExecution/driverIntelligence');
const { generate } = require('./generate-driver-intelligence-artifacts.cjs');

const outDir = driverIntel.paths.generatedRoot;

function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}

function assertNoProhibitedRuntime(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of [
    /providerCallInvoked"\s*:\s*true/,
    /hostedAiInvoked"\s*:\s*true/,
    /predictiveModel(?:Invoked)?"\s*:\s*true/,
    /employeeScoring"\s*:\s*true/,
    /disciplinaryRecommendation"\s*:\s*true/,
    /productionApplicable"\s*:\s*true/,
    /databaseWritePerformed|migrationExecuted|deploymentExecuted|objectStorageMutation|credentialRotation/i,
    /OpenAI|Anthropic|Gemini|fetch\(|new Client\(|express\.Router/i
  ]) assert.ok(!pattern.test(text), `prohibited runtime/provider marker found: ${pattern}`);
}

function expectInvalid(rule, request) {
  const validation = driverIntel.validateDriverRequest(request);
  assert.strictEqual(validation.valid, false, `expected invalid request for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function benchmarkStatus(caseId) {
  const benchmark = driverIntel.buildBenchmarkCases().find((item) => item.caseId === caseId);
  assert.ok(benchmark, `missing benchmark ${caseId}`);
  return driverIntel.assessDriverOperationalSnapshot(benchmark.request);
}

function main() {
  assert.strictEqual(driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION, 'driver.intelligence.foundation.v1');
  assert.strictEqual(driverIntel.DRIVER_INTELLIGENCE_ENGINE_VERSION, 'driver.intelligence.foundation.engine.v1');
  assert.strictEqual(driverIntel.DETERMINISTIC_GENERATED_AT, '2026-07-25T00:00:00.000Z');
  for (const state of ['OFF_DUTY', 'ON_DUTY', 'DRIVING', 'AT_STOP', 'DELIVERING', 'WAITING', 'RETURNING', 'ROUTE_COMPLETE', 'UNKNOWN']) assert.ok(driverIntel.DRIVER_STATES.includes(state));
  for (const event of ['STOP_ARRIVED', 'STOP_DEPARTED', 'ROUTE_DEVIATED', 'SPEED_WARNING', 'LOW_BRIDGE_WARNING', 'RESTRICTED_ROAD_WARNING']) assert.ok(driverIntel.DRIVER_EVENTS.includes(event));

  const profiles = driverIntel.buildSyntheticDriverProfiles();
  assert.ok(profiles.length >= 3);
  assert.strictEqual(driverIntel.validateDriverProfile(profiles[0]).valid, true);
  assert.strictEqual(driverIntel.validateDriverProfile({ ...profiles[0], driverId: '' }).valid, false);
  assert.strictEqual(driverIntel.validateDriverProfile({ ...profiles[0], employeeScoringEnabled: true }).valid, false);

  const snapshot = driverIntel.baseSnapshot();
  const validRequest = { tenantContext: { organizationId: 'org_test' }, driverProfile: profiles[0], snapshot };
  assert.strictEqual(driverIntel.validateDriverRequest(validRequest).valid, true);
  expectInvalid('CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', { ...validRequest, model: 'gpt-test' });
  expectInvalid('CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', { ...validRequest, providerId: 'external' });
  expectInvalid('CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', { ...validRequest, premium: true });
  expectInvalid('CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', { ...validRequest, performanceScore: 97 });
  expectInvalid('CALLER_PROVIDER_OR_EMPLOYEE_SCORING_CONTROL', { ...validRequest, employeeRank: 1 });
  expectInvalid('TENANT_CONTEXT_REQUIRED', { ...validRequest, tenantContext: {} });

  assert.strictEqual(driverIntel.assessOperationalState({ driverState: 'DRIVING', events: [{ eventType: 'ROUTE_STARTED' }] }).status, driverIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(driverIntel.assessOperationalState({ driverState: 'UNKNOWN', events: [{ eventType: 'UNKNOWN_EVENT' }] }).status, driverIntel.ASSESSMENT_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(driverIntel.assessRouteAdherence(snapshot).status, driverIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(driverIntel.assessRouteAdherence(driverIntel.baseSnapshot({ currentPosition: { latitude: 33.506, longitude: -86.790 }, offRouteDurationMinutes: 6 })).reasonCode, driverIntel.REASON_CODES.ROUTE_DEVIATION_WARNING);
  assert.strictEqual(driverIntel.assessRouteAdherence({ assignedRoute: { geometry: { points: [] } }, currentPosition: snapshot.currentPosition }).status, driverIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(driverIntel.assessRouteAdherence({ assignedRoute: { geometry: { points: [{ latitude: null, longitude: -86.8 }] } }, currentPosition: snapshot.currentPosition }).reasonCode, driverIntel.REASON_CODES.ROUTE_GEOMETRY_MALFORMED);
  assert.strictEqual(driverIntel.assessRouteAdherence(driverIntel.baseSnapshot({ events: [{ eventType: 'ROUTE_RESUMED', observedAt: '2026-07-24T23:59:00.000Z' }] })).reasonCode, driverIntel.REASON_CODES.ROUTE_RESUMED);

  assert.strictEqual(driverIntel.assessStopProgress({ driverState: 'DRIVING' }).status, driverIntel.ASSESSMENT_STATUSES.NOT_APPLICABLE);
  assert.strictEqual(driverIntel.assessStopProgress({ driverState: 'AT_STOP', currentPosition: { latitude: 33.5, longitude: -86.8 }, currentStop: { stopId: 'stop-1', point: { latitude: 33.5, longitude: -86.8 } } }).reasonCode, driverIntel.REASON_CODES.STOP_ARRIVED);
  assert.strictEqual(driverIntel.assessStopProgress({ currentPosition: { latitude: 33.501, longitude: -86.799 }, currentStop: { stopId: 'stop-1', point: { latitude: 33.5, longitude: -86.8 } }, events: [{ eventType: 'STOP_DEPARTED', observedAt: '2026-07-24T23:59:00.000Z' }] }).reasonCode, driverIntel.REASON_CODES.STOP_DEPARTED);
  assert.strictEqual(driverIntel.assessStopProgress({ currentPosition: { latitude: 33.5, longitude: -86.8 }, currentStop: { stopId: 'stop-1' } }).reasonCode, driverIntel.REASON_CODES.STOP_GEOMETRY_INSUFFICIENT);

  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 45 }).status, driverIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 60 }).status, driverIntel.ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 62 }).status, driverIntel.ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 65 }).status, driverIntel.ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 67 }).status, driverIntel.ASSESSMENT_STATUSES.WARNING);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 45, speedObservedAt: '2026-07-24T23:40:00.000Z' }).reasonCode, driverIntel.REASON_CODES.SPEED_EVIDENCE_STALE);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: 55, recentSpeedEvents: [{ speedMph: 66 }, { speedMph: 68 }, { speedMph: 70 }] }).reasonCode, driverIntel.REASON_CODES.SPEED_REPEATED_WARNING);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: true, speedMph: null }).reasonCode, driverIntel.REASON_CODES.SPEED_UNKNOWN);
  assert.strictEqual(driverIntel.assessSpeedCompliance({ gpsAvailable: false, speedMph: 45 }).reasonCode, driverIntel.REASON_CODES.GPS_UNAVAILABLE);

  const near = { latitude: 33.50062, longitude: -86.7995 };
  assert.strictEqual(driverIntel.assessLowBridgeApproach({ currentPosition: near, upcomingBridges: [{ bridgeId: 'b', point: near, clearance: { value: 12.8, unit: 'ft' } }] }).reasonCode, driverIntel.REASON_CODES.LOW_BRIDGE_APPROACH);
  assert.strictEqual(driverIntel.assessLowBridgeApproach({ currentPosition: null, upcomingBridges: [] }).status, driverIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, upcomingRestrictions: [{ restrictionId: 'r', type: 'TRUCK_PROHIBITED', point: near }] }).reasonCode, driverIntel.REASON_CODES.RESTRICTED_ROAD_APPROACH);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, upcomingRestrictions: [{ restrictionId: 'n', type: 'NO_THROUGH_TRUCKS', point: near }] }).reasonCode, driverIntel.REASON_CODES.NO_THROUGH_TRUCK_APPROACH);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, routePurpose: 'LOCAL_DELIVERY', upcomingRestrictions: [{ restrictionId: 'n', type: 'NO_THROUGH_TRUCKS', point: near }] }).reasonCode, driverIntel.REASON_CODES.LOCAL_DELIVERY_EXCEPTION);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, upcomingRestrictions: [{ restrictionId: 'res', type: 'RESIDENTIAL_AVOID', point: near }] }).reasonCode, driverIntel.REASON_CODES.RESIDENTIAL_AREA_APPROACH);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, upcomingRestrictions: [{ restrictionId: 'resp', type: 'RESIDENTIAL_TRUCK_PROHIBITED', point: near }] }).reasonCode, driverIntel.REASON_CODES.RESIDENTIAL_PROHIBITION_APPROACH);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: near, upcomingRestrictions: [{ restrictionId: 'closed', type: 'ROAD_CLOSED', point: near }] }).reasonCode, driverIntel.REASON_CODES.ROAD_CLOSURE_APPROACH);
  assert.strictEqual(driverIntel.assessRestrictedRoadApproach({ currentPosition: null, upcomingRestrictions: [] }).status, driverIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);

  assert.strictEqual(driverIntel.assessHazardAcknowledgement({ activeWarnings: [{ warningId: 'w', requiresAcknowledgement: true }], hazardAcknowledgements: [{ warningId: 'w' }] }).reasonCode, driverIntel.REASON_CODES.HAZARD_ACKNOWLEDGED);
  assert.strictEqual(driverIntel.assessHazardAcknowledgement({ activeWarnings: [{ warningId: 'w', requiresAcknowledgement: true }], hazardAcknowledgements: [] }).reasonCode, driverIntel.REASON_CODES.HAZARD_ACKNOWLEDGEMENT_MISSING);

  assert.strictEqual(benchmarkStatus('driver_on_route').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.NORMAL);
  assert.strictEqual(benchmarkStatus('driver_route_resumed').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.NORMAL);
  assert.strictEqual(benchmarkStatus('driver_speeding_at_threshold').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(benchmarkStatus('driver_speeding_advisory').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(benchmarkStatus('driver_speeding_between_thresholds').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(benchmarkStatus('driver_speeding_warning').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(benchmarkStatus('driver_stale_speed_evidence').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(benchmarkStatus('driver_stop_arrival').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.NORMAL);
  assert.strictEqual(benchmarkStatus('driver_stop_departure').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.NORMAL);
  assert.strictEqual(benchmarkStatus('unknown_stop_geometry').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(benchmarkStatus('driver_bridge_outside_threshold').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.NORMAL);
  assert.strictEqual(benchmarkStatus('unknown_gps').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(benchmarkStatus('driver_residential_approach').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.WARNING);
  assert.strictEqual(benchmarkStatus('driver_no_through_local_delivery').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.ADVISORY);
  assert.strictEqual(benchmarkStatus('driver_residential_prohibition').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(benchmarkStatus('driver_road_closure').status, driverIntel.DRIVER_ASSESSMENT_STATUSES.REVIEW_REQUIRED);

  const assessment = driverIntel.assessDriverOperationalSnapshot(validRequest);
  assert.strictEqual(assessment.providerCallInvoked, false);
  assert.strictEqual(assessment.hostedAiInvoked, false);
  assert.strictEqual(assessment.predictiveModelInvoked, false);
  assert.strictEqual(assessment.employeeScoring, false);
  assert.strictEqual(assessment.disciplinaryRecommendation, false);
  assert.strictEqual(assessment.productionApplicable, false);
  assert.strictEqual(driverIntel.validateDriverAssessment(assessment).valid, true);
  assert.ok(assessment.explanation.providerGenerated === false);
  assert.ok(assessment.explanation.employeeScoring === false);
  assert.ok(assessment.advisories.every((advisory) => advisory.providerGenerated === false));
  assertNoProhibitedRuntime(assessment);

  const evidence = driverIntel.buildDriverIntelligenceEvidence();
  const again = driverIntel.buildDriverIntelligenceEvidence();
  assert.deepStrictEqual(again, evidence, 'driver intelligence evidence must be deterministic');
  const validation = driverIntel.validateDriverIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.strictEqual(evidence.catalog.integratedWithEnterpriseRegistry, true);
  assert.strictEqual(evidence.catalog.directRegistryCapabilityDeferred, true);
  assert.strictEqual(evidence.catalog.integratedWithCapabilityOrchestration, true);
  assert.strictEqual(evidence.catalog.integratedWithLifecycleFramework, true);
  assert.strictEqual(evidence.catalog.integratedWithRouteIntelligence, true);
  assert.ok(evidence.benchmarkCases.length >= 15);
  for (const benchmark of evidence.benchmarkCases) {
    const result = driverIntel.assessDriverOperationalSnapshot(benchmark.request);
    assert.strictEqual(result.status, benchmark.expectedStatus, `${benchmark.caseId} expected ${benchmark.expectedStatus}, got ${result.status}`);
    assert.strictEqual(benchmark.providerCallExpected, false);
    assert.strictEqual(benchmark.employeeScoringExpected, false);
  }
  assertNoProhibitedRuntime(evidence);

  const broken = JSON.parse(JSON.stringify(assessment));
  broken.status = 'UNKNOWN';
  assert.strictEqual(driverIntel.validateDriverAssessment(broken).valid, false);
  assert.ok(driverIntel.validateDriverAssessment(broken).errors.some((error) => error.rule === 'UNKNOWN_DRIVER_ASSESSMENT_STATUS'));
  const productionClaim = JSON.parse(JSON.stringify(assessment));
  productionClaim.productionApplicable = true;
  assert.ok(driverIntel.validateDriverAssessment(productionClaim).errors.some((error) => error.rule === 'PRODUCTION_DRIVER_INTELLIGENCE_PROHIBITED'));
  const employmentImpactClaim = JSON.parse(JSON.stringify(assessment));
  employmentImpactClaim.driverScore = 10;
  assert.ok(driverIntel.validateDriverAssessment(employmentImpactClaim).errors.some((error) => error.rule === 'PROHIBITED_EMPLOYMENT_IMPACT_FIELD'));

  const brokenEvidence = JSON.parse(JSON.stringify(evidence));
  brokenEvidence.catalog.integratedWithRouteIntelligence = false;
  assert.strictEqual(driverIntel.validateDriverIntelligenceEvidence(brokenEvidence).valid, false);
  assert.ok(driverIntel.validateDriverIntelligenceEvidence(brokenEvidence).errors.some((error) => error.rule === 'ROUTE_INTELLIGENCE_INTEGRATION_MISSING'));

  const serviceText = fs.readFileSync(path.join(driverIntel.paths.backendRoot, 'services', 'intelligenceExecution', 'driverIntelligence.js'), 'utf8');
  assertNoProhibitedRuntime(serviceText);

  const before = readGenerated();
  const generated = generate({ check: true });
  assert.deepStrictEqual(generated.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:driver-intelligence] deterministic driver profile/state/event contracts, route adherence/deviation, stop progress, speed compliance, low bridge/restricted road approach, hazard acknowledgement, explanations, human-review flags, synthetic benchmarks, IEP integration references, artifacts, and runtime-safety boundaries verified.');
}

main();
