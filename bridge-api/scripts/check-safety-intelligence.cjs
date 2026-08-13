#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const safety = require('../services/intelligenceExecution/safetyIntelligence');
const { generate } = require('./generate-safety-intelligence-artifacts.cjs');

const docsDir = path.dirname(safety.paths.generatedRoot);
const REQUIRED_DOCS = [
  'README.md',
  'CURRENT_SAFETY_FUNCTIONALITY_AUDIT.md',
  'SAFETY_INTELLIGENCE_ARCHITECTURE.md',
  'EXISTING_SERVICE_REUSE_DECISION.md',
  'AUTHORITATIVE_SAFETY_BOUNDARIES.md',
  'ORGANIZATION_SAFETY_CONTEXT.md',
  'ROUTE_SAFETY_PORTFOLIO.md',
  'LOW_CLEARANCE_SAFETY_AWARENESS.md',
  'TRUCK_RESTRICTION_AWARENESS.md',
  'ROAD_CLOSURE_AWARENESS.md',
  'RESIDENTIAL_RESTRICTION_AWARENESS.md',
  'DRIVER_SAFETY_ADVISORY_AGGREGATION.md',
  'SPEED_WARNING_BOUNDARY.md',
  'VEHICLE_ROUTE_SAFETY_COMPATIBILITY.md',
  'WAREHOUSE_SAFETY_IMPACT.md',
  'OPERATIONS_SAFETY_EXCEPTION_INTEGRATION.md',
  'SHARED_SAFETY_INTELLIGENCE_INTEGRATION.md',
  'SAFETY_EXCEPTION_MODEL.md',
  'SAFETY_SEVERITY_MODEL.md',
  'SAFETY_PRIORITY_MODEL.md',
  'SAFETY_ALERT_MODEL.md',
  'ALERT_LIFECYCLE.md',
  'SAFETY_SUMMARY_MODEL.md',
  'DETERMINISTIC_EXPLANATIONS.md',
  'SAFETY_EVIDENCE_FRESHNESS.md',
  'SAFETY_AUTHORITY_TRACE.md',
  'EMPLOYMENT_DRIVER_IMPACT_BOUNDARY.md',
  'AUTONOMOUS_SAFETY_ACTION_BOUNDARY.md',
  'PREDICTIVE_SAFETY_BOUNDARY.md',
  'MONITORING_HARDWARE_BOUNDARY.md',
  'COMPLIANCE_INSURANCE_BOUNDARY.md',
  'BENCHMARK_DATASETS.md',
  'REGRESSION_BOUNDARIES.md',
  'PLATFORM_INTEGRATION.md',
  'KNOWLEDGE_GRAPH_INTEGRATION.md',
  'DASHBOARD_INTEGRATION.md',
  'SECURITY_AND_TENANT_REVIEW.md',
  'DATA_LIFECYCLE_REVIEW.md',
  'TEST_PLAN.md',
  'TEST_RESULTS.md',
  'IMPLEMENTATION_REPORT.md',
  'DEFERRED_WORK.md',
  'OWNER_DECISIONS_REQUIRED.md',
  'UNAPPROVED_IDEAS_FOR_OWNER_REVIEW.md',
  'ROLLBACK_PLAN.md',
  'GENERATED_ARTIFACTS.md'
];
const REQUIRED_GENERATED = [
  'safety_context_contract.json',
  'safety_route_portfolio.json',
  'safety_hazard_catalog.json',
  'safety_driver_advisory_catalog.json',
  'safety_shared_intelligence_catalog.json',
  'safety_exception_catalog.json',
  'safety_severity_catalog.json',
  'safety_alert_catalog.json',
  'safety_reason_code_catalog.json',
  'safety_evidence_report.json',
  'safety_summary_report.json',
  'safety_benchmark_catalog.json',
  'SAFETY_INTELLIGENCE_SUMMARY.md'
];

function readGenerated() {
  if (!fs.existsSync(safety.paths.generatedRoot)) return [];
  return fs.readdirSync(safety.paths.generatedRoot).sort().map((file) => [file, fs.readFileSync(path.join(safety.paths.generatedRoot, file), 'utf8')]);
}

