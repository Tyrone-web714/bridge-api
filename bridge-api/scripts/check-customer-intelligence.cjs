#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const customer = require('../services/intelligenceExecution/customerIntelligence');
const { generate } = require('./generate-customer-intelligence-artifacts.cjs');

const docsDir = path.dirname(customer.paths.generatedRoot);
const REQUIRED_DOCS = [
  'README.md',
  'CURRENT_CUSTOMER_FUNCTIONALITY_AUDIT.md',
  'CUSTOMER_INTELLIGENCE_ARCHITECTURE.md',
  'EXISTING_SERVICE_REUSE_DECISION.md',
  'EXISTING_PREDICTION_LOGISTICS_BOUNDARY.md',
  'AUTHORITATIVE_DATA_BOUNDARIES.md',
  'CUSTOMER_CONTEXT_CONTRACT.md',
  'CUSTOMER_IDENTITY_MODEL.md',
  'DELIVERY_HISTORY_AWARENESS.md',
  'PRODUCT_HISTORY_AWARENESS.md',
  'INVOICE_HISTORY_AWARENESS.md',
  'HISTORICAL_SPEND_AWARENESS.md',
  'DEDUCTION_EXCEPTION_HISTORY.md',
  'SERVICE_PATTERN_EVIDENCE.md',
  'CUSTOMER_ROUTE_CONTEXT.md',
  'CUSTOMER_STOP_CONTEXT.md',
  'CUSTOMER_OPERATIONAL_EXCEPTIONS.md',
  'EXCEPTION_SEVERITY_MODEL.md',
  'CUSTOMER_SUMMARY_MODEL.md',
  'DETERMINISTIC_EXPLANATIONS.md',
  'HISTORICAL_METRIC_TRACEABILITY.md',
  'EVIDENCE_AND_CONFIDENCE.md',
  'ROUTE_INTELLIGENCE_INTEGRATION.md',
  'DRIVER_INTELLIGENCE_INTEGRATION.md',
  'SUPERVISOR_INTELLIGENCE_INTEGRATION.md',
  'WAREHOUSE_INTELLIGENCE_INTEGRATION.md',
  'FLEET_INTELLIGENCE_INTEGRATION.md',
  'PRIVACY_AND_SENSITIVE_INFERENCE_BOUNDARY.md',
  'CREDIT_FINANCIAL_DECISION_BOUNDARY.md',
  'SALES_PRICING_CRM_BOUNDARY.md',
  'FUTURE_PREDICTIVE_INTELLIGENCE_BOUNDARY.md',
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
  'ROLLBACK_PLAN.md'
];
const REQUIRED_GENERATED = [
  'customer_context_contract.json',
  'customer_delivery_history_catalog.json',
  'customer_product_history_catalog.json',
  'customer_invoice_history_catalog.json',
  'customer_historical_spend_report.json',
  'customer_deduction_history_catalog.json',
  'customer_service_pattern_catalog.json',
  'customer_route_context_catalog.json',
  'customer_stop_context_catalog.json',
  'customer_exception_catalog.json',
  'customer_evidence_report.json',
  'customer_benchmark_catalog.json',
  'CUSTOMER_INTELLIGENCE_SUMMARY.md'
];

function readGenerated() {
  if (!fs.existsSync(customer.paths.generatedRoot)) return [];
  return fs.readdirSync(customer.paths.generatedRoot).sort().map((file) => [file, fs.readFileSync(path.join(customer.paths.generatedRoot, file), 'utf8')]);
}

