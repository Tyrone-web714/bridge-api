#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const operations = require('../services/intelligenceExecution/operationsIntelligence');

const repoRoot = operations.paths.repoRoot;
const outDir = operations.paths.generatedRoot;
const docsDir = path.dirname(outDir);
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/operationsIntelligence.js. Do not hand-edit generated artifacts.';

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function json(value) { return `${JSON.stringify(operations.stable(value), null, 2)}\n`; }
function writeIfChanged(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generatedSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Operations Intelligence Summary',
    '',
    'The Operations Intelligence Foundation is repository-only, deterministic, provider-neutral, synthetic, and test-only. It aggregates existing TSR operational evidence across Route, Driver, Supervisor, Warehouse, Fleet, and Customer Intelligence without replacing those authoritative domains.',
    '',
    `- Schema version: ${evidence.catalog.schemaVersion}`,
    `- Engine version: ${evidence.catalog.engineVersion}`,
    `- Benchmark cases: ${evidence.catalog.benchmarkCaseCount}`,
    `- Capabilities: ${evidence.catalog.capabilityCount}`,
    `- Existing operations audit complete: ${evidence.catalog.currentOperationsFunctionalityAuditComplete}`,
    `- Service reuse decision documented: ${evidence.catalog.serviceReuseDecisionDocumented}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Repository-only: ${evidence.catalog.testOnly}`,
    `- Lower-domain override generated: ${evidence.catalog.lowerDomainOverrideGenerated}`,
    `- Causation inferred from correlation: ${evidence.catalog.causationInferredFromCorrelation}`,
    `- Employee scoring generated: ${evidence.catalog.employeeScoringGenerated}`,
    `- Autonomous action generated: ${evidence.catalog.autonomousActionGenerated}`,
    `- Prediction generated: ${evidence.catalog.predictionGenerated}`,
    `- Product-suite expansion generated: ${evidence.catalog.productSuiteExpansionGenerated}`,
    `- Provider/model execution: ${evidence.catalog.providerCallInvoked}`,
    ''
  ].join('\n');
}

