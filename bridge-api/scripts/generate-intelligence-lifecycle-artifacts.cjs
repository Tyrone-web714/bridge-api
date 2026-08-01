#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const lifecycle = require('../services/intelligenceExecution/intelligenceLifecycleFramework');

const outDir = lifecycle.paths.generatedRoot;
const generatedHeader = 'Generated from bridge-api/intelligence-lifecycle-framework. Do not hand-edit.';

function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function json(value) { return `${JSON.stringify(lifecycle.stable(value), null, 2)}\n`; }
function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}
function summary(evidence, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Intelligence Lifecycle Summary',
    '',
    'Enterprise intelligence lifecycle artifacts are repository-only, deterministic, metadata-only, and test-only. They do not implement predictive models, prompts, provider calls, runtime execution, deployments, or migrations.',
    '',
    `- Schema version: ${lifecycle.LIFECYCLE_SCHEMA_VERSION}`,
    `- Engine version: ${lifecycle.LIFECYCLE_ENGINE_VERSION}`,
    `- Lifecycle records: ${evidence.lifecycleRecords.length}`,
    `- Maturity records: ${evidence.maturityMatrix.length}`,
    `- Readiness records: ${evidence.readinessMatrix.length}`,
    `- Learning policies: ${evidence.learningPolicies.length}`,
    `- Version records: ${evidence.versionEvolution.length}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`
  ].join('\n') + '\n';
}
function generate(options = {}) {
  ensureDir();
  const evidence = lifecycle.buildLifecycleEvidence();
  const validation = lifecycle.validateLifecycle(evidence);
  const outputs = {
    'intelligence_lifecycle_catalog.json': json({ generatedArtifact: true, catalog: evidence.catalog, lifecycleRecords: evidence.lifecycleRecords }),
    'maturity_matrix.json': json({ generatedArtifact: true, maturityMatrix: evidence.maturityMatrix }),
    'readiness_matrix.json': json({ generatedArtifact: true, readinessMatrix: evidence.readinessMatrix }),
    'validation_readiness.json': json({ generatedArtifact: true, validationReadiness: evidence.readinessMatrix.map((item) => ({ readinessId: item.readinessId, capabilityId: item.capabilityId, validationReadiness: item.validationReadiness })) }),
    'learning_policy_catalog.json': json({ generatedArtifact: true, learningPolicies: evidence.learningPolicies }),
    'version_evolution_catalog.json': json({ generatedArtifact: true, versionEvolution: evidence.versionEvolution }),
    'lifecycle_summary.md': summary(evidence, validation)
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[intelligence-lifecycle] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[intelligence-lifecycle] generated ${Object.keys(outputs).length} artifacts in docs/implementation/intelligence-lifecycle-framework/generated`);
  }
  return { changed, evidence, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
