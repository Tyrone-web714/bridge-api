#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fleet = require('../services/intelligenceExecution/fleetIntelligence');

const repoRoot = fleet.paths.repoRoot;
const outDir = fleet.paths.generatedRoot;
const docsDir = path.dirname(outDir);
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/fleetIntelligence.js. Do not hand-edit generated artifacts.';

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function json(value) { return `${JSON.stringify(fleet.stable(value), null, 2)}\n`; }
function writeIfChanged(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generatedSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Fleet Intelligence Summary',
    '',
    'The Fleet Intelligence Foundation is repository-only, deterministic, provider-neutral, synthetic, and test-only. It assesses vehicle availability, readiness, route/vehicle compatibility, maintenance awareness, vehicle issues, route impact, fleet alerts, lifecycle state, supervisor visibility, and evidence confidence without production APIs, predictive maintenance, autonomous dispatch, workforce scoring, provider/model execution, deployments, or migrations.',
    '',
    `- Schema version: ${evidence.catalog.schemaVersion}`,
    `- Engine version: ${evidence.catalog.engineVersion}`,
    `- Benchmark cases: ${evidence.catalog.benchmarkCaseCount}`,
    `- Capabilities: ${evidence.catalog.capabilityCount}`,
    `- Existing Fleet Intelligence Scoring boundary preserved: ${evidence.catalog.existingFleetScoringBoundaryPreserved}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Repository-only: ${evidence.catalog.testOnly}`,
    `- Production API exposed: ${evidence.catalog.productionApiExposed}`,
    `- Predictive maintenance invoked: ${evidence.catalog.predictiveMaintenanceInvoked}`,
    `- Autonomous dispatch performed: ${evidence.catalog.autonomousDispatchPerformed}`,
    `- Workforce scoring: ${evidence.catalog.employeeScoring || evidence.catalog.driverScoring}`,
    ''
  ].join('\n');
}

