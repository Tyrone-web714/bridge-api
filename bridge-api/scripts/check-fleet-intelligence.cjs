#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fleet = require('../services/intelligenceExecution/fleetIntelligence');
const { generate } = require('./generate-fleet-intelligence-artifacts.cjs');

const docsDir = path.dirname(fleet.paths.generatedRoot);
const REQUIRED_DOCS = [
  'README.md','CURRENT_FLEET_FUNCTIONALITY_AUDIT.md','FLEET_INTELLIGENCE_ARCHITECTURE.md','EXISTING_FLEET_SCORING_BOUNDARY.md','EXISTING_SERVICE_REUSE_DECISION.md','AUTHORITATIVE_DATA_BOUNDARIES.md','FLEET_CONTEXT_CONTRACT.md','VEHICLE_OPERATIONAL_CONTEXT.md','VEHICLE_AVAILABILITY_MODEL.md','VEHICLE_READINESS_MODEL.md','ROUTE_VEHICLE_COMPATIBILITY.md','FLEET_UTILIZATION_AWARENESS.md','MAINTENANCE_STATUS_AWARENESS.md','UNRESOLVED_VEHICLE_ISSUES.md','ROUTE_IMPACT_MODEL.md','FLEET_EXCEPTION_MODEL.md','EXCEPTION_SEVERITY_MODEL.md','FLEET_ALERT_MODEL.md','ALERT_LIFECYCLE.md','SUPERVISOR_FLEET_VISIBILITY.md','DETERMINISTIC_EXPLANATIONS.md','EVIDENCE_AND_CONFIDENCE.md','REASON_CODES.md','ROUTE_INTELLIGENCE_INTEGRATION.md','DRIVER_INTELLIGENCE_INTEGRATION.md','SUPERVISOR_INTELLIGENCE_INTEGRATION.md','WAREHOUSE_INTELLIGENCE_INTEGRATION.md','BENCHMARK_DATASETS.md','PLATFORM_INTEGRATION.md','KNOWLEDGE_GRAPH_INTEGRATION.md','DASHBOARD_INTEGRATION.md','SECURITY_AND_TENANT_REVIEW.md','EMPLOYMENT_IMPACT_GUARDRAILS.md','PREDICTIVE_MAINTENANCE_BOUNDARY.md','AUTONOMOUS_ACTION_BOUNDARY.md','TEST_PLAN.md','TEST_RESULTS.md','IMPLEMENTATION_REPORT.md','DEFERRED_WORK.md','OWNER_DECISIONS_REQUIRED.md','ROLLBACK_PLAN.md'
];
const REQUIRED_GENERATED = [
  'fleet_context_contract.json','fleet_vehicle_context_catalog.json','fleet_availability_catalog.json','fleet_readiness_catalog.json','fleet_route_compatibility_catalog.json','fleet_issue_catalog.json','fleet_route_impact_catalog.json','fleet_alert_catalog.json','fleet_reason_code_catalog.json','fleet_benchmark_catalog.json','fleet_evidence_report.json','fleet_summary_report.json','FLEET_INTELLIGENCE_SUMMARY.md'
];

function readGenerated() {
  if (!fs.existsSync(fleet.paths.generatedRoot)) return [];
  return fs.readdirSync(fleet.paths.generatedRoot).sort().map((file) => [file, fs.readFileSync(path.join(fleet.paths.generatedRoot, file), 'utf8')]);
}