function expectValidationFailure(mutator, expectedRule) {
  const evidence = customer.buildCustomerIntelligenceEvidence();
  mutator(evidence);
  const validation = customer.validateCustomerIntelligenceEvidence(evidence);
  assert.ok(validation.errors.some((error) => error.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(validation.errors, null, 2)}`);
}

function byCase(evidence) {
  return Object.fromEntries(evidence.assessments.map((item) => [item.caseId, item.assessment]));
}

function main() {
  assert.strictEqual(customer.CUSTOMER_INTELLIGENCE_SCHEMA_VERSION, 'customer.intelligence.foundation.v1');
  assert.strictEqual(customer.CUSTOMER_INTELLIGENCE_ENGINE_VERSION, 'customer.intelligence.foundation.engine.v1');
  for (const doc of REQUIRED_DOCS) assert.ok(fs.existsSync(path.join(docsDir, doc)), `missing doc ${doc}`);
  for (const file of REQUIRED_GENERATED) assert.ok(fs.existsSync(path.join(customer.paths.generatedRoot, file)), `missing generated artifact ${file}`);

  const evidence = customer.buildCustomerIntelligenceEvidence();
  assert.deepStrictEqual(customer.buildCustomerIntelligenceEvidence(), evidence, 'Customer evidence generation must be deterministic');
  const validation = customer.validateCustomerIntelligenceEvidence(evidence);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(evidence.benchmarkCases.length >= 31, 'expected customer benchmark coverage');
  assert.strictEqual(evidence.catalog.currentFunctionalityAuditComplete, true);
  assert.strictEqual(evidence.catalog.existingPredictionLogisticsBoundaryDocumented, true);
  assert.strictEqual(evidence.catalog.providerCallInvoked, false);
  assert.strictEqual(evidence.catalog.modelSelectionActivated, false);
  assert.strictEqual(evidence.catalog.productionApiExposed, false);
  assert.strictEqual(evidence.catalog.predictionGenerated, false);
  assert.strictEqual(evidence.catalog.creditScoringGenerated, false);
  assert.strictEqual(evidence.catalog.protectedClassInferenceGenerated, false);
  assert.strictEqual(evidence.catalog.autonomousPricingGenerated, false);
  assert.strictEqual(evidence.catalog.salesAutomationGenerated, false);
  assert.strictEqual(evidence.catalog.crmExpansionGenerated, false);
  assert.strictEqual(evidence.catalog.operationsIntelligenceStarted, false);
  assert.strictEqual(evidence.catalog.safetyIntelligenceStarted, false);

  const cases = byCase(evidence);
  assert.strictEqual(cases.customer_record_present.context.organizationIsolationPreserved, true);
  assert.strictEqual(cases.customer_record_missing.exceptions.some((item) => item.exceptionType === 'CUSTOMER_RECORD_MISSING'), true);
  assert.strictEqual(cases.conflicting_customer_evidence.context.evidence.conflict, true);
  assert.strictEqual(cases.route_account_relationship_missing.exceptions.some((item) => item.exceptionType === 'ACCOUNT_ROUTE_REFERENCE_MISSING'), true);
  assert.ok(cases.delivery_history_present.deliveryHistory.deliveryCount > 0);
  assert.strictEqual(cases.delivery_history_missing.exceptions.some((item) => item.exceptionType === 'DELIVERY_HISTORY_MISSING'), true);
  assert.strictEqual(cases.stale_delivery_evidence.exceptions.some((item) => item.exceptionType === 'DELIVERY_HISTORY_STALE'), true);
  assert.strictEqual(cases.conflicting_delivery_evidence.exceptions.some((item) => item.exceptionType === 'DELIVERY_HISTORY_CONFLICT'), true);
  assert.ok(cases.repeated_delivery_history.deliveryHistory.observedIntervalsDays.length > 0);
  assert.ok(cases.product_history_present.productHistory.productCount > 0);
  assert.strictEqual(cases.product_history_missing.exceptions.some((item) => item.exceptionType === 'PRODUCT_HISTORY_MISSING'), true);
  assert.ok(cases.historical_quantity_aggregation.productHistory.products.some((item) => item.historicalQuantity !== null));
  assert.strictEqual(cases.unknown_quantity.productHistory.unknownQuantityPreserved, true);
  assert.ok(cases.invoice_history_present.invoiceHistory.invoiceCount > 0);
  assert.strictEqual(cases.invoice_history_missing.exceptions.some((item) => item.exceptionType === 'INVOICE_HISTORY_MISSING'), true);
  assert.strictEqual(cases.invoice_conflict.exceptions.some((item) => item.exceptionType === 'INVOICE_HISTORY_CONFLICT'), true);
  assert.strictEqual(cases.historical_spend_aggregation.historicalSpend.traceable, true);
  assert.strictEqual(cases.unknown_spend.historicalSpend.metric.result, null);
  assert.strictEqual(cases.unknown_spend.historicalSpend.unknownSpendConvertedToZero, false);
  assert.strictEqual(cases.deduction_absent.deductionHistory.state, 'NO_KNOWN_DEDUCTION');
  assert.strictEqual(cases.deduction_recorded.deductionHistory.state, 'DEDUCTION_RECORDED');
  assert.strictEqual(cases.unresolved_deduction.deductionHistory.state, 'DEDUCTION_UNRESOLVED');
  assert.strictEqual(cases.conflicting_deduction_evidence.deductionHistory.state, 'DEDUCTION_EVIDENCE_CONFLICT');
  assert.ok(cases.observed_historical_service_cadence.servicePattern.observedIntervalsBetweenDeliveriesDays.length > 0);
  assert.strictEqual(cases.cross_organization_customer_mismatch.context.organizationIsolationPreserved, false);
  assert.strictEqual(cases.human_review.summary.humanReviewItems.includes('HUMAN_REVIEW_REQUIRED'), true);
  assert.ok(cases.no_exception_case.summary.limitations.some((line) => line.includes('No prediction')));
  assert.ok(evidence.assessments.every((item) => item.assessment.explanations.every((explanation) =>
    explanation.customerIntentInferred === false
    && explanation.financialHealthInferred === false
    && explanation.futurePurchasePredicted === false
    && explanation.personalityInferred === false
    && explanation.protectedClassInferred === false
  )));

  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'unknown_spend').assessment.historicalSpend.metric.result = 0; e.assessments.find((item) => item.caseId === 'unknown_spend').assessment.historicalSpend.unknownSpendConvertedToZero = true; }, 'UNKNOWN_SPEND_CONVERTED_TO_ZERO');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'unknown_quantity').assessment.productHistory.unknownQuantityPreserved = false; }, 'UNKNOWN_QUANTITY_CONVERTED_TO_ZERO');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'customer_record_present').assessment.context.organizationIsolationPreserved = false; }, 'CROSS_ORGANIZATION_CUSTOMER_MERGED');
  expectValidationFailure((e) => { e.assessments.find((item) => item.caseId === 'customer_record_present').assessment.context.identityResolution.similarlyNamedCustomerLinked = true; }, 'SIMILAR_CUSTOMER_CROSSLINKED');
  for (const field of ['forecastSpend','predictedSpend','nextPurchasePrediction','productDemandPrediction','churnProbability','creditScore','paymentRiskScore','protectedClass','inferredReligion','inferredEthnicity','personalityProfile','emotionalState','customerValueScore','autonomousPrice','autonomousDiscount','autonomousSalesOutreach','employeeScore','driverScore','provider','model','productionActivation','implementationPackageNumber','operationsIntelligenceImplemented']) {
    expectValidationFailure((e) => {
      e.assessments[0].assessment[field] = field === 'implementationPackageNumber' ? 'AI-IEP-005B.6' : true;
    }, field === 'implementationPackageNumber' ? 'PROHIBITED_SCOPE_FIELD' : 'PROHIBITED_SCOPE_FIELD');
  }
  expectValidationFailure((e) => { e.assessments[0].assessment.summary.servicePatternEvidence.evidenceLanguage = 'PREDICTED'; }, 'PREDICTION_LANGUAGE_IN_OPERATIONAL_OUTPUT');
  expectValidationFailure((e) => { e.catalog.modelSelectionActivated = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.catalog.productionApiExposed = true; }, 'PROHIBITED_CAPABILITY_FLAG');
  expectValidationFailure((e) => { e.catalog.operationsIntelligenceStarted = true; }, 'PROHIBITED_CAPABILITY_FLAG');

  const audit = fs.readFileSync(path.join(docsDir, 'CURRENT_CUSTOMER_FUNCTIONALITY_AUDIT.md'), 'utf8');
  assert.ok(audit.includes('customer_accounts'), 'customer account audit must document existing account table');
  assert.ok(audit.includes('services/predictionEngine.js'), 'prediction boundary must be documented in audit');
  const predictionBoundary = fs.readFileSync(path.join(docsDir, 'EXISTING_PREDICTION_LOGISTICS_BOUNDARY.md'), 'utf8');
  assert.ok(predictionBoundary.includes('account forecast'), 'prediction boundary must describe existing account forecasts');
  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);
  console.log('[test:customer-intelligence] context, identity, delivery/product/invoice/spend/deduction history, service patterns, route/stop context, exceptions, summaries, explanations, platform boundaries, generated artifacts, and prohibited-scope mutations verified.');
}

main();