function narrativeDocs(evidence) {
  const common = 'Repository-only, synthetic, deterministic, provider-neutral, no production API, no predictive maintenance, no autonomous dispatch, no workforce scoring, no provider/model execution, no deployment, and no migration.';
  const audit = [
    '# Current Fleet Functionality Audit',
    '',
    '| Component | Classification | Decision |',
    '| --- | --- | --- |',
    '| `db/postgres.js` `used_truck_profile` on route sessions | REUSE_UNCHANGED | Route Intelligence owns truck profile compatibility evidence; Fleet references the result. |',
    '| `daily_route_manifests.assigned_driver_id` | REFERENCE_ONLY | Existing route/driver assignment evidence is driver-oriented; Fleet does not add vehicle assignment fields. |',
    '| `route_truck_inventory_additions` and `route_truck_inventory_allocations` | REFERENCE_ONLY | These are truck inventory/load records, not vehicle readiness records. |',
    '| Route Intelligence vehicle profile contract | REUSE_UNCHANGED | Route Intelligence remains authoritative for dimension, clearance, restriction, and route safety compatibility. |',
    '| Driver Intelligence assigned vehicle references | REFERENCE_ONLY | Driver records may identify assigned vehicle references but are not scored or ranked. |',
    '| Supervisor Intelligence route portfolio vehicle references | REUSE_UNCHANGED | Fleet emits supervisor-visible evidence without changing dashboard/runtime behavior. |',
    '| Warehouse Intelligence assigned vehicle and departure evidence | REFERENCE_ONLY | Warehouse departure readiness can contribute evidence but Fleet does not change warehouse flows. |',
    '| `services/fleetIntelligenceScoring.js` and migration `008` | REFERENCE_ONLY | Existing Fleet Intelligence Scoring is a business scoring subsystem and remains separate from operational readiness. |',
    '| Fleet scoring routes/RBAC/dashboard card | OUT_OF_SCOPE | No public Fleet Intelligence operational API, route, RBAC permission, or dashboard change is added. |',
    '| New vehicle table, telematics, ELD, OBD, CAN bus, IoT integrations | DEFER | No production field or hardware integration is invented. |'
  ];
  const docs = {
    'README.md': ['# Fleet Intelligence Foundation', '', 'This package creates deterministic repository-only Fleet Intelligence for vehicle availability, readiness, route/vehicle compatibility, vehicle issues, route impact, alerts, and supervisor visibility.', '', common],
    'CURRENT_FLEET_FUNCTIONALITY_AUDIT.md': audit,
    'FLEET_INTELLIGENCE_ARCHITECTURE.md': ['# Fleet Intelligence Architecture', '', 'A single deterministic module, `services/intelligenceExecution/fleetIntelligence.js`, owns the repository-only Fleet Intelligence foundation. It consumes synthetic vehicle, route, assignment, maintenance, Route Intelligence, Driver Intelligence, Supervisor Intelligence, and Warehouse Intelligence evidence, then emits operational readiness outputs.', '', common],
    'EXISTING_FLEET_SCORING_BOUNDARY.md': ['# Existing Fleet Scoring Boundary', '', 'The existing Fleet Intelligence Scoring System uses database-backed score models, versions, snapshots, benchmark sets, RBAC permissions, and route APIs. This package does not modify it, does not call it, and does not merge business scoring with vehicle readiness. Fleet Intelligence Scoring remains a separate analytics/scoring subsystem.'],
    'EXISTING_SERVICE_REUSE_DECISION.md': ['# Existing Service Reuse Decision', '', 'Existing Route, Driver, Supervisor, Warehouse, fleet scoring, route manifest, inventory, data lifecycle, RBAC, and dashboard services are reused unchanged or referenced only. No duplicate runtime fleet-management system was created.'],
    'AUTHORITATIVE_DATA_BOUNDARIES.md': ['# Authoritative Data Boundaries', '', 'Authoritative future runtime evidence remains in existing Organization context, route manifests, route sessions and `used_truck_profile`, Route Intelligence vehicle profile contracts, Driver Intelligence assigned vehicle references, Supervisor route portfolio records, Warehouse departure evidence, and existing fleet score records where used only as scoring boundary context. Missing fields remain `UNKNOWN` or `INSUFFICIENT_EVIDENCE`.'],
    'FLEET_CONTEXT_CONTRACT.md': ['# Fleet Context Contract', '', 'Fleet context requires `fleetContextId`, `organizationId`, depot/operational-area reference, work-period reference, vehicle/route/driver scope, evidence sources, timestamps, hashes, unknown fields, and `testOnly`. Future runtime Organization context must be server-derived.'],
    'VEHICLE_OPERATIONAL_CONTEXT.md': ['# Vehicle Operational Context', '', 'Vehicle context preserves vehicle ID, Organization ID, class/profile, assigned route and driver, current use state, operational status, maintenance status where supported, out-of-service evidence, issue references, readiness evidence, compatibility evidence, completeness, confidence, human-review state, and `testOnly`.'],
    'VEHICLE_AVAILABILITY_MODEL.md': ['# Vehicle Availability Model', '', `States: ${evidence.availabilityStates.join(', ')}. Assigned does not automatically mean in use; missing evidence cannot silently become available; out-of-service requires explicit evidence.`],
    'VEHICLE_READINESS_MODEL.md': ['# Vehicle Readiness Model', '', `States: ${evidence.readinessStates.join(', ')}. Readiness is blocked by explicit out-of-service state, route incompatibility, open critical issue, assignment mismatch, unavailable vehicle, and insufficient critical evidence.`],
    'ROUTE_VEHICLE_COMPATIBILITY.md': ['# Route Vehicle Compatibility', '', `States: ${evidence.compatibilityStates.join(', ')}. Route Intelligence remains authoritative for clearance, weight, dimension, restriction, and hazard compatibility. Fleet summarizes but does not recompute or override Route Intelligence.`],
    'FLEET_UTILIZATION_AWARENESS.md': ['# Fleet Utilization Awareness', '', 'Fleet summaries count vehicles by availability, readiness, route impact, insufficient evidence, and review requirements. They do not rank employees, optimize staffing, recommend downsizing, or make procurement recommendations.'],
    'MAINTENANCE_STATUS_AWARENESS.md': ['# Maintenance Status Awareness', '', `States: ${evidence.maintenanceStates.join(', ')}. Existing maintenance status may be represented only when evidence is supplied. No predictive maintenance, component failure estimation, repair authorization, or parts purchase recommendation exists.`],
    'UNRESOLVED_VEHICLE_ISSUES.md': ['# Unresolved Vehicle Issues', '', `Issue types: ${evidence.issueTypes.join(', ')}. Issues preserve Organization, vehicle, route, driver where operationally necessary, evidence, reason codes, completeness, confidence, severity, route impact, and employment-impact prohibition.`],
    'ROUTE_IMPACT_MODEL.md': ['# Route Impact Model', '', `States: ${evidence.routeImpactStates.join(', ')}. Fleet records route impact from vehicle state but never assigns substitute vehicles or dispatches autonomously.`],
    'FLEET_EXCEPTION_MODEL.md': ['# Fleet Exception Model', '', 'Fleet exceptions are evidence-backed vehicle issues derived from deterministic availability, assignment, compatibility, maintenance, and evidence-completeness checks.'],
    'EXCEPTION_SEVERITY_MODEL.md': ['# Exception Severity Model', '', `Severities: ${evidence.severities.join(', ')}. Severity represents operational impact only, not employee performance, blame, negligence, replacement priority, or vehicle financial value.`],
    'FLEET_ALERT_MODEL.md': ['# Fleet Alert Model', '', `Next steps: ${evidence.nextSteps.join(', ')}. Alerts contain structured facts, evidence, reason codes, limitations, lifecycle state, and operational next steps. Substitute review is allowed; autonomous assignment is not.`],
    'ALERT_LIFECYCLE.md': ['# Alert Lifecycle', '', `Lifecycle states: ${evidence.alertStatuses.join(', ')}. Acknowledgement does not equal resolution. No production notification delivery is added.`],
    'SUPERVISOR_FLEET_VISIBILITY.md': ['# Supervisor Fleet Visibility', '', 'Supervisor-facing evidence includes vehicle counts, unavailable/out-of-service counts, route impacts, unresolved critical vehicle issues, review requirements, route/vehicle incompatibilities, evidence gaps, and human-review items. No dashboard UI is added.'],
    'DETERMINISTIC_EXPLANATIONS.md': ['# Deterministic Explanations', '', 'Explanations derive from vehicle availability, readiness, route compatibility, maintenance evidence, route impact, issues, and evidence completeness. They do not infer mechanical cause, future breakdown, employee negligence, or replacement need.'],
    'EVIDENCE_AND_CONFIDENCE.md': ['# Evidence and Confidence', '', 'Completeness and confidence are explicit. Stale, conflicting, unknown, and insufficient evidence remain visible and cannot silently become ready.'],
    'REASON_CODES.md': ['# Reason Codes', '', Object.keys(evidence.reasonCodes).sort().map((code) => `- ${code}`).join('\n')],
    'ROUTE_INTELLIGENCE_INTEGRATION.md': ['# Route Intelligence Integration', '', 'Route Intelligence remains authoritative for vehicle profile compatibility, clearance, weight, dimension, restrictions, safety, route rejection, and hazard compatibility. Fleet consumes and summarizes Route Intelligence results.'],
    'DRIVER_INTELLIGENCE_INTEGRATION.md': ['# Driver Intelligence Integration', '', 'Driver Intelligence remains authoritative for driver operational state. Fleet may reference assigned driver IDs only where operationally necessary and never scores, ranks, or disciplines drivers.'],
    'SUPERVISOR_INTELLIGENCE_INTEGRATION.md': ['# Supervisor Intelligence Integration', '', 'Supervisor Intelligence remains the aggregation boundary for supervisor operations. Fleet produces evidence suitable for supervisor visibility without production notifications or UI changes.'],
    'WAREHOUSE_INTELLIGENCE_INTEGRATION.md': ['# Warehouse Intelligence Integration', '', 'Warehouse Intelligence remains authoritative for departure/load readiness. Fleet may reference warehouse departure blockers as evidence but does not change warehouse workflows.'],
    'BENCHMARK_DATASETS.md': ['# Benchmark Datasets', '', `Synthetic benchmark cases: ${evidence.benchmarkCases.length}. Cases cover availability, assignment, in-use, unavailable, out-of-service, route compatibility, review, maintenance, stale/conflicting evidence, readiness, route impact, alerts, lifecycle, insufficient evidence, unknown state, and no-exception readiness.`],
    'PLATFORM_INTEGRATION.md': ['# Platform Integration', '', 'The package integrates by evidence with Route, Driver, Supervisor, Warehouse, capability registry availability, orchestration, lifecycle, knowledge graph, dashboard data, framework validation, roadmap workflow, and tenant/security boundaries. It creates no new framework.'],
    'KNOWLEDGE_GRAPH_INTEGRATION.md': ['# Knowledge Graph Integration', '', 'After regeneration, repository docs, scripts, generated artifacts, and module files are indexed by the existing knowledge graph. No production graph service is deployed.'],
    'DASHBOARD_INTEGRATION.md': ['# Dashboard Integration', '', 'After regeneration, existing dashboard data generation indexes Fleet Intelligence docs and scripts as repository-only evidence. No dashboard runtime or API is added.'],
    'SECURITY_AND_TENANT_REVIEW.md': ['# Security and Tenant Review', '', 'Organization isolation is enforced in synthetic validation. Cross-Organization vehicle evidence cannot produce ready state. No authentication, RBAC, credential, database, provider, or production setting is changed.'],
    'EMPLOYMENT_IMPACT_GUARDRAILS.md': ['# Employment Impact Guardrails', '', 'The foundation prohibits employee scoring, driver scoring, ranking, productivity rating, discipline, termination, compensation, autonomous workforce decisions, and negligence conclusions. Vehicle readiness is operational evidence, not employee-performance judgment.'],
    'PREDICTIVE_MAINTENANCE_BOUNDARY.md': ['# Predictive Maintenance Boundary', '', 'No predictive maintenance model, failure probability, predicted breakdown date, component failure estimate, repair authorization, replacement recommendation, or parts purchase recommendation exists. Maintenance status is represented only when supplied as existing evidence.'],
    'AUTONOMOUS_ACTION_BOUNDARY.md': ['# Autonomous Action Boundary', '', 'The foundation never dispatches, assigns substitute vehicles, authorizes maintenance, approves repairs, purchases parts, replaces vehicles, or changes route assignments. It emits review-oriented evidence only.'],
    'TEST_PLAN.md': ['# Test Plan', '', 'Run syntax checks, Fleet generation twice, Fleet validate/check/benchmarks/test, controlled negative checks, Route/Driver/Supervisor/Warehouse/fleet-scoring/roadmap/platform/security tests, and full `npm.cmd test`.'],
    'TEST_RESULTS.md': ['# Test Results', '', 'Implementation-phase validation is recorded in the Codex completion report. Generated artifacts are deterministic and stale-artifact checks are enforced by `check-fleet-intelligence.cjs`.'],
    'IMPLEMENTATION_REPORT.md': ['# Implementation Report', '', 'Implemented deterministic repository-only Fleet Intelligence Foundation. No public API, production behavior, deployment, migration, database write, provider/model execution, predictive maintenance, autonomous dispatch, autonomous repair authorization, autonomous purchasing, employee/driver scoring, or Customer Intelligence work was added.'],
    'DEFERRED_WORK.md': ['# Deferred Work', '', '- Production vehicle availability thresholds.', '- Production maintenance policy.', '- Production out-of-service authority.', '- Substitute vehicle assignment authority.', '- Fleet utilization targets.', '- Fleet replacement rules.', '- Vehicle procurement.', '- Production telematics, ELD, OBD, CAN bus, and IoT integrations.', '- Model/provider selection.', '- Live orchestration.', '- Deployment and migrations.'],
    'OWNER_DECISIONS_REQUIRED.md': ['# Owner Decisions Required', '', '- Approve any future runtime Fleet Intelligence API.', '- Approve production vehicle availability and out-of-service authority.', '- Approve substitute vehicle review/assignment policy.', '- Approve production maintenance due/overdue rules.', '- Approve production telematics/ELD/IoT integrations.', '- Approve deployment, migrations, provider/model selection, and live orchestration separately.'],
    'ROLLBACK_PLAN.md': ['# Rollback Plan', '', 'Rollback is source-control only. This package performs no production writes, deployments, migrations, object mutations, credential changes, provider activation, or Cloudflare/Render configuration changes.']
  };
  return docs;
}

