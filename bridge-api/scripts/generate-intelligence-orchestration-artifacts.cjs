#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const orchestration = require('../services/intelligenceExecution/intelligenceCapabilityOrchestration');

const outDir = orchestration.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/intelligence-capability-orchestration. Do not hand-edit.';

function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function json(value) { return `${JSON.stringify(orchestration.stable(value), null, 2)}\n`; }
function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}
function domainSummary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Intelligence Capability Domain Summary',
    '',
    'Enterprise intelligence orchestration artifacts are repository-only, deterministic, metadata-only, provider-neutral, and test-only. They do not implement predictive models, prompts, runtime APIs, provider routing, production execution, deployments, or migrations.',
    '',
    `- Schema version: ${orchestration.ORCHESTRATION_SCHEMA_VERSION}`,
    `- Engine version: ${orchestration.ORCHESTRATION_ENGINE_VERSION}`,
    `- Capability count: ${evidence.capabilities.length}`,
    `- Contract count: ${evidence.contracts.length}`,
    `- Plan templates: ${evidence.plans.length}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    '',
    '| Domain | Capabilities |',
    '| --- | ---: |',
    ...evidence.catalog.domains.map((domain) => `| ${domain.domain} | ${domain.capabilityCount} |`)
  ].join('\n') + '\n';
}
function generate(options = {}) {
  ensureDir();
  const evidence = orchestration.buildOrchestrationEvidence();
  const validation = orchestration.validateOrchestration(evidence);
  const readiness = orchestration.capabilityReadiness(evidence);
  const outputs = {
    'intelligence_capability_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, capabilities: evidence.capabilities }),
    'execution_contract_catalog.json': json({ generatedArtifact: true, contracts: evidence.contracts }),
    'orchestration_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, validation }),
    'execution_plan_templates.json': json({ generatedArtifact: true, plans: evidence.plans }),
    'domain_summary.md': domainSummary(evidence, validation),
    'capability_readiness.json': json({ generatedArtifact: true, readiness })
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[intelligence-orchestration] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[intelligence-orchestration] generated ${Object.keys(outputs).length} artifacts in docs/implementation/intelligence-capability-orchestration/generated`);
  }
  return { changed, evidence, validation, readiness };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
