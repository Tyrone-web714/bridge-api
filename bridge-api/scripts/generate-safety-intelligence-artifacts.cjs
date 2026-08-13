#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const safety = require('../services/intelligenceExecution/safetyIntelligence');

const repoRoot = safety.paths.repoRoot;
const outDir = safety.paths.generatedRoot;
const docsDir = path.dirname(outDir);
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/safetyIntelligence.js. Do not hand-edit generated artifacts.';

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function json(value) { return `${JSON.stringify(safety.stable(value), null, 2)}\n`; }
function writeIfChanged(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generatedSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Safety Intelligence Summary',
    '',
    'The Safety Intelligence Foundation is repository-only, deterministic, provider-neutral, synthetic, and test-only. It aggregates existing TSR safety evidence from Route, Driver, Fleet, Warehouse, Operations, and Shared Safety without replacing those authoritative domains.',
    '',
    `- Schema version: ${evidence.catalog.schemaVersion}`,
    `- Engine version: ${evidence.catalog.engineVersion}`,
    `- Benchmark cases: ${evidence.catalog.benchmarkCaseCount}`,
    `- Capabilities: ${evidence.catalog.capabilityCount}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Existing safety audit complete: ${evidence.catalog.currentSafetyFunctionalityAuditComplete}`,
    `- Lower-domain override generated: ${evidence.catalog.lowerDomainOverrideGenerated}`,
    `- Safety score generated: ${evidence.catalog.safetyScoreGenerated}`,
    `- Employee ranking generated: ${evidence.catalog.employeeRankingGenerated}`,
    `- Negligence conclusion generated: ${evidence.catalog.negligenceConclusionGenerated}`,
    `- Autonomous action generated: ${evidence.catalog.autonomousActionGenerated}`,
    `- Prediction generated: ${evidence.catalog.predictionGenerated}`,
    `- Monitoring hardware introduced: ${evidence.catalog.monitoringHardwareIntroduced}`,
    `- Compliance product expanded: ${evidence.catalog.complianceProductExpanded}`,
    `- Provider/model execution: ${evidence.catalog.providerCallInvoked}`,
    ''
  ].join('\n');
}

