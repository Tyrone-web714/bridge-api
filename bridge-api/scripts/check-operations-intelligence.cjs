#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const operations = require('../services/intelligenceExecution/operationsIntelligence');
const { generate } = require('./generate-operations-intelligence-artifacts.cjs');

const docsDir = path.dirname(operations.paths.generatedRoot);
const REQUIRED_DOCS = [
  'README.md',
  'CURRENT_OPERATIONS_FUNCTIONALITY_AUDIT.md',
  'OPERATIONS_INTELLIGENCE_ARCHITECTURE.md',
  'EXISTING_SERVICE_REUSE_DECISION.md',
  'AUTHORITATIVE_DOMAIN_BOUNDARIES.md',
  'ORGANIZATION_OPERATIONS_CONTEXT.md',
  'CROSS_DOMAIN_OPERATIONAL_SNAPSHOT.md',
  'ROUTE_OPERATIONAL_AGGREGATION.md',
  'DRIVER_OPERATIONAL_AGGREGATION.md',
  'SUPERVISOR_OPERATIONAL_AGGREGATION.md',
  'WAREHOUSE_OPERATIONAL_AGGREGATION.md',
  'FLEET_OPERATIONAL_AGGREGATION.md',
  'CUSTOMER_OPERATIONAL_AGGREGATION.md',
  'CROSS_DOMAIN_CORRELATION.md',
  'OPERATIONS_EXCEPTION_MODEL.md',
  'OPERATIONS_SEVERITY_MODEL.md',
  'OPERATIONS_PRIORITY_MODEL.md',
  'OPERATIONS_ALERT_MODEL.md',
  'ALERT_LIFECYCLE.md',
  'OPERATIONS_SUMMARY_MODEL.md',
  'DETERMINISTIC_EXPLANATIONS.md',
  'EVIDENCE_COMPLETENESS_CONFIDENCE.md',
  'EVIDENCE_FRESHNESS.md',
  'CROSS_DOMAIN_AUTHORITY_TRACE.md',
  'EMPLOYMENT_IMPACT_GUARDRAILS.md',
  'AUTONOMOUS_ACTION_BOUNDARY.md',
  'PREDICTIVE_MODEL_BOUNDARY.md',
  'PRODUCT_SCOPE_BOUNDARY.md',
  'BENCHMARK_DATASETS.md',
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
  'ROLLBACK_PLAN.md'
];
const REQUIRED_GENERATED = [
  'operations_context_contract.json',
  'operations_snapshot_catalog.json',
  'operations_cross_domain_evidence.json',
  'operations_exception_catalog.json',
  'operations_severity_catalog.json',
  'operations_alert_catalog.json',
  'operations_reason_code_catalog.json',
  'operations_evidence_report.json',
  'operations_summary_report.json',
  'operations_benchmark_catalog.json',
  'OPERATIONS_INTELLIGENCE_SUMMARY.md'
];

function readGenerated() {
  if (!fs.existsSync(operations.paths.generatedRoot)) return [];
  return fs.readdirSync(operations.paths.generatedRoot).sort().map((file) => [file, fs.readFileSync(path.join(operations.paths.generatedRoot, file), 'utf8')]);
}

function byCase(evidence) {
  return Object.fromEntries(evidence.assessments.map((item) => [item.caseId, item.assessment]));
}

