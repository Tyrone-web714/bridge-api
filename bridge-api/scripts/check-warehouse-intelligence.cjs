#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const warehouse = require('../services/intelligenceExecution/warehouseIntelligence');
const { generate } = require('./generate-warehouse-intelligence-artifacts.cjs');

const docsDir = path.dirname(warehouse.paths.generatedRoot);
const REQUIRED_DOCS = [
  'README.md','CURRENT_WAREHOUSE_FUNCTIONALITY_AUDIT.md','WAREHOUSE_INTELLIGENCE_ARCHITECTURE.md','EXISTING_SERVICE_REUSE_DECISION.md','AUTHORITATIVE_DATA_BOUNDARIES.md','WAREHOUSE_CONTEXT_CONTRACT.md','ROUTE_LOAD_CONTEXT.md','ROUTE_STAGING_MODEL.md','ROUTE_LOADING_MODEL.md','LOAD_ASSIGNMENT_VERIFICATION.md','LOAD_COMPLETENESS_MODEL.md','PRODUCT_LOAD_DISCREPANCIES.md','DEPARTURE_READINESS_MODEL.md','READINESS_RULE_HIERARCHY.md','WAREHOUSE_EXCEPTION_MODEL.md','EXCEPTION_SEVERITY_MODEL.md','WAREHOUSE_ALERT_MODEL.md','ALERT_LIFECYCLE.md','SUPERVISOR_WAREHOUSE_COORDINATION.md','DETERMINISTIC_EXPLANATIONS.md','EVIDENCE_AND_CONFIDENCE.md','REASON_CODES.md','ROUTE_INTELLIGENCE_INTEGRATION.md','DRIVER_INTELLIGENCE_INTEGRATION.md','SUPERVISOR_INTELLIGENCE_INTEGRATION.md','WAREHOUSE_SECURITY_MFA_BOUNDARY.md','BENCHMARK_DATASETS.md','PLATFORM_INTEGRATION.md','KNOWLEDGE_GRAPH_INTEGRATION.md','DASHBOARD_INTEGRATION.md','SECURITY_AND_TENANT_REVIEW.md','EMPLOYMENT_IMPACT_GUARDRAILS.md','TEST_PLAN.md','TEST_RESULTS.md','IMPLEMENTATION_REPORT.md','DEFERRED_WORK.md','OWNER_DECISIONS_REQUIRED.md','ROLLBACK_PLAN.md'
];
const REQUIRED_GENERATED = [
  'warehouse_context_contract.json','warehouse_route_load_catalog.json','warehouse_staging_state_catalog.json','warehouse_loading_state_catalog.json','warehouse_discrepancy_catalog.json','warehouse_departure_readiness_catalog.json','warehouse_exception_catalog.json','warehouse_alert_catalog.json','warehouse_reason_code_catalog.json','warehouse_benchmark_catalog.json','warehouse_evidence_report.json','warehouse_readiness_report.json','WAREHOUSE_INTELLIGENCE_SUMMARY.md'
];

function readGenerated() {
  if (!fs.existsSync(warehouse.paths.generatedRoot)) return [];
  return fs.readdirSync(warehouse.paths.generatedRoot).sort().map((file) => [file, fs.readFileSync(path.join(warehouse.paths.generatedRoot, file), 'utf8')]);
}

