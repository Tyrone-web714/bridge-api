#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const routeIntel = require('../services/intelligenceExecution/routeIntelligence');
const { generate } = require('./generate-route-intelligence-artifacts.cjs');

const outDir = routeIntel.paths.generatedRoot;

function readGenerated() {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).sort().map((file) => [file, fs.readFileSync(path.join(outDir, file), 'utf8')]);
}

function assertNoProhibitedRuntime(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const pattern of [
    /providerCallInvoked"\s*:\s*true/,
    /productionRouteEndpointModified"\s*:\s*true/,
    /productionApplicable"\s*:\s*true/,
    /databaseWritePerformed|migrationExecuted|deploymentExecuted|objectStorageMutation|credentialRotation/i,
    /OpenAI|Anthropic|Gemini|fetch\(|new Client\(|express\.Router/i
  ]) assert.ok(!pattern.test(text), `prohibited runtime/provider marker found: ${pattern}`);
}

function expectRequestInvalid(rule, request) {
  const validation = routeIntel.validateRouteIntelligenceRequest(request);
  assert.strictEqual(validation.valid, false, `expected invalid request for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function main() {
  assert.strictEqual(routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION, 'route.intelligence.foundation.v1');
  assert.strictEqual(routeIntel.ROUTE_INTELLIGENCE_ENGINE_VERSION, 'route.intelligence.foundation.engine.v1');
  assert.strictEqual(routeIntel.DETERMINISTIC_GENERATED_AT, '2026-07-25T00:00:00.000Z');

  assert.strictEqual(routeIntel.measurementToInches({ value: 13.5, unit: 'ft' }).inches, 162);
  assert.strictEqual(routeIntel.measurementToInches({ value: 162, unit: 'in' }).feet, 13.5);
  assert.strictEqual(routeIntel.measurementToPounds({ value: 20, unit: 'tons' }).pounds, 40000);
  assert.strictEqual(routeIntel.measurementToInches({ value: 'bad', unit: 'ft' }), null);

  const vehicles = routeIntel.buildSyntheticVehicleProfiles();
  const routes = routeIntel.buildSyntheticRouteCandidates();
  assert.ok(vehicles.length >= 4);
  assert.ok(routes.length >= 4);
  assert.strictEqual(routeIntel.validateVehicleProfile(vehicles[0]).valid, true);
  assert.strictEqual(routeIntel.validateVehicleProfile(vehicles[3]).valid, false);
  assert.strictEqual(routeIntel.validateVehicleProfile({ ...vehicles[0], height: { value: -1, unit: 'ft', source: 'synthetic' } }).valid, false);
  assert.strictEqual(routeIntel.validateVehicleProfile({ ...vehicles[0], height: { value: 13, unit: 'unsafe-unit', source: 'synthetic' } }).valid, false);

  const validRequest = { tenantContext: { organizationId: 'org_test' }, vehicleProfile: vehicles[0], routeCandidates: [routes[0]], purpose: 'THROUGH_ROUTE' };
  assert.strictEqual(routeIntel.validateRouteIntelligenceRequest(validRequest).valid, true);
  expectRequestInvalid('CALLER_PROVIDER_OR_MODEL_CONTROL', { ...validRequest, model: 'gpt-test' });
  expectRequestInvalid('CALLER_PROVIDER_OR_MODEL_CONTROL', { ...validRequest, providerId: 'external' });
  expectRequestInvalid('TENANT_CONTEXT_REQUIRED', { ...validRequest, tenantContext: {} });

  assert.strictEqual(routeIntel.effectiveHeightInches(vehicles[0]), 156);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'clear', clearance: { value: 14, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'exact', clearance: { value: 13, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'minimal', clearance: { value: 13.125, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }).reasonCode, routeIntel.REASON_CODES.CLEARANCE_MINIMAL_MARGIN);
  assert.strictEqual(routeIntel.assessClearance(vehicles[1], { evidenceId: 'low', clearance: { value: 13, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'unknown', observedAt: '2026-07-20T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(routeIntel.assessClearance(vehicles[3], { evidenceId: 'clear', clearance: { value: 14, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2026-07-20T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'conflict', clearance: { value: 15, unit: 'ft', source: 'synthetic', confidence: 1 }, conflict: true, observedAt: '2026-07-20T00:00:00.000Z' }).reasonCode, routeIntel.REASON_CODES.CLEARANCE_CONFLICT);
  assert.strictEqual(routeIntel.assessClearance(vehicles[0], { evidenceId: 'old', clearance: { value: 15, unit: 'ft', source: 'synthetic', confidence: 1 }, observedAt: '2020-01-01T00:00:00.000Z' }).status, routeIntel.ASSESSMENT_STATUSES.REVIEW_REQUIRED);

  assert.strictEqual(routeIntel.assessWeightRestriction(vehicles[1], { restrictionId: 'w', maxGrossWeight: { value: 20, unit: 'tons' } }).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);
  assert.strictEqual(routeIntel.assessWeightRestriction(vehicles[0], { restrictionId: 'w', maxGrossWeight: { value: 20, unit: 'tons' } }).status, routeIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(routeIntel.assessDimensionRestriction(vehicles[2], { restrictionId: 'h', maxHeight: { value: 14, unit: 'ft' } }).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);
  assert.strictEqual(routeIntel.assessTruckRestriction(routes[0], { restrictionId: 't', type: 'TRUCK_PROHIBITED' }, validRequest).reasonCode, routeIntel.REASON_CODES.TRUCK_PROHIBITED);
  assert.strictEqual(routeIntel.assessTruckRestriction(routes[0], { restrictionId: 'c', type: 'ROAD_CLOSED' }, validRequest).reasonCode, routeIntel.REASON_CODES.ROAD_CLOSED);
  assert.strictEqual(routeIntel.assessTruckRestriction(routes[0], { restrictionId: 'rc', type: 'RESTRICTED_ROAD_CLASS' }, validRequest).status, routeIntel.ASSESSMENT_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(routeIntel.assessTruckRestriction(routes[0], { restrictionId: 'nt', type: 'NO_THROUGH_TRUCKS' }, { ...validRequest, purpose: 'LOCAL_DELIVERY' }).status, routeIntel.ASSESSMENT_STATUSES.PASS);
  assert.strictEqual(routeIntel.assessResidentialRestriction({ restrictionId: 'r', type: 'RESIDENTIAL_AVOID' }).status, routeIntel.ASSESSMENT_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(routeIntel.assessResidentialRestriction({ restrictionId: 'r', type: 'RESIDENTIAL_TRUCK_PROHIBITED' }).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);

  const proximity = routeIntel.assessHazardProximity(routes[3], routes[3].hazards);
  assert.strictEqual(proximity[0].reasonCode, routeIntel.REASON_CODES.HAZARD_PROXIMITY_REVIEW);
  assert.strictEqual(routeIntel.assessHazardProximity({ geometry: { points: [] } }, []).at(0).status, routeIntel.ASSESSMENT_STATUSES.INSUFFICIENT_EVIDENCE);
  assert.strictEqual(routeIntel.assessHazardProximity({ geometry: { points: [{ latitude: null, longitude: -86.8 }] } }, []).at(0).status, routeIntel.ASSESSMENT_STATUSES.FAIL_CLOSED);
  assert.strictEqual(routeIntel.assessHazardProximity(routes[0], [{ hazardId: 'same', type: 'LOW_WIRE', point: routes[0].geometry.points[0] }]).at(0).reasonCode, routeIntel.REASON_CODES.HAZARD_INTERSECTION);

  const passAssessment = routeIntel.assessRouteCandidateSafety(validRequest, routes[0]);
  const unsafeAssessment = routeIntel.assessRouteCandidateSafety({ ...validRequest, vehicleProfile: vehicles[1], routeCandidates: [routes[1]] }, routes[1]);
  const reviewAssessment = routeIntel.assessRouteCandidateSafety({ ...validRequest, routeCandidates: [routes[3]] }, routes[3]);
  assert.strictEqual(passAssessment.status, routeIntel.ROUTE_SAFETY_STATUSES.ELIGIBLE);
  assert.strictEqual(unsafeAssessment.status, routeIntel.ROUTE_SAFETY_STATUSES.UNSAFE);
  assert.strictEqual(reviewAssessment.status, routeIntel.ROUTE_SAFETY_STATUSES.REVIEW_REQUIRED);
  assert.strictEqual(passAssessment.providerCallInvoked, false);
  assert.strictEqual(passAssessment.routeEndpointModified, false);
  assert.strictEqual(passAssessment.safeWithinKnownEvidence, true);
  assert.ok(Array.isArray(passAssessment.sourceHashes) && passAssessment.sourceHashes.length > 0);
  assert.ok(passAssessment.confidence.status === 'KNOWN_EVIDENCE_ONLY');
  assert.strictEqual(routeIntel.validateRouteSafetyAssessment(passAssessment).valid, true);

  const explanation = routeIntel.buildRouteSafetyExplanation(unsafeAssessment);
  assert.strictEqual(explanation.providerGenerated, false);
  assert.ok(explanation.primaryReasonCodes.includes(routeIntel.REASON_CODES.CLEARANCE_FAIL_CLOSED));

  const comparison = routeIntel.compareRouteAlternatives({ ...validRequest, vehicleProfile: vehicles[0], routeCandidates: [routes[1], routes[0]] });
  assert.strictEqual(comparison.selectedRouteCandidateId, 'route-clear-pass');
  assert.ok(comparison.unsafeRoutesRejected.some((item) => item.routeCandidateId === 'route-low-clearance'));
  assert.strictEqual(comparison.providerCallInvoked, false);

  const evidence = routeIntel.buildRouteIntelligenceEvidence();
  const again = routeIntel.buildRouteIntelligenceEvidence();
  assert.deepStrictEqual(again, evidence, 'route intelligence evidence must be deterministic');
  const validation = routeIntel.validateRouteIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.strictEqual(evidence.catalog.integratedWithEnterpriseRegistry, true);
  assert.strictEqual(evidence.catalog.integratedWithCapabilityOrchestration, true);
  assert.strictEqual(evidence.catalog.integratedWithLifecycleFramework, true);
  assert.ok(evidence.capabilities.every((capability) => capability.executionStrategy === 'DETERMINISTIC_RULES'));
  assert.ok(evidence.capabilities.every((capability) => !/openai|gpt|claude|gemini/i.test(capability.capabilityId)));
  assert.ok(evidence.benchmarkCases.length >= 12);
  assert.ok(evidence.benchmarkCases.every((item) => item.providerCallExpected === false));
  assert.ok(evidence.assessments.every((item) => item.explanation.providerGenerated === false));
  assertNoProhibitedRuntime(evidence);

  const brokenAssessment = JSON.parse(JSON.stringify(passAssessment));
  brokenAssessment.status = 'UNKNOWN';
  assert.strictEqual(routeIntel.validateRouteSafetyAssessment(brokenAssessment).valid, false);
  assert.ok(routeIntel.validateRouteSafetyAssessment(brokenAssessment).errors.some((error) => error.rule === 'UNKNOWN_ROUTE_SAFETY_STATUS'));
  const productionClaim = JSON.parse(JSON.stringify(passAssessment));
  productionClaim.productionActivation = true;
  assert.ok(routeIntel.validateRouteSafetyAssessment(productionClaim).errors.some((error) => error.rule === 'PRODUCTION_OR_GUARANTEED_SAFE_CLAIM_PROHIBITED'));

  const brokenEvidence = JSON.parse(JSON.stringify(evidence));
  brokenEvidence.catalog.integratedWithEnterpriseRegistry = false;
  assert.strictEqual(routeIntel.validateRouteIntelligenceEvidence(brokenEvidence).valid, false);
  assert.ok(routeIntel.validateRouteIntelligenceEvidence(brokenEvidence).errors.some((error) => error.rule === 'ENTERPRISE_REGISTRY_INTEGRATION_MISSING'));

  const serviceText = fs.readFileSync(path.join(routeIntel.paths.backendRoot, 'services', 'intelligenceExecution', 'routeIntelligence.js'), 'utf8');
  assertNoProhibitedRuntime(serviceText);
  const routeText = fs.readFileSync(path.join(routeIntel.paths.backendRoot, 'routes', 'routing.js'), 'utf8');
  assert.ok(/@googlemaps\/google-maps-services-js/.test(routeText), 'production routing remains in its existing route file and was not moved into route intelligence');

  const before = readGenerated();
  const generated = generate({ check: true });
  assert.deepStrictEqual(generated.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:route-intelligence] deterministic route safety rules, vehicle/route contracts, clearance/weight/dimension/truck/residential/hazard assessments, alternative comparison, explanations, synthetic benchmarks, IEP integration references, artifacts, and runtime-safety boundaries verified.');
}

main();
