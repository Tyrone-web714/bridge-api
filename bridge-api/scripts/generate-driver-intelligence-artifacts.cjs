#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const driverIntel = require('../services/intelligenceExecution/driverIntelligence');

const outDir = driverIntel.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/driver-intelligence-foundation. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function json(value) {
  return `${JSON.stringify(driverIntel.stable(value), null, 2)}\n`;
}

function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}

function summary(evidence, validation) {
  const statuses = evidence.assessments.reduce((acc, record) => {
    acc[record.assessment.status] = (acc[record.assessment.status] || 0) + 1;
    return acc;
  }, {});
  const reviewCount = evidence.assessments.filter((record) => record.assessment.humanReviewFlags.length > 0).length;
  return [
    `<!-- ${generatedHeader} -->`,
    '# Driver Intelligence Foundation Summary',
    '',
    'The Driver Intelligence Foundation is repository-only, deterministic, provider-neutral, and advisory. It assesses driver operational state, route adherence, route deviation, stop progress, speed compliance, low bridge approach, restricted road approach, no-through-truck approach, residential-area advisory/prohibition evidence, road-closure evidence, hazard acknowledgement, explanation, evidence, confidence, and human-review flags without scoring employees or making disciplinary recommendations.',
    '',
    `- Schema version: ${driverIntel.DRIVER_INTELLIGENCE_SCHEMA_VERSION}`,
    `- Engine version: ${driverIntel.DRIVER_INTELLIGENCE_ENGINE_VERSION}`,
    `- Driver capabilities: ${evidence.capabilities.length}`,
    `- Benchmark cases: ${evidence.benchmarkCases.length}`,
    `- Enterprise registry integrated: ${evidence.catalog.integratedWithEnterpriseRegistry}`,
    `- Direct registry capability deferred: ${evidence.catalog.directRegistryCapabilityDeferred}`,
    `- Capability orchestration integrated: ${evidence.catalog.integratedWithCapabilityOrchestration}`,
    `- Lifecycle framework integrated: ${evidence.catalog.integratedWithLifecycleFramework}`,
    `- Route Intelligence integrated: ${evidence.catalog.integratedWithRouteIntelligence}`,
    `- Assessments requiring human review: ${reviewCount}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    '',
    '## Synthetic Benchmark Statuses',
    '',
    '| Status | Count |',
    '| --- | ---: |',
    ...Object.entries(statuses).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `| ${status} | ${count} |`)
  ].join('\n') + '\n';
}

function generate(options = {}) {
  ensureDir();
  const evidence = driverIntel.buildDriverIntelligenceEvidence();
  const validation = driverIntel.validateDriverIntelligenceEvidence(evidence);
  const outputs = {
    'driver_intelligence_capability_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, capabilities: evidence.capabilities }),
    'driver_profile_contract.json': json({ generatedArtifact: true, contract: evidence.contracts.driverProfile }),
    'driver_event_contract.json': json({ generatedArtifact: true, contract: evidence.contracts.driverEvent }),
    'driver_state_catalog.json': json({ generatedArtifact: true, states: driverIntel.DRIVER_STATES }),
    'driver_event_catalog.json': json({ generatedArtifact: true, events: driverIntel.DRIVER_EVENTS }),
    'driver_reason_code_catalog.json': json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    'driver_advisory_catalog.json': json({ generatedArtifact: true, advisoryTypes: driverIntel.ADVISORY_TYPES, advisories: evidence.assessments.flatMap((item) => item.assessment.advisories) }),
    'driver_benchmark_catalog.json': json({ generatedArtifact: true, benchmarkCases: evidence.benchmarkCases }),
    'driver_assessment_catalog.json': json({ generatedArtifact: true, assessments: evidence.assessments.map((item) => item.assessment) }),
    'driver_evidence_completeness_report.json': json({ generatedArtifact: true, completeness: evidence.assessments.map((item) => ({ caseId: item.caseId, evidenceCompleteness: item.assessment.evidenceCompleteness, confidence: item.assessment.confidence })) }),
    'driver_human_review_report.json': json({ generatedArtifact: true, humanReviewFlags: evidence.assessments.map((item) => ({ caseId: item.caseId, status: item.assessment.status, humanReviewFlags: item.assessment.humanReviewFlags })) }),
    'driver_intelligence_readiness.json': json({ generatedArtifact: true, readiness: { repositoryOnly: true, deterministicRulesOnly: true, providerCallInvoked: false, hostedAiInvoked: false, employeeScoring: false, disciplinaryRecommendation: false, predictiveModel: false, productionApplicable: false, validation } }),
    'DRIVER_INTELLIGENCE_SUMMARY.md': summary(evidence, validation)
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[driver-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[driver-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/driver-intelligence-foundation/generated`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