function byCase(evidence) {
  return Object.fromEntries(evidence.assessments.map((item) => [item.caseId, item.assessment]));
}

function hasException(assessment, type) {
  return assessment.exceptions.some((item) => item.exceptionType === type);
}

function expectValidationFailure(mutator, expectedRule) {
  const evidence = safety.buildSafetyIntelligenceEvidence();
  mutator(evidence);
  const validation = safety.validateSafetyIntelligenceEvidence(evidence);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function expectAssessmentFailure(mutator, expectedRule) {
  const assessment = safety.buildSafetyAssessment({
    safetyContext: safety.baseContext(),
    safetyEvidence: [safety.evidence('ROUTE', 'route.test', { safetyCondition: 'LOW_CLEARANCE_HAZARD_ACTIVE', safetyRelevant: true })]
  });
  mutator(assessment);
  const validation = safety.validateSafetyAssessment(assessment);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function main() {
  assert.strictEqual(safety.SAFETY_INTELLIGENCE_SCHEMA_VERSION, 'safety.intelligence.foundation.v1');
  assert.strictEqual(safety.SAFETY_INTELLIGENCE_ENGINE_VERSION, 'safety.intelligence.foundation.engine.v1');
  for (const doc of REQUIRED_DOCS) assert.ok(fs.existsSync(path.join(docsDir, doc)), `missing doc ${doc}`);
  for (const file of REQUIRED_GENERATED) assert.ok(fs.existsSync(path.join(safety.paths.generatedRoot, file)), `missing generated artifact ${file}`);

  const evidence = safety.buildSafetyIntelligenceEvidence();
  assert.deepStrictEqual(safety.buildSafetyIntelligenceEvidence(), evidence, 'Safety evidence generation must be deterministic');
  const validation = safety.validateSafetyIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(evidence.benchmarkCases.length >= 34, 'expected safety benchmark coverage');
  assert.strictEqual(evidence.catalog.currentSafetyFunctionalityAuditComplete, true);
  assert.strictEqual(evidence.catalog.serviceReuseDecisionDocumented, true);
  assert.strictEqual(evidence.catalog.integratedWithRouteIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithDriverIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithFleetIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithWarehouseIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithOperationsIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithSharedSafety, true);
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.hostedAiInvoked, false);
  assert.strictEqual(evidence.catalog.modelSelectionActivated, false);
  assert.strictEqual(evidence.catalog.productionOrchestrationActivated, false);
  assert.strictEqual(evidence.catalog.productionApiExposed, false);
  assert.strictEqual(evidence.catalog.migrationExecuted, false);
  assert.strictEqual(evidence.catalog.deploymentExecuted, false);
  assert.strictEqual(evidence.catalog.safetyScoreGenerated, false);
  assert.strictEqual(evidence.catalog.employeeRankingGenerated, false);
  assert.strictEqual(evidence.catalog.negligenceConclusionGenerated, false);
  assert.strictEqual(evidence.catalog.autonomousActionGenerated, false);
  assert.strictEqual(evidence.catalog.predictionGenerated, false);
  assert.strictEqual(evidence.catalog.monitoringHardwareIntroduced, false);
  assert.strictEqual(evidence.catalog.complianceProductExpanded, false);

  const cases = byCase(evidence);
  assert.strictEqual(cases.no_known_safety_exception.exceptions.length, 0);
  assert.strictEqual(cases.no_exception_case.exceptions.length, 0);
  assert.strictEqual(cases.ordinary_warehouse_issue.exceptions.length, 0);
  assert.strictEqual(cases.ordinary_operations_exception.exceptions.length, 0);
  assert.ok(hasException(cases.safety_blocked_route, 'ROUTE_SAFETY_BLOCKER_ACTIVE'));
  assert.ok(hasException(cases.low_clearance_blocker, 'LOW_CLEARANCE_HAZARD_ACTIVE'));
  assert.ok(hasException(cases.low_clearance_review, 'LOW_CLEARANCE_HAZARD_ACTIVE'));
  assert.ok(hasException(cases.truck_prohibition, 'TRUCK_RESTRICTION_ACTIVE'));
  assert.ok(hasException(cases.no_through_truck_restriction, 'NO_THROUGH_TRUCK_RESTRICTION_ACTIVE'));
  assert.strictEqual(cases.local_delivery_exception.exceptions.length, 0);
  assert.ok(hasException(cases.road_closure, 'ROAD_CLOSURE_ACTIVE'));
  assert.ok(hasException(cases.residential_restriction, 'RESIDENTIAL_RESTRICTION_ACTIVE'));
  assert.ok(hasException(cases.residential_advisory, 'RESIDENTIAL_RESTRICTION_ACTIVE'));
  assert.ok(hasException(cases.route_vehicle_incompatible, 'ROUTE_VEHICLE_INCOMPATIBLE'));
  assert.ok(hasException(cases.route_vehicle_review_required, 'HUMAN_REVIEW_REQUIRED'));
  assert.ok(hasException(cases.driver_low_bridge_advisory, 'DRIVER_SAFETY_ADVISORY_ACTIVE'));
  assert.ok(hasException(cases.restricted_road_advisory, 'DRIVER_SAFETY_ADVISORY_ACTIVE'));
  assert.ok(hasException(cases.no_through_truck_advisory, 'DRIVER_SAFETY_ADVISORY_ACTIVE'));
  assert.ok(hasException(cases.speed_advisory, 'DRIVER_SAFETY_ADVISORY_ACTIVE'));
  assert.ok(hasException(cases.speed_warning, 'DRIVER_SPEED_WARNING_ACTIVE'));
  assert.ok(hasException(cases.stale_speed_evidence, 'SAFETY_EVIDENCE_STALE'));
  assert.ok(hasException(cases.missing_safety_evidence, 'SAFETY_EVIDENCE_INCOMPLETE'));
  assert.ok(hasException(cases.conflicting_safety_evidence, 'SAFETY_EVIDENCE_CONFLICT'));
  assert.ok(hasException(cases.warehouse_safety_blocker, 'HUMAN_REVIEW_REQUIRED'));
  assert.ok(hasException(cases.operations_safety_exception, 'HUMAN_REVIEW_REQUIRED'));
  assert.strictEqual(cases.shared_safety_record_accepted.exceptions.length, 0);
  assert.ok(hasException(cases.shared_safety_record_review, 'SHARED_SAFETY_REVIEW_REQUIRED'));
  assert.ok(hasException(cases.multiple_simultaneous_safety_exceptions, 'MULTIPLE_SAFETY_EXCEPTIONS'));
  assert.strictEqual(cases.critical_blocker_outranks_informational_advisory.alerts[0].priority.priority, 'P0');
  assert.strictEqual(cases.cross_organization_safety_aggregation_rejected.crossOrganizationAggregationRejected, true);
  assert.ok(hasException(cases.cross_organization_safety_aggregation_rejected, 'HUMAN_REVIEW_REQUIRED'));
  assert.ok(hasException(cases.human_review, 'HUMAN_REVIEW_REQUIRED'));
  assert.strictEqual(cases.acknowledgement.alertLifecycle.acknowledgedAlert.acknowledgementState, 'ACKNOWLEDGED');
  assert.strictEqual(cases.resolution.alertLifecycle.resolvedAlert.resolutionState, 'RESOLVED');
  assert.strictEqual(cases.invalidation_by_new_evidence.alertLifecycle.invalidatedAlert.resolutionState, 'INVALIDATED_BY_NEW_EVIDENCE');
  assert.ok(evidence.assessments.every((item) => item.assessment.authorityTrace.lowerDomainsRemainAuthoritative === true));
  assert.ok(evidence.assessments.every((item) => item.assessment.driverOrEmployeeScoringGenerated === false && item.assessment.negligenceConclusionGenerated === false && item.assessment.autonomousActionGenerated === false && item.assessment.predictionGenerated === false));

  expectAssessmentFailure((a) => { a.lowerDomainOverrideAttempted = true; }, 'LOWER_DOMAIN_SAFETY_CONCLUSION_OVERRIDDEN');
  expectAssessmentFailure((a) => { a.context.organizationIsolationPreserved = false; a.crossOrganizationAggregationRejected = false; }, 'CROSS_ORGANIZATION_EVIDENCE_AGGREGATED');
  expectAssessmentFailure((a) => { a.context.unknownFields = ['missing']; a.unknownEvidenceTreatedAsSafe = true; }, 'UNKNOWN_EVIDENCE_TREATED_AS_SAFE');
  expectAssessmentFailure((a) => { a.context.staleEvidenceIndicators = ['stale']; a.staleEvidenceTreatedAsFresh = true; }, 'STALE_EVIDENCE_TREATED_AS_FRESH');
  expectValidationFailure((e) => {
    const ordinary = e.assessments.find((item) => item.caseId === 'ordinary_operations_exception');
    ordinary.assessment.exceptions.push({ exceptionType: 'HUMAN_REVIEW_REQUIRED', exceptionId: 'safety.exception.false-operations' });
  }, 'FALSE_SAFETY_EXCEPTION');
  expectValidationFailure((e) => {
    const ordinary = e.assessments.find((item) => item.caseId === 'ordinary_warehouse_issue');
    ordinary.assessment.exceptions.push({ exceptionType: 'HUMAN_REVIEW_REQUIRED', exceptionId: 'safety.exception.false-warehouse' });
  }, 'FALSE_SAFETY_EXCEPTION');
  for (const field of ['driverSafetyScore','employeeSafetyScore','driverRiskScore','employeeRiskScore','unsafeDriverLabel','driverRanking','safetyRanking','productivityScore','negligenceConclusion','misconductConclusion','disciplinaryRecommendation','terminationRecommendation','compensationRecommendation','autonomousRouteShutdown','autonomousDriverLockout','autonomousVehicleLockout','autonomousDispatch','automaticSafetyEnforcement','crashPrediction','fatiguePrediction','driverBehaviorPrediction','insuranceRiskPrediction','cameraDriverMonitoring','computerVisionMonitoring','biometricMonitoring','newTelematicsDevice','newELDIntegration','OSHAPlatform','DOTCompliancePlatform','insuranceEligibility','legalLiabilityConclusion','providerModelSelection','productionActivation','implementationPackageNumber','ninthMilestoneOneDomain']) {
    expectValidationFailure((e) => {
      e.assessments[0].assessment[field] = field === 'implementationPackageNumber' ? 'AI-IEP-005B.8' : true;
    }, field === 'implementationPackageNumber' ? 'PROHIBITED_SCOPE_FIELD' : 'PROHIBITED_SCOPE_FIELD');
  }
  expectValidationFailure((e) => { e.catalog.modelSelectionActivated = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.catalog.productionOrchestrationActivated = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.assessments[0].assessment.implementationPackageNumber = 'AI-IEP-005B.8'; }, 'SAFETY_PACKAGE_NUMBER_FABRICATED');
  expectValidationFailure((e) => { e.assessments[0].assessment.ninthMilestoneOneDomain = 'NINTH_MILESTONE_ONE_DOMAIN'; }, 'NINTH_MILESTONE_ONE_DOMAIN');

  const audit = fs.readFileSync(path.join(docsDir, 'CURRENT_SAFETY_FUNCTIONALITY_AUDIT.md'), 'utf8');
  for (const phrase of ['routeIntelligence.js','driverIntelligence.js','fleetIntelligence.js','warehouseIntelligence.js','operationsIntelligence.js','services/sharedSafety.js','REFERENCE_ONLY','OUT_OF_SCOPE','EXTEND']) assert.ok(audit.includes(phrase), `audit missing ${phrase}`);
  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:safety-intelligence] safety context, route portfolio, hazard/advisory aggregation, shared safety, exceptions, severity, priority, alerts, lifecycle, explanations, authority trace, boundaries, generated artifacts, and prohibited-scope mutations verified.');
}

main();