function expectValidationFailure(mutator, expectedRule) {
  const evidence = fleet.buildFleetIntelligenceEvidence();
  mutator(evidence);
  const validation = fleet.validateFleetIntelligenceEvidence(evidence);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function main() {
  assert.strictEqual(fleet.FLEET_INTELLIGENCE_SCHEMA_VERSION, 'fleet.intelligence.foundation.v1');
  assert.strictEqual(fleet.FLEET_INTELLIGENCE_ENGINE_VERSION, 'fleet.intelligence.foundation.engine.v1');
  for (const doc of REQUIRED_DOCS) assert.ok(fs.existsSync(path.join(docsDir, doc)), `missing doc ${doc}`);
  for (const file of REQUIRED_GENERATED) assert.ok(fs.existsSync(path.join(fleet.paths.generatedRoot, file)), `missing generated artifact ${file}`);

  const evidence = fleet.buildFleetIntelligenceEvidence();
  const second = fleet.buildFleetIntelligenceEvidence();
  assert.deepStrictEqual(second, evidence, 'Fleet evidence generation must be deterministic');
  const validation = fleet.validateFleetIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(evidence.benchmarkCases.length >= 34, 'expected fleet benchmark coverage');
  assert.strictEqual(evidence.catalog.existingFleetScoringBoundaryPreserved, true);
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.productionApiExposed, false);
  assert.strictEqual(evidence.catalog.predictiveMaintenanceInvoked, false);
  assert.strictEqual(evidence.catalog.autonomousDispatchPerformed, false);
  assert.strictEqual(evidence.catalog.employeeScoring, false);
  assert.strictEqual(evidence.catalog.driverScoring, false);

  const byCase = Object.fromEntries(evidence.assessments.map((item) => [item.caseId, item.assessment]));
  assert.strictEqual(byCase.available_unassigned_vehicle.availability.state, 'AVAILABLE');
  assert.strictEqual(byCase.assigned_vehicle.availability.state, 'ASSIGNED');
  assert.strictEqual(byCase.vehicle_in_use.availability.state, 'IN_USE');
  assert.strictEqual(byCase.unavailable_vehicle.readiness.state, 'NOT_READY');
  assert.strictEqual(byCase.out_of_service_vehicle.readiness.state, 'BLOCKED');
  assert.strictEqual(byCase.assignment_match.assignment.outcome, 'MATCH');
  assert.strictEqual(byCase.assignment_mismatch.assignment.outcome, 'MISMATCH');
  assert.ok(byCase.vehicle_profile_present.vehicleContext.vehicleProfile);
  assert.notStrictEqual(byCase.vehicle_profile_missing.readiness.state, 'READY');
  assert.strictEqual(byCase.route_compatible_vehicle.compatibility.state, 'COMPATIBLE');
  assert.strictEqual(byCase.route_incompatible_vehicle.compatibility.state, 'INCOMPATIBLE');
  assert.strictEqual(byCase.route_incompatible_vehicle.readiness.state, 'BLOCKED');
  assert.strictEqual(byCase.route_compatibility_review.compatibility.state, 'REVIEW_REQUIRED');
  assert.strictEqual(byCase.maintenance_known.maintenance.state, 'NO_KNOWN_BLOCKER');
  assert.strictEqual(byCase.maintenance_due.maintenance.state, 'MAINTENANCE_DUE');
  assert.strictEqual(byCase.maintenance_overdue.readiness.state, 'NOT_READY');
  assert.strictEqual(byCase.critical_issue_open.readiness.state, 'BLOCKED');
  assert.strictEqual(byCase.maintenance_status_unknown.maintenance.state, 'MAINTENANCE_STATUS_UNKNOWN');
  assert.strictEqual(byCase.stale_evidence.issues.some((item) => item.issueType === 'VEHICLE_EVIDENCE_STALE'), true);
  assert.strictEqual(byCase.conflicting_evidence.issues.some((item) => item.issueType === 'VEHICLE_EVIDENCE_CONFLICT'), true);
  assert.strictEqual(byCase.ready_vehicle.readiness.state, 'READY');
  assert.strictEqual(byCase.ready_with_review.readiness.state, 'READY_WITH_REVIEW');
  assert.strictEqual(byCase.blocked_vehicle.routeImpact.state, 'ROUTE_BLOCKED');
  assert.strictEqual(byCase.route_impacted_by_unavailable_vehicle.routeImpact.state, 'ROUTE_AT_RISK');
  assert.strictEqual(byCase.route_blocked_by_incompatible_vehicle.routeImpact.state, 'ROUTE_BLOCKED');
  assert.strictEqual(byCase.substitute_vehicle_review.autonomousDispatchPerformed, false);
  assert.strictEqual(byCase.insufficient_evidence.readiness.state, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(byCase.unknown_state.readiness.state, 'INSUFFICIENT_EVIDENCE');
  assert.ok(byCase.supervisor_review.alerts.some((alert) => alert.humanReviewRequired));
  assert.ok(byCase.alert_acknowledgement.alerts.length > 0);
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'alert_acknowledgement').lifecycleSamples.acknowledged.acknowledgementState, 'ACKNOWLEDGED');
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'alert_resolution').lifecycleSamples.resolved.resolutionState, 'RESOLVED');
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'new_evidence_invalidates_prior_issue').lifecycleSamples.invalidated.resolutionState, 'INVALIDATED_BY_NEW_EVIDENCE');
  assert.ok(evidence.assessments.every((item) => item.assessment.explanations.every((explanation) => explanation.mechanicalCauseInferred === false && explanation.futureBreakdownPredicted === false && explanation.employeeNegligenceInferred === false)));

  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'unavailable_vehicle').assessment.readiness.state = 'READY'; }, 'UNAVAILABLE_VEHICLE_MARKED_READY');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'out_of_service_vehicle').assessment.readiness.state = 'READY'; }, 'OUT_OF_SERVICE_VEHICLE_MARKED_READY');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'route_incompatible_vehicle').assessment.readiness.state = 'READY'; }, 'ROUTE_INCOMPATIBLE_VEHICLE_MARKED_READY');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'insufficient_evidence').assessment.readiness.state = 'READY'; }, 'MISSING_CRITICAL_EVIDENCE_MARKED_READY');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'assignment_mismatch').assessment.assignment.outcome = 'MATCH'; }, 'ASSIGNMENT_MISMATCH_MARKED_VERIFIED');
  expectValidationFailure((e) => {
    const assessment = e.assessments.find((item) => item.caseId === 'maintenance_status_unknown').assessment;
    assessment.maintenance.state = 'NO_KNOWN_BLOCKER';
  }, 'UNKNOWN_MAINTENANCE_CONVERTED_TO_NO_BLOCKER');
  for (const field of ['predictiveFailureProbability','predictedBreakdownDate','recommendedReplacement','autonomousDispatch','autonomousRepairApproval','autonomousPartsPurchase','employeeScore','driverScore','productivityRating','disciplinaryRecommendation','provider','model','productionActivation','implementationPackageNumber','customerIntelligenceImplemented']) {
    expectValidationFailure((e) => { e.assessments[0].assessment[field] = field === 'implementationPackageNumber' ? 'AI-IEP-005B.3' : true; }, 'PROHIBITED_SCOPE_FIELD');
  }

  const docsText = fs.readFileSync(path.join(docsDir, 'EXISTING_FLEET_SCORING_BOUNDARY.md'), 'utf8');
  assert.ok(docsText.includes('separate analytics/scoring subsystem'), 'fleet scoring boundary must be documented');
  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:fleet-intelligence] context, vehicle availability/readiness, assignment, route compatibility, maintenance awareness, route impact, alerts, lifecycle, explanations, fleet-scoring boundary, generated artifacts, and prohibited-scope mutations verified.');
}

main();
