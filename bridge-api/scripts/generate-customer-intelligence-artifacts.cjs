#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const customer = require('../services/intelligenceExecution/customerIntelligence');

const repoRoot = customer.paths.repoRoot;
const outDir = customer.paths.generatedRoot;
const docsDir = path.dirname(outDir);
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/customerIntelligence.js. Do not hand-edit generated artifacts.';

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function json(value) { return `${JSON.stringify(customer.stable(value), null, 2)}\n`; }
function writeIfChanged(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generatedSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Customer Intelligence Summary',
    '',
    'The Customer Intelligence Foundation is repository-only, deterministic, provider-neutral, synthetic, and test-only. It summarizes customer/account context, delivery history, product history, invoice history, historical spend trace, deductions, service-pattern evidence, route/stop context, exceptions, summaries, and explanations without prediction, credit scoring, protected-class inference, autonomous pricing, sales automation, provider/model execution, production APIs, deployments, or migrations.',
    '',
    `- Schema version: ${evidence.catalog.schemaVersion}`,
    `- Engine version: ${evidence.catalog.engineVersion}`,
    `- Benchmark cases: ${evidence.catalog.benchmarkCaseCount}`,
    `- Capabilities: ${evidence.catalog.capabilityCount}`,
    `- Existing prediction/logistics boundary documented: ${evidence.catalog.existingPredictionLogisticsBoundaryDocumented}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Repository-only: ${evidence.catalog.testOnly}`,
    `- Prediction generated: ${evidence.catalog.predictionGenerated}`,
    `- Credit scoring generated: ${evidence.catalog.creditScoringGenerated}`,
    `- Protected-class inference generated: ${evidence.catalog.protectedClassInferenceGenerated}`,
    `- Autonomous pricing generated: ${evidence.catalog.autonomousPricingGenerated}`,
    `- Sales automation generated: ${evidence.catalog.salesAutomationGenerated}`,
    ''
  ].join('\n');
}

