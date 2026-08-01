#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const routeIntel = require('../services/intelligenceExecution/routeIntelligence');

const outDir = routeIntel.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/route-intelligence-foundation. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function json(value) {
  return `${JSON.stringify(routeIntel.stable(value), null, 2)}\n`;
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
    acc[record.primaryAssessment.status] = (acc[record.primaryAssessment.status] || 0) + 1;
    return acc;
  }, {});
  return [
    `<!-- ${generatedHeader} -->`,
    '# Route Intelligence Foundation Summary',
    '',
    'The Route Intelligence Foundation is repository-only, deterministic, provider-neutral, and advisory outside authoritative truck-safety rules. It does not modify production routing endpoints, call providers, deploy code, run migrations, mutate object storage, or make live safety certification claims.',
    '',
    `- Schema version: ${routeIntel.ROUTE_INTELLIGENCE_SCHEMA_VERSION}`,
    `- Engine version: ${routeIntel.ROUTE_INTELLIGENCE_ENGINE_VERSION}`,
    `- Route capabilities: ${evidence.capabilities.length}`,
    `- Benchmark cases: ${evidence.benchmarkCases.length}`,
    `- Enterprise registry integration: ${evidence.catalog.integratedWithEnterpriseRegistry}`,
    `- Capability orchestration integration: ${evidence.catalog.integratedWithCapabilityOrchestration}`,
    `- Lifecycle framework integration: ${evidence.catalog.integratedWithLifecycleFramework}`,
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
  const evidence = routeIntel.buildRouteIntelligenceEvidence();
  const validation = routeIntel.validateRouteIntelligenceEvidence(evidence);
  const comparison = routeIntel.compareRouteAlternatives(evidence.benchmarkCases[5].request);
  const outputs = {
    'route_intelligence_capability_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, capabilities: evidence.capabilities }),
    'vehicle_profile_contract.json': json({ generatedArtifact: true, contract: evidence.contracts.vehicleProfile }),
    'route_candidate_contract.json': json({ generatedArtifact: true, contract: evidence.contracts.routeCandidate }),
    'route_hazard_catalog.json': json({ generatedArtifact: true, hazards: evidence.benchmarkCases.flatMap((item) => item.request.routeCandidates.flatMap((candidate) => candidate.hazards || [])) }),
    'route_restriction_catalog.json': json({ generatedArtifact: true, restrictions: evidence.benchmarkCases.flatMap((item) => item.request.routeCandidates.flatMap((candidate) => candidate.restrictions || [])) }),
    'route_reason_code_catalog.json': json({ generatedArtifact: true, reasonCodes: evidence.reasonCodes }),
    'route_benchmark_catalog.json': json({ generatedArtifact: true, benchmarkCases: evidence.benchmarkCases }),
    'route_safety_assessment_catalog.json': json({ generatedArtifact: true, assessments: evidence.assessments.map((item) => item.primaryAssessment) }),
    'route_alternative_comparison_report.json': json({ generatedArtifact: true, comparison }),
    'route_evidence_completeness_report.json': json({ generatedArtifact: true, completeness: evidence.assessments.map((item) => ({ caseId: item.caseId, routeCandidateId: item.primaryAssessment.routeCandidateId, evidenceCompleteness: item.primaryAssessment.evidenceCompleteness })) }),
    'route_safety_gate_report.json': json({ generatedArtifact: true, gates: evidence.assessments.map((item) => ({ caseId: item.caseId, routeCandidateId: item.primaryAssessment.routeCandidateId, status: item.primaryAssessment.status, reasonCodes: item.primaryAssessment.reasonCodes })) }),
    'route_intelligence_readiness.json': json({ generatedArtifact: true, readiness: { repositoryOnly: true, deterministicRulesAuthoritative: true, providerCallInvoked: false, productionRouteEndpointModified: false, validation } }),
    'ROUTE_INTELLIGENCE_SUMMARY.md': summary(evidence, validation)
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[route-intelligence] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[route-intelligence] generated ${Object.keys(outputs).length} artifacts in docs/implementation/route-intelligence-foundation/generated`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