function generate(options = {}) {
  ensureDir(outDir);
  const evidence = fleet.buildFleetIntelligenceEvidence();
  const validation = fleet.validateFleetIntelligenceEvidence(evidence);
  const assessments = evidence.assessments.map((item) => item.assessment);
  const outputs = {
    [path.join(outDir, 'fleet_context_contract.json')]: json(evidence.contextContract),
    [path.join(outDir, 'fleet_vehicle_context_catalog.json')]: json({ generatedArtifact: true, vehicleContexts: assessments.map((item) => item.vehicleContext) }),
    [path.join(outDir, 'fleet_availability_catalog.json')]: json({ generatedArtifact: true, states: evidence.availabilityStates, availability: assessments.map((item) => item.availability) }),
    [path.join(outDir, 'fleet_readiness_catalog.json')]: json({ generatedArtifact: true, states: evidence.readinessStates, readiness: assessments.map((item) => item.readiness) }),
    [path.join(outDir, 'fleet_route_compatibility_catalog.json')]: json({ generatedArtifact: true, states: evidence.compatibilityStates, compatibility: assessments.map((item) => item.compatibility) }),
    [path.join(outDir, 'fleet_issue_catalog.json')]: json({ generatedArtifact: true, issueTypes: evidence.issueTypes, issues: assessments.flatMap((item) => item.issues) }),
    [path.join(outDir, 'fleet_route_impact_catalog.json')]: json({ generatedArtifact: true, states: evidence.routeImpactStates, routeImpacts: assessments.map((item) => item.routeImpact) }),
    [path.join(outDir, 'fleet_alert_catalog.json')]: json({ generatedArtifact: true, alertStatuses: evidence.alertStatuses, alerts: assessments.flatMap((item) => item.alerts) }),
    [path.join(outDir, 'fleet_reason_code_catalog.json')]: json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    [path.join(outDir, 'fleet_benchmark_catalog.json')]: json({ generatedArtifact: true, benchmarks: evidence.benchmarkCases }),
    [path.join(outDir, 'fleet_evidence_report.json')]: json({ generatedArtifact: true, validation, catalog: evidence.catalog, evidence: assessments.map((item) => ({ vehicleId: item.vehicleContext.vehicleId, evidence: item.vehicleContext.evidence, assessmentHash: item.assessmentHash })) }),
    [path.join(outDir, 'fleet_summary_report.json')]: json({ generatedArtifact: true, summary: evidence.summary, readinessByCase: evidence.assessments.map((item) => ({ caseId: item.caseId, readiness: item.assessment.readiness.state, routeImpact: item.assessment.routeImpact.state, hash: item.assessment.readiness.readinessHash })) }),
    [path.join(outDir, 'FLEET_INTELLIGENCE_SUMMARY.md')]: generatedSummary(evidence, validation)
  };
  for (const [fileName, lines] of Object.entries(narrativeDocs(evidence))) outputs[path.join(docsDir, fileName)] = `${lines.join('\n')}\n`;
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[fleet-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[fleet-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/fleet-intelligence-foundation`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