function expectValidationFailure(mutator, expectedRule) {
  const evidence = warehouse.buildWarehouseIntelligenceEvidence();
  mutator(evidence);
  const validation = warehouse.validateWarehouseIntelligenceEvidence(evidence);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function main() {
  assert.strictEqual(warehouse.WAREHOUSE_INTELLIGENCE_SCHEMA_VERSION, 'warehouse.intelligence.foundation.v1');
  assert.strictEqual(warehouse.WAREHOUSE_INTELLIGENCE_ENGINE_VERSION, 'warehouse.intelligence.foundation.engine.v1');
  for (const doc of REQUIRED_DOCS) assert.ok(fs.existsSync(path.join(docsDir, doc)), `missing doc ${doc}`);
  for (const file of REQUIRED_GENERATED) assert.ok(fs.existsSync(path.join(warehouse.paths.generatedRoot, file)), `missing generated artifact ${file}`);

  const evidence = warehouse.buildWarehouseIntelligenceEvidence();
  const second = warehouse.buildWarehouseIntelligenceEvidence();
  assert.deepStrictEqual(second, evidence, 'Warehouse evidence generation must be deterministic');
  const validation = warehouse.validateWarehouseIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(evidence.benchmarkCases.length >= 30, 'expected warehouse benchmark coverage');
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.productionApiExposed, false);
  assert.strictEqual(evidence.catalog.employeeScoring, false);
  assert.strictEqual(evidence.catalog.autonomousPurchasingProhibited, true);
  assert.strictEqual(evidence.catalog.roboticsScopeProhibited, true);
  assert.strictEqual(evidence.catalog.warehouseMfaBoundaryPreserved, true);

  const byCase = Object.fromEntries(evidence.assessments.map((item) => [item.caseId, item.assessment]));
  assert.strictEqual(byCase.correct_assignment.assignment.outcome, 'MATCH');
  assert.strictEqual(byCase.wrong_route_load_assignment.assignment.outcome, 'MISMATCH');
  assert.strictEqual(byCase.unknown_quantity.completeness.outcome, 'INSUFFICIENT_EVIDENCE');
  assert.ok(byCase.unknown_quantity.completeness.unknownQuantities.length > 0);
  assert.strictEqual(byCase.loading_partial.loading.state, 'PARTIALLY_LOADED');
  assert.notStrictEqual(byCase.loading_partial.readiness.state, 'READY');
  assert.strictEqual(byCase.missing_product.completeness.outcome, 'DISCREPANCY');
  assert.strictEqual(byCase.unexpected_product.completeness.outcome, 'DISCREPANCY');
  assert.strictEqual(byCase.quantity_short.discrepancies.some((item) => item.discrepancyType === 'QUANTITY_SHORT'), true);
  assert.strictEqual(byCase.quantity_over.discrepancies.some((item) => item.discrepancyType === 'QUANTITY_OVER'), true);
  assert.strictEqual(byCase.manifest_unavailable.readiness.state, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(byCase.load_evidence_unavailable.readiness.state, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(byCase.stale_evidence.discrepancies.some((item) => item.discrepancyType === 'LOAD_EVIDENCE_STALE'), true);
  assert.strictEqual(byCase.conflicting_evidence.readiness.state, 'BLOCKED');
  assert.strictEqual(byCase.all_evidence_ready.readiness.state, 'READY');
  assert.strictEqual(byCase.load_complete_route_safety_blocked.readiness.state, 'BLOCKED');
  assert.strictEqual(byCase.cross_organization_evidence.readiness.state, 'INSUFFICIENT_EVIDENCE');
  assert.ok(byCase.route_ready_with_human_review.readiness.humanReviewRequired);
  assert.ok(byCase.supervisor_review.supervisorCoordination.length > 0);
  assert.ok(byCase.alert_acknowledgement.alerts.length > 0);
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'alert_acknowledgement').lifecycleSamples.acknowledged.acknowledgementState, 'ACKNOWLEDGED');
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'alert_resolution').lifecycleSamples.resolved.resolutionState, 'RESOLVED');
  assert.strictEqual(evidence.assessments.find((item) => item.caseId === 'new_evidence_invalidates_discrepancy').lifecycleSamples.invalidated.resolutionState, 'INVALIDATED_BY_NEW_EVIDENCE');
  assert.ok(evidence.assessments.every((item) => item.assessment.explanations.every((explanation) => explanation.negligenceInferred === false && explanation.productivityInferred === false)));

  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'wrong_route_load_assignment').assessment.assignment.outcome = 'MATCH'; }, 'ROUTE_LOAD_MISMATCH_MARKED_MATCH');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'unknown_quantity').assessment.completeness.outcome = 'COMPLETE'; }, 'INCOMPLETE_LOAD_MARKED_COMPLETE');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'missing_product').assessment.readiness.state = 'READY'; }, 'CRITICAL_DISCREPANCY_MARKED_READY');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'manifest_unavailable').assessment.completeness.outcome = 'COMPLETE'; }, 'INCOMPLETE_LOAD_MARKED_COMPLETE');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'load_complete_route_safety_blocked').assessment.readiness.state = 'READY'; }, 'SAFETY_BLOCKED_ROUTE_MARKED_READY');
  expectValidationFailure((e) => { e.assessments[0].assessment.employeeScore = 1; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.productivityRating = 'A'; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.disciplinaryRecommendation = 'warn'; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.terminationRecommendation = true; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.autonomousPurchaseRecommendation = true; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.roboticsAction = true; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.provider = 'hosted'; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.productionActivation = true; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.implementationPackageNumber = 'AI-IEP-005B.3'; }, 'PROHIBITED_SCOPE_FIELD');
  expectValidationFailure((e) => { e.assessments[0].assessment.fleetIntelligenceImplemented = true; }, 'PROHIBITED_SCOPE_FIELD');

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:warehouse-intelligence] context, route/load assignment, staging, loading, completeness, discrepancies, readiness, exceptions, alerts, lifecycle, explanations, security/MFA boundary, platform integrations, generated artifacts, and prohibited-scope mutations verified.');
}

main();
