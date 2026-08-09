#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const supervisorIntel = require('../services/intelligenceExecution/supervisorOperationalIntelligence');

const outDir = supervisorIntel.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/supervisor-intelligence-foundation. Do not hand-edit.';

function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function json(value) { return `${JSON.stringify(supervisorIntel.stable(value), null, 2)}\n`; }
function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}

function summary(evidence, validation) {
  const alerts = evidence.assessments.flatMap((item) => item.alerts);
  const bySeverity = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {});
  return [
    `<!-- ${generatedHeader} -->`,
    '# Supervisor Intelligence Foundation Summary',
    '',
    'The Supervisor Intelligence Foundation is repository-only, deterministic, provider-neutral, and test-only. It aggregates Route Intelligence and Driver Intelligence outputs into operational context, route portfolio visibility, exceptions, alerts, summaries, and explanations without production APIs, production notifications, employee scoring, discipline recommendations, autonomous workforce action, deployments, or migrations.',
    '',
    `- Schema version: ${supervisorIntel.SUPERVISOR_INTELLIGENCE_SCHEMA_VERSION}`,
    `- Engine version: ${supervisorIntel.SUPERVISOR_INTELLIGENCE_ENGINE_VERSION}`,
    `- Supervisor capabilities: ${evidence.capabilities.length}`,
    `- Benchmark cases: ${evidence.benchmarkCases.length}`,
    `- Enterprise registry integrated: ${evidence.catalog.integratedWithEnterpriseRegistry}`,
    `- Orchestration integrated: ${evidence.catalog.integratedWithCapabilityOrchestration}`,
    `- Lifecycle integrated: ${evidence.catalog.integratedWithLifecycleFramework}`,
    `- Route Intelligence integrated: ${evidence.catalog.integratedWithRouteIntelligence}`,
    `- Driver Intelligence integrated: ${evidence.catalog.integratedWithDriverIntelligence}`,
    `- Existing daily report compatibility preserved: ${evidence.catalog.existingDailyReportCompatibilityPreserved}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    '',
    '## Alert Severity Counts',
    '',
    '| Severity | Count |',
    '| --- | ---: |',
    ...Object.entries(bySeverity).sort(([a], [b]) => a.localeCompare(b)).map(([severity, count]) => `| ${severity} | ${count} |`)
  ].join('\n') + '\n';
}

function generate(options = {}) {
  ensureDir();
  const evidence = supervisorIntel.buildSupervisorIntelligenceEvidence();
  const validation = supervisorIntel.validateSupervisorIntelligenceEvidence(evidence);
  const alerts = evidence.assessments.flatMap((item) => item.alerts);
  const outputs = {
    'supervisor_intelligence_capability_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, capabilities: evidence.capabilities }),
    'supervisor_context_contract.json': json({ generatedArtifact: true, contract: evidence.contextContract }),
    'supervisor_route_portfolio_catalog.json': json({ generatedArtifact: true, routeStates: evidence.routeStates, portfolios: evidence.assessments.map((item) => ({ caseId: item.caseId, routes: item.portfolio.routes })) }),
    'supervisor_exception_catalog.json': json({ generatedArtifact: true, exceptionTypes: evidence.exceptionTypes, exceptions: evidence.assessments.flatMap((item) => item.exceptions) }),
    'supervisor_alert_catalog.json': json({ generatedArtifact: true, alertStatuses: evidence.alertStatuses, nextSteps: evidence.nextSteps, alerts }),
    'supervisor_reason_code_catalog.json': json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    'supervisor_summary_catalog.json': json({ generatedArtifact: true, summaries: evidence.assessments.map((item) => ({ caseId: item.caseId, summary: item.summary })) }),
    'supervisor_evidence_report.json': json({ generatedArtifact: true, evidence: evidence.assessments.map((item) => ({ caseId: item.caseId, contextValid: item.portfolio.contextValidation.valid, exceptionCount: item.exceptions.length, alertCount: item.alerts.length, limitations: item.summary.limitations })) }),
    'supervisor_alert_priority_report.json': json({ generatedArtifact: true, priorities: alerts.map((alert) => ({ alertId: alert.alertId, severity: alert.severity, priority: alert.priority, priorityTrace: alert.priorityTrace, recommendedOperationalNextStep: alert.recommendedOperationalNextStep })) }),
    'supervisor_benchmark_catalog.json': json({ generatedArtifact: true, benchmarkCases: evidence.benchmarkCases }),
    'supervisor_readiness_report.json': json({ generatedArtifact: true, readiness: { repositoryOnly: true, deterministicRulesOnly: true, noProductionNotification: true, noEmployeeScoring: true, noDisciplineRecommendation: true, noAutonomousWorkforceAction: true, noProductionReadinessClaim: true, validation } }),
    'SUPERVISOR_INTELLIGENCE_SUMMARY.md': summary(evidence, validation)
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[supervisor-operational-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[supervisor-operational-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/supervisor-intelligence-foundation/generated`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
