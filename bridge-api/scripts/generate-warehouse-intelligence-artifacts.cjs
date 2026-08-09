#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const warehouse = require('../services/intelligenceExecution/warehouseIntelligence');

const repoRoot = warehouse.paths.repoRoot;
const outDir = warehouse.paths.generatedRoot;
const docsDir = path.dirname(outDir);
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/warehouseIntelligence.js. Do not hand-edit generated artifacts.';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function json(value) {
  return `${JSON.stringify(warehouse.stable(value), null, 2)}\n`;
}

function writeIfChanged(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generatedSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Warehouse Intelligence Summary',
    '',
    'The Warehouse Intelligence Foundation is repository-only, deterministic, provider-neutral, synthetic, and test-only. It assesses route/load assignment, staging, loading, product/quantity discrepancies, departure readiness, warehouse exceptions, alerts, lifecycle state, and supervisor coordination evidence without production APIs, production warehouse automation, workforce scoring, provider/model execution, deployments, or migrations.',
    '',
    `- Schema version: ${evidence.catalog.schemaVersion}`,
    `- Engine version: ${evidence.catalog.engineVersion}`,
    `- Benchmark cases: ${evidence.catalog.benchmarkCaseCount}`,
    `- Capabilities: ${evidence.catalog.capabilityCount}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Repository-only: ${evidence.catalog.testOnly}`,
    `- Production API exposed: ${evidence.catalog.productionApiExposed}`,
    `- Provider/model execution: ${evidence.catalog.providerCallInvoked || evidence.catalog.hostedAiInvoked}`,
    `- Workforce scoring: ${evidence.catalog.employeeScoring}`,
    ''
  ].join('\n');
}

