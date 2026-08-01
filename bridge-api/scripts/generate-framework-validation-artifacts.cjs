#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const framework = require('../services/intelligenceExecution/frameworkValidation');

const outDir = framework.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/framework-validation. Do not hand-edit.';

function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function json(value) { return `${JSON.stringify(framework.stable(value), null, 2)}\n`; }
function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}
function platformSummary(result, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Platform Summary',
    '',
    'Framework validation is repository-only, deterministic, offline, provider-neutral, and test-only. It does not change runtime behavior, provider routing, decisions, governance, production data, deployments, migrations, or database state.',
    '',
    `- Schema version: ${framework.FRAMEWORK_VALIDATION_SCHEMA_VERSION}`,
    `- Engine version: ${framework.FRAMEWORK_VALIDATION_ENGINE_VERSION}`,
    `- Generated at: ${framework.DETERMINISTIC_GENERATED_AT}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    `- Subsystems: ${result.report.subsystemCount}`,
    `- Dashboards: ${result.report.dashboardCount}`,
    `- Graph hash: ${result.report.graphHash}`,
    '',
    '## Readiness',
    '',
    '| Area | Readiness |',
    '| --- | --- |',
    ...result.readiness.map((item) => `| ${item.area} | ${item.readiness} |`),
    '',
    '## Quality Scorecard',
    '',
    '| Area | Score |',
    '| --- | ---: |',
    ...result.scorecard.map((item) => `| ${item.area} | ${item.score} |`)
  ].join('\n') + '\n';
}
function buildOutputs(result, validation, determinism) {
  return {
    'enterprise_validation_report.json': json({ generatedArtifact: true, report: result.report, validation }),
    'integration_matrix.json': json({ generatedArtifact: true, integration: result.integration }),
    'subsystem_matrix.json': json({ generatedArtifact: true, subsystems: result.inventory }),
    'cross_reference_matrix.json': json({ generatedArtifact: true, crossReferences: result.crossReferences }),
    'coverage_matrix.json': json({ generatedArtifact: true, coverage: result.coverage }),
    'repository_health.json': json({ generatedArtifact: true, health: result.health }),
    'framework_readiness.json': json({ generatedArtifact: true, readiness: result.readiness }),
    'enterprise_quality_scorecard.json': json({ generatedArtifact: true, scorecard: result.scorecard }),
    'determinism_report.json': json({ generatedArtifact: true, determinism }),
    'documentation_integrity.json': json({ generatedArtifact: true, documentation: { documentationPages: result.health.totals.documentationPages, generatedArtifacts: result.health.totals.generatedArtifacts, coverage: result.coverage } }),
    'generated_artifact_integrity.json': json({ generatedArtifact: true, generatedArtifacts: { total: result.health.totals.generatedArtifacts, validationHash: result.report.validationHash } }),
    'platform_summary.md': platformSummary(result, validation)
  };
}
function generate(options = {}) {
  ensureDir();
  const result = options.result || framework.buildFrameworkValidation();
  const validation = framework.validateFramework(result);
  const determinism = framework.determinismReport(result, options.secondResult || framework.buildFrameworkValidation());
  const outputs = buildOutputs(result, validation, determinism);
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[framework-validation] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[framework-validation] generated ${Object.keys(outputs).length} artifacts in docs/implementation/framework-validation/generated`);
  }
  return { changed, result, validation, determinism };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