function docs(evidence) {
  const common = 'Repository-only, synthetic, deterministic, provider-neutral, historical/descriptive only, no prediction, no credit scoring, no protected-class inference, no autonomous sales/pricing decision, no provider/model execution, no production API, no deployment, and no migration.';
  const auditTable = [
    '| Component | Classification | Decision |',
    '| --- | --- | --- |',
    '| `customer_accounts` / `listCustomerAccounts` / `upsertCustomerAccount` | REUSE_UNCHANGED | Authoritative account identity record keyed by stable account number within Organization scope. |',
    '| `daily_route_stops.account_number` and `daily_route_manifests` | REFERENCE_ONLY | Authoritative route/stop account relationship and service status evidence. |',
    '| `account_orders` | REUSE_UNCHANGED | Invoice/order header source for historical invoice, spend, route, stop, and status facts. |',
    '| `account_order_items` | REUSE_UNCHANGED | Product history, quantity, unit price, gross/net, and deduction-line evidence. |',
    '| `delivery_deductions` | REUSE_UNCHANGED | Deduction/exception history; never implies fraud, blame, intent, or employee fault. |',
    '| `delivery_settlements` and settlement items | REFERENCE_ONLY | Driver stop completion and final delivery quantities remain existing delivery workflow evidence. |',
    '| `routes/accountIntelligence.js` and `account_ai_insights` | REFERENCE_ONLY | Existing supervisor/account UI and reviewed insights remain outside this deterministic foundation. |',
    '| `services/predictionEngine.js` | DEFER | Existing forecasts are documented but not reused as authoritative Customer Intelligence evidence. |',
    '| `services/logisticsIntelligence.js` | REFERENCE_ONLY | Existing event/signal/finding/recommendation engine remains separate operational workflow. |',
    '| New Customer production API, CRM, payment, accounting, provider/model, or migration scope | OUT_OF_SCOPE | No runtime platform expansion is added. |'
  ].join('\n');
  const predictionBoundary = [
    '# Existing Prediction and Logistics Boundary',
    '',
    '`services/predictionEngine.js` already contains account forecast, product demand forecast, delivery failure prediction, and route completion prediction helpers. This foundation documents that code as existing predictive/logistics functionality and does not remove, expand, call, or make it authoritative for Customer Intelligence.',
    '',
    '`services/logisticsIntelligence.js` contains PostgreSQL-backed logistics events, signals, findings, recommendations, decisions, and outcomes. Customer Intelligence references it only as an existing operational intelligence boundary.',
    '',
    'Future spend prediction, product-demand prediction, churn prediction, customer value prediction, sales propensity, and model-generated recommendations remain deferred to later model-selection work.'
  ].join('\n');
  const generatedFiles = [
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
  return {
    'README.md': ['# Customer Intelligence Foundation', '', 'This package creates deterministic repository-only Customer Intelligence for customer/account operational context, delivery/product/invoice/spend/deduction history, route/stop context, exceptions, summaries, explanations, and evidence confidence.', '', common].join('\n'),
    'CURRENT_CUSTOMER_FUNCTIONALITY_AUDIT.md': ['# Current Customer Functionality Audit', '', auditTable].join('\n'),
    'CUSTOMER_INTELLIGENCE_ARCHITECTURE.md': ['# Customer Intelligence Architecture', '', 'A single deterministic module, `services/intelligenceExecution/customerIntelligence.js`, owns the repository-only foundation. It consumes synthetic customer/account, order, invoice, item, deduction, route, stop, and integration evidence and emits deterministic operational records.', '', common].join('\n'),
    'EXISTING_SERVICE_REUSE_DECISION.md': ['# Existing Service Reuse Decision', '', 'Existing account, order, product, deduction, route-stop, delivery-settlement, account-intelligence, prediction, logistics-intelligence, tenant, lifecycle, and completed Milestone 1 intelligence services are reused unchanged, wrapped as deterministic evidence, or referenced only. No duplicate customer platform was created.'].join('\n'),
    'EXISTING_PREDICTION_LOGISTICS_BOUNDARY.md': predictionBoundary,
    'AUTHORITATIVE_DATA_BOUNDARIES.md': ['# Authoritative Data Boundaries', '', 'Authoritative future runtime evidence remains in `organization_id`, `customer_accounts.account_number`, `daily_route_stops.account_number`, `daily_route_stops.id`, `daily_route_manifests.id`, `account_orders.id`, `account_orders.invoice_number`, `account_order_items.id`, `account_order_items.sku`, `delivery_deductions.id`, `delivery_settlements.id`, and existing route/driver/supervisor/warehouse/fleet intelligence outputs. Customer names are display labels, not relational identifiers. Cross-Organization aggregation is prohibited.'].join('\n'),
    'CUSTOMER_CONTEXT_CONTRACT.md': ['# Customer Context Contract', '', 'Customer context contains `customerContextId`, `organizationId`, stable customer/account ID, account reference, route/stop/delivery/invoice/product/deduction references, history window, source references, evidence timestamps, source hashes, completeness, confidence, unknown fields, human-review flag, and `testOnly`.'].join('\n'),
    'CUSTOMER_IDENTITY_MODEL.md': ['# Customer Identity Model', '', 'Stable account/customer identifiers are required. Customer display names must not become relational identifiers when account numbers or customer IDs exist. Similarly named customers across Organizations must not be linked.'].join('\n'),
    'DELIVERY_HISTORY_AWARENESS.md': ['# Delivery History Awareness', '', 'Delivery history records known service dates, route/stop references, completed and unresolved delivery counts, observed intervals, most recent known service date, and evidence gaps. Failed/skipped delivery does not imply customer fault or driver fault.'].join('\n'),
    'PRODUCT_HISTORY_AWARENESS.md': ['# Product History Awareness', '', 'Product history records product/SKU references, historical quantities, occurrence counts, first/most recent occurrence, observed historical cadence, and conflicts. Unknown quantity remains unknown and no product demand prediction is generated.'].join('\n'),
    'INVOICE_HISTORY_AWARENESS.md': ['# Invoice History Awareness', '', 'Invoice history records invoice/order ID, dates, status, line references, subtotal/total where known, deduction references, source, and evidence state. Missing invoice data is never treated as zero spend.'].join('\n'),
    'HISTORICAL_SPEND_AWARENESS.md': ['# Historical Spend Awareness', '', 'Historical spend aggregates use only known authoritative records and preserve metric ID, customer ID, Organization, metric type, calculation version, time window, contributing record IDs, known and unknown counts, result, unit/currency, missing coverage, completeness/confidence, and calculation hash. Unknown spend remains `null`.'].join('\n'),
    'DEDUCTION_EXCEPTION_HISTORY.md': ['# Deduction and Exception History', '', `States: ${evidence.deductionStates.join(', ')}. Deduction evidence records references, amounts, quantities, reasons, timestamps, source, and resolution status. It does not infer fraud, customer intent, blame, or employee fault.`].join('\n'),
    'SERVICE_PATTERN_EVIDENCE.md': ['# Service Pattern Evidence', '', 'Service patterns are descriptive only: observed delivery counts, days of week, intervals, product frequency, invoice frequency, repeat route/account relationship, and history coverage. Operational outputs use observed/historical/recorded/known language only.'].join('\n'),
    'CUSTOMER_ROUTE_CONTEXT.md': ['# Customer Route Context', '', 'Customer route context references assigned route, customer stop, stop sequence, route safety status, route exception affecting service, and historical route/account relationship. Route Intelligence remains authoritative and is not overridden.'].join('\n'),
    'CUSTOMER_STOP_CONTEXT.md': ['# Customer Stop Context', '', 'Customer stop context references stop ID, account ID, route ID, delivery status, arrival/departure evidence, stop instructions, authorized driver-note references, and operational instruction references. Driver/stop authority and Organization isolation are preserved.'].join('\n'),
    'CUSTOMER_OPERATIONAL_EXCEPTIONS.md': ['# Customer Operational Exceptions', '', `Exception types: ${evidence.exceptionTypes.join(', ')}. Exceptions describe operational data conditions only and do not imply customer fault or employee fault.`].join('\n'),
    'EXCEPTION_SEVERITY_MODEL.md': ['# Exception Severity Model', '', `Severities: ${evidence.severities.join(', ')}. Severity reflects operational impact or evidence quality only, not customer quality, value, credit quality, profitability, or employee performance.`].join('\n'),
    'CUSTOMER_SUMMARY_MODEL.md': ['# Customer Summary Model', '', 'Summaries contain account identity evidence, known delivery count, history coverage, product history count, historical quantities, invoice count, known historical spend, deduction count, unresolved deductions, route/stop references, service-pattern evidence, evidence gaps, conflicting evidence, human-review items, and limitations.'].join('\n'),
    'DETERMINISTIC_EXPLANATIONS.md': ['# Deterministic Explanations', '', 'Explanations describe account linkage, completeness, delivery/product/invoice/deduction facts, historical spend calculation, observed service patterns, missing/conflicting evidence, and human-review reasons. They do not infer intent, creditworthiness, future purchases, emotion, personality, or protected traits.'].join('\n'),
    'HISTORICAL_METRIC_TRACEABILITY.md': ['# Historical Metric Traceability', '', 'Every aggregate preserves contributing record IDs, known and unknown counts, time window, result, currency/unit when authoritative, missing coverage, and calculation hash. Generalized customer scoring is not added.'].join('\n'),
    'EVIDENCE_AND_CONFIDENCE.md': ['# Evidence and Confidence', '', `Evidence states: ${evidence.evidenceStates.join(', ')}. Confidence states: ${evidence.confidenceStates.join(', ')}. Stale, missing, conflicting, and insufficient evidence remain explicit.`].join('\n'),
    'ROUTE_INTELLIGENCE_INTEGRATION.md': ['# Route Intelligence Integration', '', 'Route Intelligence remains authoritative for safety, route compatibility, restrictions, and route rejection. Customer Intelligence references route/customer context only.'].join('\n'),
    'DRIVER_INTELLIGENCE_INTEGRATION.md': ['# Driver Intelligence Integration', '', 'Driver Intelligence remains authoritative for driver operational state, route adherence, stop progress, and driver advisories. Customer Intelligence does not score or rank drivers.'].join('\n'),
    'SUPERVISOR_INTELLIGENCE_INTEGRATION.md': ['# Supervisor Intelligence Integration', '', 'Supervisor Intelligence remains authoritative for supervisor portfolio and operational exception prioritization. Customer Intelligence emits evidence for review without overriding supervisor decisions.'].join('\n'),
    'WAREHOUSE_INTELLIGENCE_INTEGRATION.md': ['# Warehouse Intelligence Integration', '', 'Warehouse Intelligence remains authoritative for load, staging, readiness, and discrepancies. Customer Intelligence references warehouse facts only when relevant to customer service context.'].join('\n'),
    'FLEET_INTELLIGENCE_INTEGRATION.md': ['# Fleet Intelligence Integration', '', 'Fleet Intelligence remains authoritative for vehicle readiness, availability, and route/vehicle operational impact. Customer Intelligence correlates account service context without overriding fleet determinations.'].join('\n'),
    'PRIVACY_AND_SENSITIVE_INFERENCE_BOUNDARY.md': ['# Privacy and Sensitive-Inference Boundary', '', 'The foundation does not infer race, ethnicity, religion, national origin, health, disability, pregnancy, sexual orientation, political affiliation, immigration status, personality, emotion, or other protected/sensitive traits from names, addresses, buying patterns, geography, language, notes, products, or financial history.'].join('\n'),
    'CREDIT_FINANCIAL_DECISION_BOUNDARY.md': ['# Credit and Financial Decision Boundary', '', 'Invoice, spend, and deduction history are operational evidence only. No credit score, payment-risk score, credit limit, lending decision, collections priority, payment terms decision, or adverse financial decision is created.'].join('\n'),
    'SALES_PRICING_CRM_BOUNDARY.md': ['# Sales, Pricing, and CRM Boundary', '', 'No lead score, opportunity score, sales priority, recommended price, discount, profitability rank, upsell, cross-sell, outreach, contact schedule, marketing segment, or CRM workflow is created.'].join('\n'),
    'FUTURE_PREDICTIVE_INTELLIGENCE_BOUNDARY.md': ['# Future Predictive Intelligence Boundary', '', 'Historical product frequency, quantity, spend, invoice totals, delivery intervals, deductions, and service history are prepared as traceable facts. Predicted spend, next purchase, demand, churn, propensity, segmentation, and model-generated recommendations are deferred.'].join('\n'),
    'BENCHMARK_DATASETS.md': ['# Benchmark Datasets', '', `Synthetic benchmark cases: ${evidence.benchmarkCases.length}. Cases cover customer present/missing/conflict, route/stop relationships, delivery history, product history, quantities, invoices, spend, deductions, service cadence, sparse/insufficient evidence, cross-Organization mismatch, human review, and no-exception outcomes.`].join('\n'),
    'PLATFORM_INTEGRATION.md': ['# Platform Integration', '', 'This package integrates with Route, Driver, Supervisor, Warehouse, Fleet, capability registry, benchmark dataset framework, evaluation/scoring/cost/decision governance, knowledge graph, dashboard data, framework validation, orchestration, lifecycle, roadmap, tenant isolation, and data lifecycle through existing repository evidence only.'].join('\n'),
    'KNOWLEDGE_GRAPH_INTEGRATION.md': ['# Knowledge Graph Integration', '', 'The existing knowledge graph can index Customer Intelligence docs, scripts, generated artifacts, and module files after regeneration. No graph runtime or production service is added.'].join('\n'),
    'DASHBOARD_INTEGRATION.md': ['# Dashboard Integration', '', 'The existing dashboard data generator can index Customer Intelligence repository evidence after regeneration. No dashboard route, widget, or production API is added.'].join('\n'),
    'SECURITY_AND_TENANT_REVIEW.md': ['# Security and Tenant Review', '', 'Synthetic validation enforces Organization isolation. Cross-Organization customer records cannot be merged. No authentication, RBAC, credential, database, provider, Cloudflare/R2, or infrastructure setting is changed.'].join('\n'),
    'DATA_LIFECYCLE_REVIEW.md': ['# Data Lifecycle Review', '', 'Customer Intelligence does not decide production customer-history retention, spend windows, deduction retention, or purge policy. Existing ODR/data lifecycle governance remains authoritative.'].join('\n'),
    'TEST_PLAN.md': ['# Test Plan', '', 'Run syntax checks, Customer generation twice, Customer validate/check/benchmarks/test, controlled mutation checks, roadmap, knowledge graph, dashboard, framework validation, orchestration, lifecycle, Route/Driver/Supervisor/Warehouse/Fleet, logistics/prediction/import/delivery/security tests, and full `npm.cmd test`.'].join('\n'),
    'TEST_RESULTS.md': ['# Test Results', '', 'Implementation-phase validation is recorded in the Codex completion report. Generated artifacts are deterministic and stale-artifact checks are enforced by `check-customer-intelligence.cjs`.'].join('\n'),
    'IMPLEMENTATION_REPORT.md': ['# Implementation Report', '', 'Implemented deterministic repository-only Customer Intelligence Foundation. No public API, production behavior, deployment, migration, database write, provider/model execution, prediction, credit scoring, protected-class inference, autonomous pricing/discounting, sales automation, CRM expansion, Operations Intelligence, or Safety Intelligence was added.'].join('\n'),
    'DEFERRED_WORK.md': ['# Deferred Work', '', '- Production customer-history retention policy.', '- Production spend windows.', '- Final deduction categorization.', '- Account segmentation.', '- Product recommendation policy.', '- Demand prediction.', '- Spend prediction.', '- Pricing/discount strategy.', '- Customer prioritization.', '- CRM workflows.', '- Credit policy.', '- Model/provider selection.', '- Production APIs, deployment, and migrations.'].join('\n'),
    'OWNER_DECISIONS_REQUIRED.md': ['# Owner Decisions Required', '', '- Approve any future Customer Intelligence runtime API.', '- Approve production retention and spend windows.', '- Approve deduction categorization and account segmentation.', '- Approve product recommendation, demand prediction, spend prediction, pricing, discounting, customer prioritization, CRM, credit, model/provider, production API, deployment, and migration scope separately.'].join('\n'),
    'ROLLBACK_PLAN.md': ['# Rollback Plan', '', 'Rollback is source-control only. This package performs no production writes, deployments, migrations, object mutations, credential changes, provider activation, Cloudflare/R2 changes, or infrastructure changes.'].join('\n'),
    'GENERATED_ARTIFACTS.md': ['# Generated Artifacts', '', generatedFiles.map((file) => `- \`${file}\``).join('\n')].join('\n')
  };
}

function generate(options = {}) {
  ensureDir(outDir);
  const evidence = customer.buildCustomerIntelligenceEvidence();
  const validation = customer.validateCustomerIntelligenceEvidence(evidence);
  const assessments = evidence.assessments.map((item) => item.assessment);
  const outputs = {
    [path.join(outDir, 'customer_context_contract.json')]: json(evidence.contextContract),
    [path.join(outDir, 'customer_delivery_history_catalog.json')]: json({ generatedArtifact: true, deliveryHistories: assessments.map((item) => item.deliveryHistory) }),
    [path.join(outDir, 'customer_product_history_catalog.json')]: json({ generatedArtifact: true, productHistories: assessments.map((item) => item.productHistory) }),
    [path.join(outDir, 'customer_invoice_history_catalog.json')]: json({ generatedArtifact: true, invoiceHistories: assessments.map((item) => item.invoiceHistory) }),
    [path.join(outDir, 'customer_historical_spend_report.json')]: json({ generatedArtifact: true, spendReports: assessments.map((item) => item.historicalSpend) }),
    [path.join(outDir, 'customer_deduction_history_catalog.json')]: json({ generatedArtifact: true, deductionStates: evidence.deductionStates, deductionHistories: assessments.map((item) => item.deductionHistory) }),
    [path.join(outDir, 'customer_service_pattern_catalog.json')]: json({ generatedArtifact: true, servicePatterns: assessments.map((item) => item.servicePattern) }),
    [path.join(outDir, 'customer_route_context_catalog.json')]: json({ generatedArtifact: true, routeContexts: assessments.map((item) => item.routeContext) }),
    [path.join(outDir, 'customer_stop_context_catalog.json')]: json({ generatedArtifact: true, stopContexts: assessments.map((item) => item.stopContext) }),
    [path.join(outDir, 'customer_exception_catalog.json')]: json({ generatedArtifact: true, exceptionTypes: evidence.exceptionTypes, exceptions: assessments.flatMap((item) => item.exceptions) }),
    [path.join(outDir, 'customer_evidence_report.json')]: json({ generatedArtifact: true, validation, catalog: evidence.catalog, summaries: assessments.map((item) => item.summary) }),
    [path.join(outDir, 'customer_benchmark_catalog.json')]: json({ generatedArtifact: true, benchmarks: evidence.benchmarkCases }),
    [path.join(outDir, 'CUSTOMER_INTELLIGENCE_SUMMARY.md')]: generatedSummary(evidence, validation)
  };
  for (const [name, content] of Object.entries(docs(evidence))) outputs[path.join(docsDir, name)] = `${content}\n`;
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[customer-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[customer-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/customer-intelligence-foundation`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