function narrativeDocs(evidence) {
  const common = 'Repository-only, synthetic, deterministic, provider-neutral, no production API, no production warehouse automation, no workforce scoring, no provider/model execution, no deployment, and no migration.';
  return {
    'README.md': ['# Warehouse Intelligence Foundation', '', 'This package creates deterministic repository-only Warehouse Intelligence for route/load departure readiness. It does not add public HTTP endpoints, production automation, database migrations, deployment behavior, provider/model execution, employee scoring, productivity ratings, discipline recommendations, robotics, autonomous purchasing, or Fleet Intelligence.', '', common],
    'CURRENT_WAREHOUSE_FUNCTIONALITY_AUDIT.md': ['# Current Warehouse Functionality Audit', '', '- `services/warehouseAuth.js`: REUSE_UNCHANGED for warehouse PIN/session authentication and future MFA boundary.', '- `routes/routeManifests.js`: REFERENCE_ONLY for daily route manifests, route assignments, warehouse departure/return inventory flows, and driver inventory endpoints.', '- `services/bulkImport.js`: REFERENCE_ONLY for customer, product, and order import structures.', '- `db/repositories.js`: REFERENCE_ONLY for manifests, stops, products, order items, delivery settlements, truck inventory additions, and inventory closeout records.', '- Existing Route, Driver, and Supervisor Intelligence modules: REUSE_UNCHANGED as authority boundaries.', '- No duplicate warehouse runtime system was created.'],
    'WAREHOUSE_INTELLIGENCE_ARCHITECTURE.md': ['# Warehouse Intelligence Architecture', '', 'A single deterministic module, `services/intelligenceExecution/warehouseIntelligence.js`, owns the repository-only Warehouse Intelligence foundation. It consumes synthetic route/load facts and existing TSR authority boundaries, then produces context, assignment, staging, loading, completeness, discrepancy, readiness, exception, alert, lifecycle, explanation, and generated evidence records.', '', common],
    'EXISTING_SERVICE_REUSE_DECISION.md': ['# Existing Service Reuse Decision', '', 'Existing warehouse authentication, manifest import, route assignment, product/order, delivery settlement, and inventory closeout code is referenced rather than replaced. Runtime mutation, persistence, and authentication stay in existing services/routes. The new module is deterministic evidence analysis only.'],
    'AUTHORITATIVE_DATA_BOUNDARIES.md': ['# Authoritative Data Boundaries', '', 'Authoritative future runtime data remains in existing route manifests, daily route stops, assigned driver fields, product/order items, delivery settlements, truck inventory additions, inventory closeouts, warehouse confirmations, and Route/Driver/Supervisor Intelligence outputs. Missing fields remain `UNKNOWN` or `INSUFFICIENT_EVIDENCE`; the foundation does not invent manifests or load IDs.'],
    'WAREHOUSE_CONTEXT_CONTRACT.md': ['# Warehouse Context Contract', '', 'Warehouse context requires `warehouseContextId`, `organizationId`, warehouse/depot reference, authorized actor reference, work-period reference, route/load scopes, evidence sources, timestamps, hashes, unknown fields, and `testOnly`. Future runtime `organizationId` and actor context must be server-derived.'],
    'ROUTE_LOAD_CONTEXT.md': ['# Route Load Context', '', 'Route/load context preserves route, load or manifest reference, assigned driver and vehicle references, staging area where supported, expected and observed product lines, assignment evidence, completion evidence, timestamps, completeness, confidence, discrepancy state, and human-review state.'],
    'ROUTE_STAGING_MODEL.md': ['# Route Staging Model', '', `States: ${evidence.stagingStates.join(', ')}. ` + 'A route is not staged merely because it exists; missing evidence remains insufficient or unknown.'],
    'ROUTE_LOADING_MODEL.md': ['# Route Loading Model', '', `States: ${evidence.loadingStates.join(', ')}. ` + 'Loaded requires explicit completion evidence and is never inferred from route assignment alone.'],
    'LOAD_ASSIGNMENT_VERIFICATION.md': ['# Load Assignment Verification', '', `Outcomes: ${evidence.assignmentOutcomes.join(', ')}. ` + 'Mismatches are operational discrepancies only, not employee fault conclusions.'],
    'LOAD_COMPLETENESS_MODEL.md': ['# Load Completeness Model', '', `Outcomes: ${evidence.completenessOutcomes.join(', ')}. ` + 'Unknown quantities are not converted to zero, and missing manifests remain insufficient evidence.'],
    'PRODUCT_LOAD_DISCREPANCIES.md': ['# Product Load Discrepancies', '', `Types: ${evidence.discrepancyTypes.join(', ')}. ` + 'Each discrepancy preserves route/load/product references where available, expected/observed values, evidence, confidence, reason codes, operational impact, and employment-impact prohibition.'],
    'DEPARTURE_READINESS_MODEL.md': ['# Departure Readiness Model', '', `States: ${evidence.readinessStates.join(', ')}. ` + 'Route safety remains authoritative and can block departure even when loading is complete.'],
    'READINESS_RULE_HIERARCHY.md': ['# Readiness Rule Hierarchy', '', 'Precedence: safety/legal route blocker, wrong route/load assignment, required load missing, unresolved critical discrepancy, loading incomplete, staging incomplete, evidence conflict/staleness, human-review condition, ready. Cost or schedule pressure cannot override blockers.'],
    'WAREHOUSE_EXCEPTION_MODEL.md': ['# Warehouse Exception Model', '', `Exception types: ${evidence.exceptionTypes.join(', ')}. ` + 'Exceptions are evidence-based and deterministic.'],
    'EXCEPTION_SEVERITY_MODEL.md': ['# Exception Severity Model', '', `Severities: ${evidence.severities.join(', ')}. ` + 'Severity represents operational impact only, not blame, negligence, or performance.'],
    'WAREHOUSE_ALERT_MODEL.md': ['# Warehouse Alert Model', '', `Next steps: ${evidence.nextSteps.join(', ')}. ` + 'Alerts contain structured facts, evidence, reason codes, limitations, lifecycle state, and operational next steps without workforce actions.'],
    'ALERT_LIFECYCLE.md': ['# Alert Lifecycle', '', `Lifecycle states: ${evidence.alertStatuses.join(', ')}. ` + 'Acknowledgement does not equal resolution. No production notification delivery is added.'],
    'SUPERVISOR_WAREHOUSE_COORDINATION.md': ['# Supervisor Warehouse Coordination', '', 'The foundation emits coordination evidence when warehouse exceptions require supervisor visibility or route departure is blocked pending load review. It does not add chat, dispatch automation, or notification channels.'],
    'DETERMINISTIC_EXPLANATIONS.md': ['# Deterministic Explanations', '', 'Explanations derive from supplied route/load/staging/loading/manifest/safety/evidence facts. They do not infer intent, negligence, laziness, performance, misconduct, or cause without evidence.'],
    'EVIDENCE_AND_CONFIDENCE.md': ['# Evidence and Confidence', '', 'Evidence completeness and confidence are explicit. Stale, conflicting, unknown, and insufficient evidence remain visible and cannot silently become ready.'],
    'REASON_CODES.md': ['# Reason Codes', '', Object.keys(evidence.reasonCodes).sort().map((code) => `- ${code}`).join('\n')],
    'ROUTE_INTELLIGENCE_INTEGRATION.md': ['# Route Intelligence Integration', '', 'Warehouse readiness cannot override Route Intelligence safety. Safety-blocked routes remain blocked even if warehouse loading evidence is complete.'],
    'DRIVER_INTELLIGENCE_INTEGRATION.md': ['# Driver Intelligence Integration', '', 'Driver Intelligence remains authoritative for driver operational state. Warehouse records may reference driver state as evidence but do not score or judge drivers.'],
    'SUPERVISOR_INTELLIGENCE_INTEGRATION.md': ['# Supervisor Intelligence Integration', '', 'Supervisor Intelligence remains authoritative for supervisor aggregation. Warehouse emits structured evidence suitable for supervisor visibility without adding production notifications.'],
    'WAREHOUSE_SECURITY_MFA_BOUNDARY.md': ['# Warehouse Security MFA Boundary', '', 'Existing warehouse operations use warehouse employee identity/PIN/session controls. This repository-only package does not weaken authentication or depend on production auth. Future runtime write operations must preserve at least knowledge/possession factors where existing architecture requires them.'],
    'BENCHMARK_DATASETS.md': ['# Benchmark Datasets', '', `Synthetic benchmark cases: ${evidence.benchmarkCases.length}. Cases cover assignments, staging, loading, product discrepancies, quantities, stale/conflicting evidence, safety blockers, review states, lifecycle states, and no-exception readiness.`],
    'PLATFORM_INTEGRATION.md': ['# Platform Integration', '', 'The package integrates by evidence with Route, Driver, Supervisor, capability registry availability, orchestration, lifecycle, knowledge graph, dashboard data, framework validation, roadmap workflow, and tenant/security boundaries. It creates no new framework.'],
    'KNOWLEDGE_GRAPH_INTEGRATION.md': ['# Knowledge Graph Integration', '', 'After regeneration, repository docs, scripts, generated artifacts, and module files are indexed by the existing knowledge graph. No production graph service is deployed.'],
    'DASHBOARD_INTEGRATION.md': ['# Dashboard Integration', '', 'After regeneration, existing dashboard data generation indexes Warehouse Intelligence docs and scripts as repository-only evidence. No dashboard runtime or API is added.'],
    'SECURITY_AND_TENANT_REVIEW.md': ['# Security and Tenant Review', '', 'Organization isolation is enforced in synthetic validation. Cross-Organization route/load evidence cannot produce ready state. No authentication, RBAC, warehouse MFA, provider, credential, database, or production setting is changed.'],
    'EMPLOYMENT_IMPACT_GUARDRAILS.md': ['# Employment Impact Guardrails', '', 'The foundation prohibits employee scoring, ranking, productivity rating, discipline, termination, compensation, attendance discipline, negligence conclusions, autonomous workforce decisions, worker surveillance expansion, robotics, and autonomous purchasing. Operational discrepancies are not employee-performance conclusions.'],
    'TEST_PLAN.md': ['# Test Plan', '', 'Run syntax checks, Warehouse generation twice, Warehouse validate/check/benchmarks/test, controlled negative checks, Route/Driver/Supervisor/roadmap/platform/security tests, and full `npm.cmd test`.'],
    'TEST_RESULTS.md': ['# Test Results', '', 'Implementation-phase validation is recorded in the Codex completion report. Generated artifacts are deterministic and stale-artifact checks are enforced by `check-warehouse-intelligence.cjs`.'],
    'IMPLEMENTATION_REPORT.md': ['# Implementation Report', '', 'Implemented deterministic repository-only Warehouse Intelligence Foundation. No public API, production behavior, deployment, migration, database write, provider/model execution, warehouse automation, employee scoring, or Fleet Intelligence work was added.'],
    'DEFERRED_WORK.md': ['# Deferred Work', '', '- Production staging thresholds.', '- Production loading deadlines.', '- Production discrepancy tolerances.', '- Production hold/release authority.', '- Production supervisor override authority.', '- Production alert channels.', '- Retention policy.', '- Manifest source-of-truth changes.', '- Production WMS integrations.', '- Model/provider selection.', '- Live orchestration.', '- Deployment and migrations.'],
    'OWNER_DECISIONS_REQUIRED.md': ['# Owner Decisions Required', '', '- Approve any future runtime Warehouse Intelligence API.', '- Approve production staging/loading thresholds and discrepancy tolerances.', '- Approve production warehouse alert channels.', '- Approve production WMS or manifest source changes.', '- Approve deployment, migrations, provider/model selection, and live orchestration separately.'],
    'ROLLBACK_PLAN.md': ['# Rollback Plan', '', 'Rollback is source-control only. This package performs no production writes, deployments, migrations, object mutations, credential changes, provider activation, or Cloudflare/Render configuration changes.']
  };
}