function docs(evidence) {
  const common = 'Repository-only, synthetic, deterministic, provider-neutral, aggregation-only, lower domains remain authoritative, no prediction, no autonomous action, no workforce scoring, no provider/model execution, no production API, no deployment, no migration, and no production-readiness claim.';
  const auditTable = [
    '| Component | Classification | Decision |',
    '| --- | --- | --- |',
    '| `services/intelligenceExecution/routeIntelligence.js` | REUSE_UNCHANGED | Authoritative route safety, eligibility, restrictions, and hazard evidence. |',
    '| `services/intelligenceExecution/driverIntelligence.js` | REUSE_UNCHANGED | Authoritative driver operational state, route adherence, stop progress, and driver advisories. |',
    '| `services/intelligenceExecution/supervisorOperationalIntelligence.js` | REUSE_UNCHANGED | Authoritative supervisor portfolio, exceptions, alert priority, and summaries. |',
    '| `services/intelligenceExecution/warehouseIntelligence.js` | REUSE_UNCHANGED | Authoritative staging, loading, completeness, discrepancy, and departure-readiness evidence. |',
    '| `services/intelligenceExecution/fleetIntelligence.js` | REUSE_UNCHANGED | Authoritative vehicle availability, readiness, route compatibility, and vehicle-caused route impact. |',
    '| `services/intelligenceExecution/customerIntelligence.js` | REUSE_UNCHANGED | Authoritative customer/account operational context and history evidence. |',
    '| `services/logisticsIntelligence.js` | REFERENCE_ONLY | Existing PostgreSQL-backed logistics event/signal/finding/recommendation workflow remains separate. |',
    '| `services/biKpi.js` and `routes/biKpi.js` | REFERENCE_ONLY | Existing BI/KPI foundation remains separate reporting evidence. |',
    '| `routes/operationalHeatmaps.js` and `routes/operationalGeography.js` | REFERENCE_ONLY | Existing operational geography/heatmap routes remain UI/reporting evidence. |',
    '| `routes/routeManifests.js`, `routes/deliveryNotes.js`, settlement/import routes | REFERENCE_ONLY | Existing operational workflows remain authoritative future runtime evidence. |',
    '| Operations aggregation boundary | EXTEND | Add repository-only deterministic aggregation service because no existing clean organization-level cross-domain boundary exists. |',
    '| ERP/TMS/WMS/CRM/fleet-management platform scope | OUT_OF_SCOPE | No product-suite expansion is implemented. |'
  ].join('\n');
  const generatedFiles = [
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
  return {
    'README.md': ['# Operations Intelligence Foundation', '', 'This package creates deterministic repository-only Operations Intelligence for organization-level operational awareness by aggregating existing TSR operational evidence.', '', common].join('\n'),
    'CURRENT_OPERATIONS_FUNCTIONALITY_AUDIT.md': ['# Current Operations Functionality Audit', '', auditTable].join('\n'),
    'OPERATIONS_INTELLIGENCE_ARCHITECTURE.md': ['# Operations Intelligence Architecture', '', 'A dedicated deterministic module, `services/intelligenceExecution/operationsIntelligence.js`, is justified because the existing repository has strong lower-domain services but no clean organization-level cross-domain aggregation boundary.', '', common].join('\n'),
    'EXISTING_SERVICE_REUSE_DECISION.md': ['# Existing Service Reuse Decision', '', 'Route, Driver, Supervisor, Warehouse, Fleet, Customer, logistics intelligence, BI/KPI, heatmap, route progress, import, delivery settlement, tenant, and data-lifecycle components are reused unchanged or referenced only. Operations Intelligence wraps lower-domain evidence as traceable aggregation records and does not duplicate their logic.'].join('\n'),
    'AUTHORITATIVE_DOMAIN_BOUNDARIES.md': ['# Authoritative Domain Boundaries', '', 'Route, Driver, Supervisor, Warehouse, Fleet, and Customer Intelligence remain authoritative for their domain conclusions. Operations Intelligence may aggregate, correlate, summarize, identify evidence gaps, and expose organization-level operational exceptions, but it cannot recompute, override, or replace lower-domain determinations.'].join('\n'),
    'ORGANIZATION_OPERATIONS_CONTEXT.md': ['# Organization Operations Context', '', 'Operations context includes `operationsContextId`, `organizationId`, work period/reporting window, route/driver/supervisor/warehouse/vehicle/customer scopes, source-domain references, source evidence hashes, evidence timestamps, completeness, confidence, freshness, conflicts, unknown fields, human-review flag, and `testOnly`.'].join('\n'),
    'CROSS_DOMAIN_OPERATIONAL_SNAPSHOT.md': ['# Cross-Domain Operational Snapshot', '', 'The snapshot counts only evidence already present in source-domain records: routes in scope, active/completed/delayed/blocked/unresolved routes, safety/warehouse/vehicle/customer blockers, drivers with known evidence, supervisor alerts, evidence gaps, and human-review items. Missing counts remain missing.'].join('\n'),
    'ROUTE_OPERATIONAL_AGGREGATION.md': ['# Route Operational Aggregation', '', 'Route aggregation references Route Intelligence and route-progress evidence. Route Intelligence remains authoritative for truck safety, restrictions, route eligibility, route rejection, and hazards.'].join('\n'),
    'DRIVER_OPERATIONAL_AGGREGATION.md': ['# Driver Operational Aggregation', '', 'Driver aggregation references Driver Intelligence for driver operational state, route adherence, stop progress, speed compliance, hazard acknowledgement, and advisories. No driver ranking or scoring is produced.'].join('\n'),
    'SUPERVISOR_OPERATIONAL_AGGREGATION.md': ['# Supervisor Operational Aggregation', '', 'Supervisor aggregation references Supervisor Intelligence for operational portfolios, exceptions, alert priority, summaries, and reports. Operations Intelligence does not override supervisor conclusions.'].join('\n'),
    'WAREHOUSE_OPERATIONAL_AGGREGATION.md': ['# Warehouse Operational Aggregation', '', 'Warehouse aggregation references Warehouse Intelligence for staging, loading, route/load association, load completeness, discrepancies, and departure readiness. No warehouse employee ranking or productivity scoring is produced.'].join('\n'),
    'FLEET_OPERATIONAL_AGGREGATION.md': ['# Fleet Operational Aggregation', '', 'Fleet aggregation references Fleet Intelligence for vehicle availability, readiness, route/vehicle compatibility evidence, vehicle exceptions, and vehicle-caused route impact. No autonomous dispatch, repair authorization, or fleet-management product expansion is produced.'].join('\n'),
    'CUSTOMER_OPERATIONAL_AGGREGATION.md': ['# Customer Operational Aggregation', '', 'Customer aggregation references Customer Intelligence for account operational context, service history, deductions, service-pattern evidence, and customer-specific route/stop context. No pricing, credit, sales, CRM, payment, or accounting workflow is produced.'].join('\n'),
    'CROSS_DOMAIN_CORRELATION.md': ['# Cross-Domain Correlation', '', 'Correlation means known facts co-occur within a supported operational relationship such as a shared route. It is not causation. Operations Intelligence never infers root cause unless lower-domain evidence explicitly proves it.', '', 'Regression coverage: normal co-occurrence of healthy lower-domain facts must remain a correlation candidate only and must not emit `CROSS_DOMAIN_OPERATIONAL_CONFLICT` or any other operations exception. The `no_exception_case` synthetic benchmark and `NORMAL_COOCCURRENCE_FALSE_EXCEPTION` mutation check enforce this defect boundary.'].join('\n'),
    'OPERATIONS_EXCEPTION_MODEL.md': ['# Operations Exception Model', '', `Exception types: ${evidence.exceptionTypes.join(', ')}. Exceptions preserve organization, source domain, source record IDs, route/vehicle/customer/driver references where operationally necessary, reason codes, severity, priority, evidence, timestamps, completeness, confidence, human-review flag, employment-impact prohibition, and test-only marker.`].join('\n'),
    'OPERATIONS_SEVERITY_MODEL.md': ['# Operations Severity Model', '', `Severities: ${evidence.severities.join(', ')}. Severity represents operational impact only: safety/legal blockers, route-blocking warehouse/vehicle issues, route-critical exceptions, broad service-impacting issues, routine delays, evidence problems, and informational awareness.`].join('\n'),
    'OPERATIONS_PRIORITY_MODEL.md': ['# Operations Priority Model', '', 'Priority considers operational severity, affected operational records, unresolved status, source-domain severity, evidence freshness, and human-review requirement. It does not consider employee value, driver ranking, worker speed, customer profitability, sales value, compensation, or discipline.'].join('\n'),
    'OPERATIONS_ALERT_MODEL.md': ['# Operations Alert Model', '', `Allowed next steps: ${evidence.nextSteps.join(', ')}. Alerts are structured decision-support records only and do not automate actions.`].join('\n'),
    'ALERT_LIFECYCLE.md': ['# Alert Lifecycle', '', `Repository-only lifecycle states: ${evidence.alertStatuses.join(', ')}. Acknowledgement is not resolution. There is no production notification channel or persistence.`].join('\n'),
    'OPERATIONS_SUMMARY_MODEL.md': ['# Operations Summary Model', '', 'Summaries include routes in scope, completed/active/delayed/blocked routes, safety/warehouse/vehicle blockers, customer-service exceptions, unresolved alerts, cross-domain conflicts, stale evidence, insufficient evidence, human-review count, and known limitations.'].join('\n'),
    'DETERMINISTIC_EXPLANATIONS.md': ['# Deterministic Explanations', '', 'Explanations cite source-domain facts, why exceptions exist, why severity and priority were assigned, which facts correlate, what evidence is missing/conflicting/stale, and why human review is required. They do not infer intent, negligence, motivation, root cause, future outcome, demand, or failure probability.'].join('\n'),
    'EVIDENCE_COMPLETENESS_CONFIDENCE.md': ['# Evidence Completeness and Confidence', '', `Completeness states: ${evidence.evidenceCompletenessStates.join(', ')}. Confidence states: ${evidence.evidenceConfidenceStates.join(', ')}. Unknown, missing, conflicting, stale, and insufficient evidence remain explicit.`].join('\n'),
    'EVIDENCE_FRESHNESS.md': ['# Evidence Freshness', '', `Freshness states: ${evidence.evidenceFreshnessStates.join(', ')}. Synthetic fixtures use test-only deterministic freshness; production freshness thresholds require owner approval.`].join('\n'),
    'CROSS_DOMAIN_AUTHORITY_TRACE.md': ['# Cross-Domain Authority Trace', '', 'Every aggregate preserves source domain, source record ID, source hash, source version, source status, source timestamp, aggregation rule, aggregation version, and result hash so Operations Intelligence cannot become an untraceable second source of truth.'].join('\n'),
    'EMPLOYMENT_IMPACT_GUARDRAILS.md': ['# Employment-Impact Guardrails', '', 'The foundation rejects employeeScore, driverScore, supervisorScore, warehouseEmployeeScore, productivityScore, performanceRating, ranking, leaderboard, discipline, termination, compensation, negligence, and unsafe-driver labels. Operational state is not employee performance.'].join('\n'),
    'AUTONOMOUS_ACTION_BOUNDARY.md': ['# Autonomous-Action Boundary', '', 'The foundation rejects autonomous dispatch, automatic route/driver/vehicle reassignment, workforce scheduling, warehouse actions, purchasing, pricing, customer decisions, and automatic exception resolution. It is awareness and decision support only.'].join('\n'),
    'PREDICTIVE_MODEL_BOUNDARY.md': ['# Predictive-Model Boundary', '', 'The foundation rejects predicted delays, operational-failure prediction, demand/workload/staffing forecasts, service-failure probability, operational-risk prediction, route-completion prediction, and predictive scores. Historical/current evidence may be summarized only.'].join('\n'),
    'PRODUCT_SCOPE_BOUNDARY.md': ['# Product-Scope Boundary', '', 'No ERP, TMS, WMS, CRM, fleet-management, accounting, procurement, payroll, HR, manufacturing, maintenance-management, or hardware-control workflow is introduced.'].join('\n'),
    'BENCHMARK_DATASETS.md': ['# Benchmark Datasets', '', `Synthetic benchmark cases: ${evidence.benchmarkCases.length}. Cases cover normal operations, delayed/blocked routes, safety/warehouse/fleet/customer/supervisor/driver evidence conditions, cross-domain correlations, stale/conflicting/insufficient evidence, cross-Organization rejection, human review, acknowledgement, resolution, invalidation, and no-exception outcome.`].join('\n'),
    'PLATFORM_INTEGRATION.md': ['# Platform Integration', '', 'The foundation integrates with existing Route, Driver, Supervisor, Warehouse, Fleet, Customer, capability registry, benchmark dataset, evaluation, scoring, cost, decision, governance, knowledge graph, dashboard data, framework validation, orchestration, lifecycle, roadmap, tenant isolation, and data-lifecycle boundaries through repository evidence only.'].join('\n'),
    'KNOWLEDGE_GRAPH_INTEGRATION.md': ['# Knowledge Graph Integration', '', 'The existing knowledge graph can index Operations Intelligence docs, scripts, generated artifacts, and module files after regeneration. No graph database or production graph service is added.'].join('\n'),
    'DASHBOARD_INTEGRATION.md': ['# Dashboard Integration', '', 'Existing dashboard data generation can reference Operations Intelligence repository evidence after regeneration. No dashboard route, widget, production API, or production data pipeline is added.'].join('\n'),
    'SECURITY_AND_TENANT_REVIEW.md': ['# Security and Tenant Review', '', 'Synthetic validation rejects cross-Organization aggregation. Future runtime organization context must be trusted/server-derived. No authentication, RBAC, credential, database, provider, Cloudflare/R2, or infrastructure setting is changed.'].join('\n'),
    'DATA_LIFECYCLE_REVIEW.md': ['# Data Lifecycle Review', '', 'Operations Intelligence does not define production retention, freshness, escalation, alert-channel, notification, persistence, or purge policy. Existing data lifecycle governance remains authoritative.'].join('\n'),
    'TEST_PLAN.md': ['# Test Plan', '', 'Run syntax checks, Operations generation twice, Operations validate/check/benchmarks/test, controlled mutation checks, roadmap, knowledge graph, dashboard, framework validation, orchestration, lifecycle, Route/Driver/Supervisor/Warehouse/Fleet/Customer, logistics/prediction/import/delivery/security tests, and full `npm.cmd test`.'].join('\n'),
    'TEST_RESULTS.md': ['# Test Results', '', 'Implementation-phase validation is recorded in the Codex completion report. Generated artifacts are deterministic and stale-artifact checks are enforced by `check-operations-intelligence.cjs`.', '', 'The normal-co-occurrence regression is covered by `no_exception_case`, which asserts zero operations exceptions when healthy Route and Driver evidence merely share a route relationship. A controlled mutation that injects a false `CROSS_DOMAIN_OPERATIONAL_CONFLICT` is rejected as `NORMAL_COOCCURRENCE_FALSE_EXCEPTION`.'].join('\n'),
    'IMPLEMENTATION_REPORT.md': ['# Implementation Report', '', 'Implemented deterministic repository-only Operations Intelligence Foundation. No public API, production behavior, deployment, migration, database write, object mutation, provider/model execution, autonomous action, employee scoring, predictive model, ERP/TMS/WMS/CRM expansion, or Safety Intelligence was added.'].join('\n'),
    'DEFERRED_WORK.md': ['# Deferred Work', '', '- Production operational freshness thresholds.', '- Production escalation thresholds.', '- Final severity thresholds.', '- Final priority rules.', '- Production alert channels.', '- Autonomous response policy.', '- Operational forecasting.', '- Staffing optimization.', '- Demand forecasting.', '- Product-suite expansion.', '- Provider/model selection.', '- Production orchestration.', '- Production APIs, deployment, and migrations.'].join('\n'),
    'OWNER_DECISIONS_REQUIRED.md': ['# Owner Decisions Required', '', '- Approve any future Operations Intelligence runtime API.', '- Approve production freshness and escalation thresholds.', '- Approve production alert channels.', '- Approve any autonomous response, forecasting, staffing optimization, demand forecasting, product-suite expansion, provider/model, production orchestration, deployment, and migration scope separately.'].join('\n'),
    'UNAPPROVED_IDEAS_FOR_OWNER_REVIEW.md': ['# Unapproved Ideas for Owner Review', '', '| Idea | Potential value | Why outside current scope | Architectural impact | Cost/complexity | Risks |', '| --- | --- | --- | --- | --- | --- |', '| Production operational alert channel | Faster supervisor notification | Production notification channel not approved | Requires persistence, routing, auth, notification operations, monitoring, and rollback | Medium to high | Alert fatigue, privacy, incorrect escalation |', '| Demand/workload forecasting | Planning insight | Forecasting is explicitly deferred | Requires model/data governance and benchmark approval | High | Incorrect predictions, staffing misuse |', '| General operations suite / TMS expansion | Broader workflow management | Product-suite expansion prohibited | Large product architecture and migrations | High | Scope creep, duplicate systems |'].join('\n'),
    'ROLLBACK_PLAN.md': ['# Rollback Plan', '', 'Rollback is source-control only. This package performs no production writes, deployments, migrations, object mutations, credential changes, provider activation, Cloudflare/R2 changes, or infrastructure changes.'].join('\n'),
    'GENERATED_ARTIFACTS.md': ['# Generated Artifacts', '', generatedFiles.map((file) => `- \`${file}\``).join('\n')].join('\n')
  };
}

function generate(options = {}) {
  ensureDir(outDir);
  const evidence = operations.buildOperationsIntelligenceEvidence();
  const validation = operations.validateOperationsIntelligenceEvidence(evidence);
  const assessments = evidence.assessments.map((item) => item.assessment);
  const outputs = {
    [path.join(outDir, 'operations_context_contract.json')]: json(evidence.contextContract),
    [path.join(outDir, 'operations_snapshot_catalog.json')]: json({ generatedArtifact: true, snapshots: assessments.map((item) => item.snapshot) }),
    [path.join(outDir, 'operations_cross_domain_evidence.json')]: json({ generatedArtifact: true, authorityTraces: assessments.map((item) => item.authorityTrace), correlations: assessments.flatMap((item) => item.correlations) }),
    [path.join(outDir, 'operations_exception_catalog.json')]: json({ generatedArtifact: true, exceptionTypes: evidence.exceptionTypes, exceptions: assessments.flatMap((item) => item.exceptions) }),
    [path.join(outDir, 'operations_severity_catalog.json')]: json({ generatedArtifact: true, severities: evidence.severities, exceptions: assessments.flatMap((item) => item.exceptions.map((exception) => ({ exceptionId: exception.exceptionId, exceptionType: exception.exceptionType, severity: exception.severity, priority: exception.priority }))) }),
    [path.join(outDir, 'operations_alert_catalog.json')]: json({ generatedArtifact: true, alertStatuses: evidence.alertStatuses, nextSteps: evidence.nextSteps, alerts: assessments.flatMap((item) => item.alerts), lifecycles: assessments.map((item) => item.alertLifecycle) }),
    [path.join(outDir, 'operations_reason_code_catalog.json')]: json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    [path.join(outDir, 'operations_evidence_report.json')]: json({ generatedArtifact: true, validation, catalog: evidence.catalog, domainCoverage: assessments.map((item) => item.snapshot.domainCoverage) }),
    [path.join(outDir, 'operations_summary_report.json')]: json({ generatedArtifact: true, summaries: assessments.map((item) => item.summary), explanations: assessments.map((item) => item.explanation) }),
    [path.join(outDir, 'operations_benchmark_catalog.json')]: json({ generatedArtifact: true, benchmarks: evidence.benchmarkCases }),
    [path.join(outDir, 'OPERATIONS_INTELLIGENCE_SUMMARY.md')]: generatedSummary(evidence, validation)
  };
  for (const [name, content] of Object.entries(docs(evidence))) outputs[path.join(docsDir, name)] = `${content}\n`;
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[operations-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[operations-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/operations-intelligence-foundation`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