function docs(evidence) {
  const common = 'Repository-only, synthetic, deterministic, provider-neutral, aggregation-only, lower domains remain authoritative, no driver or employee safety scoring, no negligence or misconduct finding, no prediction, no autonomous safety action, no hardware or monitoring expansion, no OSHA/DOT/insurance product expansion, no provider/model execution, no production API, no deployment, no migration, and no production-readiness claim.';
  const auditTable = [
    '| Component | Classification | Decision |',
    '| --- | --- | --- |',
    '| `services/intelligenceExecution/routeIntelligence.js` and route safety docs/artifacts | REUSE_UNCHANGED | Authoritative for low-clearance, truck restriction, road closure, residential restriction, route safety, compatibility, and route rejection evidence. |',
    '| `services/intelligenceExecution/driverIntelligence.js` | REUSE_UNCHANGED | Authoritative for speed, low-bridge, restricted-road, no-through-truck, residential advisory, and hazard acknowledgement evidence. |',
    '| `services/intelligenceExecution/fleetIntelligence.js` | REUSE_UNCHANGED | Authoritative for vehicle readiness and route/vehicle safety compatibility evidence. |',
    '| `services/intelligenceExecution/warehouseIntelligence.js` | REUSE_UNCHANGED | Authoritative for departure readiness and warehouse blockers where already safety-relevant. |',
    '| `services/intelligenceExecution/operationsIntelligence.js` | REUSE_UNCHANGED | Authoritative for operations-level safety-related exceptions and correlations. |',
    '| `services/sharedSafety.js`, Shared Safety routes, migrations, checks, and moderation UI | REUSE_UNCHANGED | Authoritative for shared safety governance, sanitization, moderation, and accepted/pending record handling. |',
    '| Routing compliance, manual hazards, low-bridge data, and Google Maps compliance checks | REFERENCE_ONLY | Existing evidence sources remain separate and are not replaced. |',
    '| BI/KPI, logistics intelligence, heatmaps, and non-safety operational analytics | REFERENCE_ONLY | They may provide future context but are not Safety authorities. |',
    '| Generalized OSHA/DOT/insurance/computer-vision/telematics/ELD/biometric monitoring | OUT_OF_SCOPE | Not implemented or activated. |',
    '| Safety Intelligence aggregation boundary | EXTEND | Add repository-only deterministic aggregation and preservation layer for cross-domain safety awareness. |'
  ].join('\n');
  const generatedFiles = [
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
  return {
    'README.md': ['# Safety Intelligence Foundation', '', 'This package creates deterministic repository-only Safety Intelligence for organization-level safety awareness by aggregating existing TSR safety evidence.', '', common].join('\n'),
    'CURRENT_SAFETY_FUNCTIONALITY_AUDIT.md': ['# Current Safety Functionality Audit', '', auditTable].join('\n'),
    'SAFETY_INTELLIGENCE_ARCHITECTURE.md': ['# Safety Intelligence Architecture', '', 'A dedicated deterministic module, `services/intelligenceExecution/safetyIntelligence.js`, is justified as an aggregation and preservation layer. Route, Driver, Fleet, Warehouse, Operations, and Shared Safety remain authoritative for their lower-domain conclusions.', '', common].join('\n'),
    'EXISTING_SERVICE_REUSE_DECISION.md': ['# Existing Service Reuse Decision', '', 'Existing safety-capable services are reused unchanged. Safety Intelligence references their evidence, normalizes cross-domain context, classifies deterministic safety exceptions, and records authority traces without duplicating or overriding lower-domain logic.'].join('\n'),
    'AUTHORITATIVE_SAFETY_BOUNDARIES.md': ['# Authoritative Safety Boundaries', '', 'Safety Intelligence may aggregate, preserve, summarize, identify evidence gaps, and request human review. It cannot recompute route eligibility, override driver advisories, change vehicle compatibility, approve warehouse departure, accept shared safety records, or issue production safety commands.'].join('\n'),
    'ORGANIZATION_SAFETY_CONTEXT.md': ['# Organization Safety Context', '', 'Safety context includes organization, reporting window, route/driver/supervisor/warehouse/vehicle/operations/shared-safety scopes, source domains, source record IDs, source hashes, timestamps, completeness, confidence, freshness, conflicts, unknown fields, human-review flag, and test-only marker.'].join('\n'),
    'ROUTE_SAFETY_PORTFOLIO.md': ['# Route Safety Portfolio', '', 'The portfolio preserves route safety conditions including low-clearance hazards, truck restrictions, no-through-truck restrictions, road closures, residential restrictions, route blockers, route/vehicle incompatibility, review-required states, stale evidence, conflicts, and unknown evidence.'].join('\n'),
    'LOW_CLEARANCE_SAFETY_AWARENESS.md': ['# Low-Clearance Safety Awareness', '', 'Low-clearance evidence is aggregated only when supplied by existing Route, Driver, or Shared Safety sources. The foundation does not create new clearance records or move hazard authority.'].join('\n'),
    'TRUCK_RESTRICTION_AWARENESS.md': ['# Truck Restriction Awareness', '', 'Truck prohibition and no-through-truck evidence remains route/driver authoritative. Safety Intelligence creates awareness exceptions only from known evidence.'].join('\n'),
    'ROAD_CLOSURE_AWARENESS.md': ['# Road Closure Awareness', '', 'Road closure evidence can create critical safety awareness when source evidence marks the route condition active. No map provider data, closure feed, or production routing behavior is added.'].join('\n'),
    'RESIDENTIAL_RESTRICTION_AWARENESS.md': ['# Residential Restriction Awareness', '', 'Residential restriction and advisory evidence is preserved as safety context and may require review. It is not driver discipline or performance evidence.'].join('\n'),
    'DRIVER_SAFETY_ADVISORY_AGGREGATION.md': ['# Driver Safety Advisory Aggregation', '', 'Driver advisory evidence is aggregated without driver ranking, scoring, employment decisions, biometric monitoring, or new telematics/ELD behavior.'].join('\n'),
    'SPEED_WARNING_BOUNDARY.md': ['# Speed Warning Boundary', '', 'Speed warning evidence is treated as operational safety advisory evidence only. The foundation does not infer negligence, intent, fatigue, crash probability, or employee performance.'].join('\n'),
    'VEHICLE_ROUTE_SAFETY_COMPATIBILITY.md': ['# Vehicle Route Safety Compatibility', '', 'Fleet Intelligence remains authoritative for route/vehicle compatibility. Safety Intelligence may surface incompatible or review-required compatibility evidence for human review.'].join('\n'),
    'WAREHOUSE_SAFETY_IMPACT.md': ['# Warehouse Safety Impact', '', 'Warehouse blockers are included only when already safety-relevant. Ordinary warehouse delay or completeness issues are not promoted into safety exceptions.'].join('\n'),
    'OPERATIONS_SAFETY_EXCEPTION_INTEGRATION.md': ['# Operations Safety Exception Integration', '', 'Operations Intelligence remains authoritative for operations-level exceptions. Safety Intelligence may reference operations safety exceptions without inferring causation or creating broader operational findings.'].join('\n'),
    'SHARED_SAFETY_INTELLIGENCE_INTEGRATION.md': ['# Shared Safety Intelligence Integration', '', 'Accepted shared safety records remain contextual; pending or review-required records create review exceptions. Safety Intelligence does not bypass Shared Safety moderation.'].join('\n'),
    'SAFETY_EXCEPTION_MODEL.md': ['# Safety Exception Model', '', `Exception types: ${evidence.exceptionTypes.join(', ')}. Exceptions preserve source domains, source record IDs, hashes, timestamps, reason codes, severity, priority, human-review flags, and test-only markers.`].join('\n'),
    'SAFETY_SEVERITY_MODEL.md': ['# Safety Severity Model', '', `Severities: ${evidence.severities.join(', ')}. Severity is deterministic and reflects safety-awareness impact only.`].join('\n'),
    'SAFETY_PRIORITY_MODEL.md': ['# Safety Priority Model', '', `Priorities: ${evidence.priorities.join(', ')}. Priority does not include employee value, driver ranking, profitability, insurance eligibility, or disciplinary factors.`].join('\n'),
    'SAFETY_ALERT_MODEL.md': ['# Safety Alert Model', '', `Allowed next steps: ${evidence.nextSteps.join(', ')}. Alerts are decision-support records only and do not perform autonomous actions.`].join('\n'),
    'ALERT_LIFECYCLE.md': ['# Alert Lifecycle', '', `Repository-only lifecycle states: ${evidence.alertStatuses.join(', ')}. Acknowledgement, resolution, and invalidation are synthetic test lifecycle states only.`].join('\n'),
    'SAFETY_SUMMARY_MODEL.md': ['# Safety Summary Model', '', 'Summaries include source-domain counts, known exception counts, route/driver/vehicle/shared-safety review needs, stale/conflicting/missing evidence, and human-review counts. Unknowns remain unknown.'].join('\n'),
    'DETERMINISTIC_EXPLANATIONS.md': ['# Deterministic Explanations', '', 'Explanations cite source facts, classification rules, limitations, and authority boundaries. They do not infer intent, negligence, misconduct, fatigue, crash probability, or future incidents.'].join('\n'),
    'SAFETY_EVIDENCE_FRESHNESS.md': ['# Safety Evidence Freshness', '', `Freshness states: ${evidence.freshnessStates.join(', ')}. Stale evidence remains stale and cannot be treated as fresh by this layer.`].join('\n'),
    'SAFETY_AUTHORITY_TRACE.md': ['# Safety Authority Trace', '', 'Every assessment records that lower domains remain authoritative and includes source-domain hashes and result hashes to prevent Safety Intelligence from becoming an untraceable second source of truth.'].join('\n'),
    'EMPLOYMENT_DRIVER_IMPACT_BOUNDARY.md': ['# Employment and Driver Impact Boundary', '', 'No driver safety score, employee ranking, risk score, unsafe-driver label, negligence conclusion, misconduct conclusion, discipline, termination, compensation, insurance eligibility, or legal-liability conclusion is generated.'].join('\n'),
    'AUTONOMOUS_SAFETY_ACTION_BOUNDARY.md': ['# Autonomous Safety Action Boundary', '', 'No route shutdown, driver lockout, vehicle lockout, autonomous dispatch, reassignment, discipline, enforcement, or automatic safety command is generated.'].join('\n'),
    'PREDICTIVE_SAFETY_BOUNDARY.md': ['# Predictive Safety Boundary', '', 'No crash, accident, collision, fatigue, driver-behavior, injury, insurance-risk, criminal-risk, or incident prediction is generated.'].join('\n'),
    'MONITORING_HARDWARE_BOUNDARY.md': ['# Monitoring Hardware Boundary', '', 'No camera/computer-vision monitoring, facial analysis, emotion detection, eye tracking, biometric monitoring, wearable monitoring, new telematics device, ELD functionality, CAN bus integration, or vehicle sensor integration is introduced.'].join('\n'),
    'COMPLIANCE_INSURANCE_BOUNDARY.md': ['# Compliance and Insurance Boundary', '', 'No generalized OSHA platform, DOT-compliance platform, insurance platform, insurance eligibility decision, or legal-liability determination is implemented.'].join('\n'),
    'BENCHMARK_DATASETS.md': ['# Benchmark Datasets', '', `Synthetic benchmark cases: ${evidence.benchmarkCases.length}. Cases cover no exceptions, route blockers, low clearance, restrictions, road closures, residential restrictions, vehicle incompatibility, driver advisories, speed warnings, stale/missing/conflicting evidence, warehouse/operations/shared safety, multiple exceptions, cross-Organization rejection, human review, lifecycle transitions, and no-exception regression.`].join('\n'),
    'REGRESSION_BOUNDARIES.md': ['# Regression Boundaries', '', 'Regression checks reject lower-domain overrides, cross-Organization aggregation, unknown-as-safe handling, stale-as-fresh handling, ordinary operational/warehouse issue promotion, prohibited fields, provider/model activation, production activation, package-number fabrication, and unapproved ninth Milestone 1 domains.'].join('\n'),
    'PLATFORM_INTEGRATION.md': ['# Platform Integration', '', 'The foundation integrates with existing capability registry, orchestration, lifecycle, Route, Driver, Fleet, Warehouse, Operations, and Shared Safety evidence through repository-only deterministic references.'].join('\n'),
    'KNOWLEDGE_GRAPH_INTEGRATION.md': ['# Knowledge Graph Integration', '', 'The knowledge graph may index Safety Intelligence docs, service, scripts, and generated artifacts after regeneration. No graph database or production graph service is added.'].join('\n'),
    'DASHBOARD_INTEGRATION.md': ['# Dashboard Integration', '', 'Dashboard data generation may reference Safety Intelligence repository evidence after regeneration. No dashboard route, widget, API, or production data pipeline is added.'].join('\n'),
    'SECURITY_AND_TENANT_REVIEW.md': ['# Security and Tenant Review', '', 'Synthetic validation rejects cross-Organization aggregation. Future runtime context must be trusted and server-derived. No authentication, RBAC, credential, database, provider, R2, or infrastructure setting is changed.'].join('\n'),
    'DATA_LIFECYCLE_REVIEW.md': ['# Data Lifecycle Review', '', 'Safety Intelligence does not define production retention, escalation, alert channels, persistence, purge policy, or regulatory records. Existing data lifecycle governance remains authoritative.'].join('\n'),
    'TEST_PLAN.md': ['# Test Plan', '', 'Run syntax checks, Safety generation twice, Safety validate/check/benchmarks/test, roadmap, knowledge graph, dashboard, framework validation, orchestration, lifecycle, Route/Driver/Supervisor/Warehouse/Fleet/Customer/Operations/Shared Safety/security tests, and full `npm.cmd test`.'].join('\n'),
    'TEST_RESULTS.md': ['# Test Results', '', 'Implementation-phase validation is recorded in the Codex completion report. Generated artifacts are deterministic and stale-artifact checks are enforced by `check-safety-intelligence.cjs`.'].join('\n'),
    'IMPLEMENTATION_REPORT.md': ['# Implementation Report', '', 'Implemented deterministic repository-only Safety Intelligence Foundation. No application runtime behavior, public API, deployment, migration, database write, object mutation, provider/model execution, safety scoring, predictive model, autonomous action, monitoring hardware, or compliance/insurance product expansion was added.'].join('\n'),
    'DEFERRED_WORK.md': ['# Deferred Work', '', '- Production safety thresholds.', '- Production escalation channels.', '- Runtime API and persistence.', '- Owner-approved model/provider work.', '- Any compliance, insurance, hardware, telematics, ELD, computer-vision, biometric, prediction, or autonomous-action scope.'].join('\n'),
    'OWNER_DECISIONS_REQUIRED.md': ['# Owner Decisions Required', '', '- Approve any future Safety Intelligence runtime API.', '- Approve production thresholds and escalation channels.', '- Approve any model/provider, production orchestration, deployment, migration, prediction, autonomous-action, monitoring hardware, compliance, or insurance scope separately.'].join('\n'),
    'UNAPPROVED_IDEAS_FOR_OWNER_REVIEW.md': ['# Unapproved Ideas for Owner Review', '', '| Idea | Potential value | Why outside current scope | Architectural impact | Cost/complexity | Risks |', '| --- | --- | --- | --- | --- | --- |', '| Production safety alert channel | Faster human review | Production notifications not approved | Requires persistence, auth, monitoring, rollback | Medium | Alert fatigue, wrong escalation |', '| Predictive safety scoring | Risk trend insight | Prediction and scoring are prohibited | Requires model governance and legal review | High | Employment and liability misuse |', '| Hardware monitoring integrations | More sensor evidence | New hardware/telematics/biometric scope prohibited | Requires device integrations and policy | High | Privacy, compliance, false positives |'].join('\n'),
    'ROLLBACK_PLAN.md': ['# Rollback Plan', '', 'Rollback is source-control only. This package performs no production writes, deployments, migrations, object mutations, credential changes, provider activation, Cloudflare/R2 changes, or infrastructure changes.'].join('\n'),
    'GENERATED_ARTIFACTS.md': ['# Generated Artifacts', '', generatedFiles.map((file) => `- \`${file}\``).join('\n')].join('\n')
  };
}

function generate(options = {}) {
  ensureDir(outDir);
  const evidence = safety.buildSafetyIntelligenceEvidence();
  const validation = safety.validateSafetyIntelligenceEvidence(evidence);
  const assessments = evidence.assessments.map((item) => item.assessment);
  const outputs = {
    [path.join(outDir, 'safety_context_contract.json')]: json(evidence.contextContract),
    [path.join(outDir, 'safety_route_portfolio.json')]: json({ generatedArtifact: true, routePortfolio: assessments.map((item) => item.routeSafetyPortfolio) }),
    [path.join(outDir, 'safety_hazard_catalog.json')]: json({ generatedArtifact: true, hazards: assessments.flatMap((item) => item.exceptions.filter((exception) => ['ROUTE_SAFETY_BLOCKER_ACTIVE','LOW_CLEARANCE_HAZARD_ACTIVE','TRUCK_RESTRICTION_ACTIVE','NO_THROUGH_TRUCK_RESTRICTION_ACTIVE','ROAD_CLOSURE_ACTIVE','RESIDENTIAL_RESTRICTION_ACTIVE'].includes(exception.exceptionType))) }),
    [path.join(outDir, 'safety_driver_advisory_catalog.json')]: json({ generatedArtifact: true, driverAdvisories: assessments.flatMap((item) => item.exceptions.filter((exception) => exception.exceptionType.startsWith('DRIVER_'))) }),
    [path.join(outDir, 'safety_shared_intelligence_catalog.json')]: json({ generatedArtifact: true, sharedSafety: assessments.flatMap((item) => item.context.sourceEvidence.filter((source) => source.sourceDomain === 'SHARED_SAFETY')) }),
    [path.join(outDir, 'safety_exception_catalog.json')]: json({ generatedArtifact: true, exceptionTypes: evidence.exceptionTypes, exceptions: assessments.flatMap((item) => item.exceptions) }),
    [path.join(outDir, 'safety_severity_catalog.json')]: json({ generatedArtifact: true, severities: evidence.severities, exceptions: assessments.flatMap((item) => item.exceptions.map((exception) => ({ exceptionId: exception.exceptionId, exceptionType: exception.exceptionType, severity: exception.severity, priority: exception.priority }))) }),
    [path.join(outDir, 'safety_alert_catalog.json')]: json({ generatedArtifact: true, alertStatuses: evidence.alertStatuses, nextSteps: evidence.nextSteps, alerts: assessments.flatMap((item) => item.alerts), lifecycles: assessments.map((item) => item.alertLifecycle) }),
    [path.join(outDir, 'safety_reason_code_catalog.json')]: json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    [path.join(outDir, 'safety_evidence_report.json')]: json({ generatedArtifact: true, validation, catalog: evidence.catalog, authorityTraces: assessments.map((item) => item.authorityTrace) }),
    [path.join(outDir, 'safety_summary_report.json')]: json({ generatedArtifact: true, summaries: assessments.map((item) => item.summary), explanations: assessments.map((item) => item.explanation) }),
    [path.join(outDir, 'safety_benchmark_catalog.json')]: json({ generatedArtifact: true, benchmarks: evidence.benchmarkCases }),
    [path.join(outDir, 'SAFETY_INTELLIGENCE_SUMMARY.md')]: generatedSummary(evidence, validation)
  };
  for (const [name, content] of Object.entries(docs(evidence))) outputs[path.join(docsDir, name)] = `${content}\n`;
  const changed = Object.entries(outputs).filter(([file, content]) => writeIfChanged(file, content, options)).map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[safety-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[safety-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/safety-intelligence-foundation`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