function expectValidationFailure(mutator, expectedRule) {
  const evidence = operations.buildOperationsIntelligenceEvidence();
  mutator(evidence);
  const validation = operations.validateOperationsIntelligenceEvidence(evidence);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function expectAssessmentFailure(mutator, expectedRule) {
  const assessment = operations.buildOperationsAssessment({
    operationsContext: {
      operationsContextId: 'operations.context.test',
      organizationId: 'org-001',
      workPeriod: { start: '2026-08-11T08:00:00.000Z', end: '2026-08-11T12:00:00.000Z' }
    },
    domainEvidence: [operations.evidence('ROUTE', 'route.test', { sourceStatus: 'DELAYED' })]
  });
  mutator(assessment);
  const validation = operations.validateOperationsAssessment(assessment);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function main() {
  assert.strictEqual(operations.OPERATIONS_INTELLIGENCE_SCHEMA_VERSION, 'operations.intelligence.foundation.v1');
  assert.strictEqual(operations.OPERATIONS_INTELLIGENCE_ENGINE_VERSION, 'operations.intelligence.foundation.engine.v1');
  for (const doc of REQUIRED_DOCS) assert.ok(fs.existsSync(path.join(docsDir, doc)), `missing doc ${doc}`);
  for (const file of REQUIRED_GENERATED) assert.ok(fs.existsSync(path.join(operations.paths.generatedRoot, file)), `missing generated artifact ${file}`);

  const evidence = operations.buildOperationsIntelligenceEvidence();
  assert.deepStrictEqual(operations.buildOperationsIntelligenceEvidence(), evidence, 'Operations evidence generation must be deterministic');
  const validation = operations.validateOperationsIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(evidence.benchmarkCases.length >= 24, 'expected operations benchmark coverage');
  assert.strictEqual(evidence.catalog.currentOperationsFunctionalityAuditComplete, true);
  assert.strictEqual(evidence.catalog.serviceReuseDecisionDocumented, true);
  assert.strictEqual(evidence.catalog.integratedWithRouteIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithDriverIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithSupervisorIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithWarehouseIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithFleetIntelligence, true);
  assert.strictEqual(evidence.catalog.integratedWithCustomerIntelligence, true);
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.modelSelectionActivated, false);
  assert.strictEqual(evidence.catalog.productionOrchestrationActivated, false);
  assert.strictEqual(evidence.catalog.productionApiExposed, false);
  assert.strictEqual(evidence.catalog.migrationExecuted, false);
  assert.strictEqual(evidence.catalog.deploymentExecuted, false);
  assert.strictEqual(evidence.catalog.employeeScoringGenerated, false);
  assert.strictEqual(evidence.catalog.autonomousActionGenerated, false);
  assert.strictEqual(evidence.catalog.predictionGenerated, false);
  assert.strictEqual(evidence.catalog.productSuiteExpansionGenerated, false);
  assert.strictEqual(evidence.catalog.safetyIntelligenceStarted, false);

  const cases = byCase(evidence);
  assert.strictEqual(cases.normal_organization_operations.snapshot.completedRoutes, 1);
  assert.strictEqual(cases.one_delayed_route.exceptions.some((item) => item.exceptionType === 'ROUTE_OPERATION_EXCEPTION'), true);
  assert.strictEqual(cases.multiple_delayed_routes.exceptions.some((item) => item.exceptionType === 'MULTIPLE_ROUTE_EXCEPTIONS'), true);
  assert.strictEqual(cases.safety_blocked_route.exceptions.some((item) => item.exceptionType === 'ROUTE_SAFETY_BLOCKER_ACTIVE' && item.severity === 'CRITICAL'), true);
  assert.strictEqual(cases.warehouse_blocked_departure.exceptions.some((item) => item.exceptionType === 'WAREHOUSE_DEPARTURE_BLOCKER_ACTIVE'), true);
  assert.strictEqual(cases.vehicle_blocked_route.exceptions.some((item) => item.exceptionType === 'VEHICLE_ROUTE_BLOCKER_ACTIVE'), true);
  assert.strictEqual(cases.unresolved_customer_service_issue.exceptions.some((item) => item.exceptionType === 'CUSTOMER_SERVICE_EXCEPTION_ACTIVE'), true);
  assert.strictEqual(cases.missing_driver_operational_evidence.exceptions.some((item) => item.exceptionType === 'DRIVER_OPERATIONAL_EVIDENCE_UNAVAILABLE'), true);
  assert.strictEqual(cases.unresolved_supervisor_alert.exceptions.some((item) => item.exceptionType === 'SUPERVISOR_ALERT_UNRESOLVED'), true);
  assert.ok(cases.correlated_warehouse_blocker_route_delay.correlations.length > 0);
  assert.strictEqual(cases.correlated_warehouse_blocker_route_delay.correlations.every((item) => item.causationClaimed === false), true);
  assert.strictEqual(cases.stale_evidence.exceptions.some((item) => item.exceptionType === 'OPERATIONAL_EVIDENCE_STALE'), true);
  assert.strictEqual(cases.conflicting_evidence.exceptions.some((item) => item.exceptionType === 'OPERATIONAL_EVIDENCE_CONFLICT'), true);
  assert.strictEqual(cases.insufficient_evidence.exceptions.some((item) => item.exceptionType === 'INSUFFICIENT_EVIDENCE'), true);
  assert.strictEqual(cases.cross_organization_evidence_rejection.context.organizationIsolationPreserved, false);
  assert.strictEqual(cases.cross_organization_evidence_rejection.exceptions.some((item) => item.exceptionType === 'HUMAN_REVIEW_REQUIRED'), true);
  assert.strictEqual(cases.human_review.summary.humanReviewCount > 0, true);
  assert.strictEqual(cases.acknowledgement.alertLifecycle.acknowledgedAlert.acknowledgementState, 'ACKNOWLEDGED');
  assert.strictEqual(cases.resolution.alertLifecycle.resolvedAlert.resolutionState, 'RESOLVED');
  assert.strictEqual(cases.new_evidence_invalidating_alert.alertLifecycle.invalidatedAlert.resolutionState, 'INVALIDATED_BY_NEW_EVIDENCE');
  assert.strictEqual(cases.no_exception_case.exceptions.length, 0);
  assert.ok(evidence.assessments.every((item) => item.assessment.explanation.employeeIntentInferred === false && item.assessment.explanation.negligenceInferred === false && item.assessment.explanation.futureOutcomePredicted === false));
  assert.ok(evidence.assessments.every((item) => item.assessment.authorityTrace.lowerDomainsRemainAuthoritative === true));

  expectAssessmentFailure((a) => { a.lowerDomainOverrideAttempted = true; }, 'LOWER_DOMAIN_FACT_OVERRIDDEN');
  expectAssessmentFailure((a) => { a.context.organizationIsolationPreserved = false; a.exceptions = []; }, 'CROSS_ORGANIZATION_EVIDENCE_AGGREGATED');
  expectAssessmentFailure((a) => { a.context.unknownFields = ['missing']; a.exceptions = []; }, 'UNKNOWN_SOURCE_EVIDENCE_TREATED_AS_KNOWN');
  expectAssessmentFailure((a) => { a.context.staleEvidenceIndicators = ['stale']; a.exceptions = []; }, 'STALE_EVIDENCE_TREATED_AS_FRESH');
  expectAssessmentFailure((a) => { a.correlationUsedAsCausation = true; }, 'CORRELATION_USED_AS_CAUSATION');
  expectValidationFailure((e) => {
    const normal = e.assessments.find((item) => item.caseId === 'no_exception_case');
    normal.assessment.exceptions.push({ exceptionType: 'CROSS_DOMAIN_OPERATIONAL_CONFLICT', exceptionId: 'operations.exception.false-normal-cooccurrence' });
  }, 'NORMAL_COOCCURRENCE_FALSE_EXCEPTION');
  for (const field of ['employeeScore','driverScore','productivityScore','disciplinaryRecommendation','terminationRecommendation','autonomousDispatch','automaticRouteReassignment','automaticDriverReassignment','automaticVehicleReassignment','automaticWorkforceScheduling','predictedDelay','workloadForecast','demandForecast','predictiveScore','erpWorkflow','tmsExpansion','wmsExpansion','crmExpansion','modelSelection','productionActivation','implementationPackageNumber','safetyIntelligenceImplemented']) {
    expectValidationFailure((e) => {
      e.assessments[0].assessment[field] = field === 'implementationPackageNumber' ? 'AI-IEP-005B.7' : true;
    }, field === 'implementationPackageNumber' ? 'PROHIBITED_SCOPE_FIELD' : 'PROHIBITED_SCOPE_FIELD');
  }
  expectValidationFailure((e) => { e.catalog.modelSelectionActivated = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.catalog.productionOrchestrationActivated = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.catalog.safetyIntelligenceStarted = true; }, 'PROHIBITED_CAPABILITY_FLAG');

  const audit = fs.readFileSync(path.join(docsDir, 'CURRENT_OPERATIONS_FUNCTIONALITY_AUDIT.md'), 'utf8');
  for (const phrase of ['services/logisticsIntelligence.js','services/biKpi.js','routes/operationalHeatmaps.js','routeManifests.js','EXTEND']) assert.ok(audit.includes(phrase), `audit missing ${phrase}`);
  const boundaries = fs.readFileSync(path.join(docsDir, 'AUTHORITATIVE_DOMAIN_BOUNDARIES.md'), 'utf8');
  assert.ok(boundaries.includes('cannot recompute, override, or replace lower-domain determinations'));
  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:operations-intelligence] context, snapshot, domain aggregation, correlation, exceptions, severity, priority, alerts, lifecycle, explanations, evidence, authority trace, platform boundaries, generated artifacts, and prohibited-scope mutations verified.');
}

main();