function generate(options = {}) {
  ensureDir(outDir);
  const evidence = warehouse.buildWarehouseIntelligenceEvidence();
  const validation = warehouse.validateWarehouseIntelligenceEvidence(evidence);
  const assessments = evidence.assessments.map((item) => item.assessment);
  const outputs = {
    [path.join(outDir, 'warehouse_context_contract.json')]: json(evidence.contextContract),
    [path.join(outDir, 'warehouse_route_load_catalog.json')]: json({ generatedArtifact: true, routeLoadContexts: assessments.map((item) => item.routeLoadContext) }),
    [path.join(outDir, 'warehouse_staging_state_catalog.json')]: json({ generatedArtifact: true, states: evidence.stagingStates, assessments: assessments.map((item) => item.staging) }),
    [path.join(outDir, 'warehouse_loading_state_catalog.json')]: json({ generatedArtifact: true, states: evidence.loadingStates, assessments: assessments.map((item) => item.loading) }),
    [path.join(outDir, 'warehouse_discrepancy_catalog.json')]: json({ generatedArtifact: true, discrepancyTypes: evidence.discrepancyTypes, discrepancies: assessments.flatMap((item) => item.discrepancies) }),
    [path.join(outDir, 'warehouse_departure_readiness_catalog.json')]: json({ generatedArtifact: true, readinessStates: evidence.readinessStates, readiness: assessments.map((item) => item.readiness) }),
    [path.join(outDir, 'warehouse_exception_catalog.json')]: json({ generatedArtifact: true, exceptionTypes: evidence.exceptionTypes, exceptions: assessments.flatMap((item) => item.exceptions) }),
    [path.join(outDir, 'warehouse_alert_catalog.json')]: json({ generatedArtifact: true, alertStatuses: evidence.alertStatuses, alerts: assessments.flatMap((item) => item.alerts) }),
    [path.join(outDir, 'warehouse_reason_code_catalog.json')]: json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    [path.join(outDir, 'warehouse_benchmark_catalog.json')]: json({ generatedArtifact: true, benchmarks: evidence.benchmarkCases }),
    [path.join(outDir, 'warehouse_evidence_report.json')]: json({ generatedArtifact: true, validation, catalog: evidence.catalog, evidence: assessments.map((item) => ({ routeId: item.routeLoadContext.routeId, evidence: item.routeLoadContext.evidence, assessmentHash: item.assessmentHash })) }),
    [path.join(outDir, 'warehouse_readiness_report.json')]: json({ generatedArtifact: true, readinessByCase: evidence.assessments.map((item) => ({ caseId: item.caseId, readiness: item.assessment.readiness.state, hash: item.assessment.readiness.readinessHash })) }),
    [path.join(outDir, 'WAREHOUSE_INTELLIGENCE_SUMMARY.md')]: generatedSummary(evidence, validation)
  };
  for (const [fileName, lines] of Object.entries(narrativeDocs(evidence))) outputs[path.join(docsDir, fileName)] = `${lines.join('\n')}\n`;
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[warehouse-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[warehouse-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/warehouse-intelligence-foundation`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
