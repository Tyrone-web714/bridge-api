#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const registry = require('../services/intelligenceExecution/enterpriseCapabilityRegistry');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'enterprise-intelligence-capability-registry', 'generated');
const generatedHeader = 'Generated from bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js. Do not hand-edit.';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function buildJson(capabilities) {
  return `${JSON.stringify({ generatedFrom: 'bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js', generatedArtifact: true, capabilities: stable(capabilities) }, null, 2)}\n`;
}

function buildDependencies(capabilities) {
  const dependencies = capabilities.map((capability) => ({
    capabilityId: capability.capabilityId,
    upstreamCapabilityIds: capability.upstreamCapabilityIds,
    downstreamCapabilityIds: capability.downstreamCapabilityIds,
    requiredServices: capability.requiredServices,
    requiredDataSources: capability.requiredDataSources,
    requiredPolicies: capability.requiredPolicies,
    requiredExecutors: capability.requiredExecutors,
    optionalDependencies: capability.optionalDependencies
  }));
  return `${JSON.stringify({ generatedFrom: 'bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js', generatedArtifact: true, dependencies: stable(dependencies) }, null, 2)}\n`;
}

function buildCsv(capabilities) {
  const columns = [
    'capabilityId',
    'displayName',
    'domain',
    'lifecycleState',
    'enabled',
    'implementationStatus',
    'operationalStatus',
    'defaultExecutionStrategy',
    'allowedExecutionStrategies',
    'riskTier',
    'safetyImpact',
    'employmentImpact',
    'humanReviewRequired',
    'benchmarkStatus',
    'approvalStatus'
  ];
  const rows = [columns.join(',')];
  for (const capability of capabilities) {
    rows.push(columns.map((column) => csvEscape(capability[column])).join(','));
  }
  return `# ${generatedHeader}\n${rows.join('\n')}\n`;
}

function buildMarkdown(capabilities) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Enterprise Intelligence Capability Registry',
    '',
    '| Capability ID | Display Name | Domain | Lifecycle | Implementation | Operational | Default Strategy | Allowed Strategies | Risk | Safety | Employment | Human Review | Benchmark | Approval |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const capability of capabilities) {
    lines.push([
      capability.capabilityId,
      capability.displayName,
      capability.domain,
      capability.lifecycleState,
      capability.implementationStatus,
      capability.operationalStatus,
      capability.defaultExecutionStrategy,
      capability.allowedExecutionStrategies.join('<br>'),
      capability.riskTier,
      capability.safetyImpact,
      capability.employmentImpact,
      String(capability.humanReviewRequired),
      capability.benchmarkStatus,
      capability.approvalStatus
    ].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  return `${lines.join('\n')}\n`;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generate(options = {}) {
  const validation = registry.validateEnterpriseRegistry();
  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(`[capability-registry] ${error.capabilityId || 'registry'} ${error.field}: ${error.rule} - ${error.guidance}`);
    }
    process.exitCode = 1;
    return { changed: true, validation };
  }
  ensureDir();
  const capabilities = registry.listEnterpriseCapabilities().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const outputs = {
    'capability_registry.json': buildJson(capabilities),
    'capability_registry.csv': buildCsv(capabilities),
    'CAPABILITY_REGISTRY.md': buildMarkdown(capabilities),
    'capability_dependencies.json': buildDependencies(capabilities)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[capability-registry] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[capability-registry] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, validation };
}

if (require.main === module) {
  generate({ check: process.argv.includes('--check') });
}

module.exports = { generate };