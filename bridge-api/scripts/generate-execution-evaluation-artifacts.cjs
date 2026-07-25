#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const engine = require('../services/intelligenceExecution/evaluationEngine');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'execution-strategy-evaluation-engine', 'generated');
const generatedFrom = 'bridge-api/evaluations';
const generatedHeader = 'Generated from bridge-api/evaluations. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function allRuns() {
  return engine.runInitialEvaluations().sort((a, b) => a.runId.localeCompare(b.runId));
}

function flattenResults(runs) {
  return runs.flatMap((run) => run.results.map((result) => ({
    runId: run.runId,
    capabilityId: run.capabilityId,
    datasetId: run.datasetId,
    caseId: result.caseId,
    candidateId: result.candidateId,
    strategy: result.strategy,
    executorId: result.executorId,
    resultClass: result.resultClass,
    executed: result.executed,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    costKnowledgeStatus: result.cost?.knowledgeStatus || 'UNKNOWN'
  })));
}

function flattenObservations(runs) {
  return runs.flatMap((run) => run.results.flatMap((result) => result.observations.map((observation) => ({
    runId: run.runId,
    capabilityId: run.capabilityId,
    datasetId: run.datasetId,
    resultId: result.resultId,
    caseId: result.caseId,
    candidateId: result.candidateId,
    strategy: result.strategy,
    executorId: result.executorId,
    resultClass: result.resultClass,
    observationId: observation.observationId,
    assertionId: observation.assertionId,
    evaluationType: observation.evaluationType,
    domain: observation.domain,
    outcome: observation.outcome,
    severity: observation.severity,
    matched: observation.matched,
    observationHash: observation.observationHash
  }))));
}

function buildCatalogJson(runs) {
  const catalog = runs.map((run) => ({
    runId: run.runId,
    runVersion: run.runVersion,
    engineVersion: run.engineVersion,
    repositoryCommit: run.repositoryCommit,
    capabilityId: run.capabilityId,
    datasetId: run.datasetId,
    datasetVersion: run.datasetVersion,
    environment: run.environment,
    testOnly: run.testOnly,
    offlineOnly: run.offlineOnly,
    productionDataUsed: run.productionDataUsed,
    requestHash: run.requestHash,
    planHash: run.planHash,
    resultHash: run.resultHash,
    replayable: run.replay?.replayable === true,
    resultClasses: run.aggregates.resultClasses
  }));
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, runs: engine.stable(catalog) }, null, 2)}\n`;
}

function buildCatalogCsv(runs) {
  const columns = ['runId', 'capabilityId', 'datasetId', 'datasetVersion', 'environment', 'offlineOnly', 'productionDataUsed', 'replayable', 'resultHash'];
  const rows = [`# ${generatedHeader}`, columns.join(',')];
  for (const run of runs) {
    rows.push(columns.map((column) => csvEscape(column === 'replayable' ? run.replay?.replayable : run[column])).join(','));
  }
  return `${rows.join('\n')}\n`;
}

function buildCatalogMd(runs) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Evaluation Run Catalog',
    '',
    'All listed runs are synthetic, repository-based, offline/mock-only evaluation runs. This catalog does not rank strategies or recommend production routing.',
    '',
    '| Run ID | Capability | Dataset | Offline | Production Data | Replayable | Result Classes |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const run of runs) {
    lines.push([
      run.runId,
      run.capabilityId,
      run.datasetId,
      run.offlineOnly,
      run.productionDataUsed,
      run.replay?.replayable === true,
      Object.entries(run.aggregates.resultClasses).map(([key, value]) => `${key}:${value}`).join('<br>')
    ].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  return `${lines.join('\n')}\n`;
}

function buildObservationIndex(runs) {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, observations: engine.stable(flattenObservations(runs)) }, null, 2)}\n`;
}

function buildOutcomeSummary(runs) {
  const summary = {
    generatedFrom,
    generatedArtifact: true,
    note: 'Descriptive counts only; no scores, weights, winners, rankings, or recommendations.',
    runs: runs.map((run) => ({
      runId: run.runId,
      capabilityId: run.capabilityId,
      datasetId: run.datasetId,
      aggregates: run.aggregates
    }))
  };
  return `${JSON.stringify(engine.stable(summary), null, 2)}\n`;
}

function buildOutcomeSummaryMd(runs) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Evaluation Outcome Summary',
    '',
    'Counts are descriptive observations only. No weighted score, best strategy, model ranking, provider ranking, or production recommendation is produced.',
    '',
    '| Run ID | Cases Completed | Unauthorized Candidates | Timeouts | Schema Failures | Safety Failures | Policy Failures | Unknown Cost Observations |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const run of runs) {
    lines.push([
      run.runId,
      run.aggregates.casesCompleted,
      run.aggregates.candidatesUnauthorized,
      run.aggregates.timeouts,
      run.aggregates.schemaFailures,
      run.aggregates.safetyFailures,
      run.aggregates.policyFailures,
      run.aggregates.unknownCostObservations
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  return `${lines.join('\n')}\n`;
}

function filterObservations(runs, domain) {
  return flattenObservations(runs).filter((item) => item.domain === domain && item.outcome === 'FAILED');
}

function buildExecutionMetrics(runs) {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, metrics: engine.stable(flattenResults(runs).map((result) => ({
    runId: result.runId,
    caseId: result.caseId,
    candidateId: result.candidateId,
    strategy: result.strategy,
    executorId: result.executorId,
    resultClass: result.resultClass,
    durationMs: result.durationMs,
    timedOut: result.timedOut
  }))) }, null, 2)}\n`;
}

function buildCostObservations(runs) {
  const observations = runs.flatMap((run) => run.results.map((result) => ({
    runId: run.runId,
    resultId: result.resultId,
    candidateId: result.candidateId,
    strategy: result.strategy,
    executorId: result.executorId,
    cost: result.cost
  })));
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, costObservations: engine.stable(observations) }, null, 2)}\n`;
}

function buildReplayReport(runs) {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, replay: engine.stable(runs.map((run) => ({
    runId: run.runId,
    requestHash: run.requestHash,
    planHash: run.planHash,
    resultHash: run.resultHash,
    replayable: run.replay?.replayable === true,
    deterministicReplayClaimed: run.replay?.deterministicReplayClaimed === true,
    nonReproducibleReasons: run.replay?.nonReproducibleReasons || []
  }))) }, null, 2)}\n`;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generate(options = {}) {
  ensureDir();
  const runs = allRuns();
  const outputs = {
    'evaluation_run_catalog.json': buildCatalogJson(runs),
    'evaluation_run_catalog.csv': buildCatalogCsv(runs),
    'EVALUATION_RUN_CATALOG.md': buildCatalogMd(runs),
    'evaluation_observation_index.json': buildObservationIndex(runs),
    'evaluation_outcome_summary.json': buildOutcomeSummary(runs),
    'EVALUATION_OUTCOME_SUMMARY.md': buildOutcomeSummaryMd(runs),
    'evaluation_safety_findings.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, findings: engine.stable(filterObservations(runs, 'SAFETY')) }, null, 2)}\n`,
    'evaluation_policy_findings.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, findings: engine.stable(filterObservations(runs, 'POLICY')) }, null, 2)}\n`,
    'evaluation_privacy_findings.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, findings: engine.stable(filterObservations(runs, 'PRIVACY')) }, null, 2)}\n`,
    'evaluation_execution_metrics.json': buildExecutionMetrics(runs),
    'evaluation_cost_observations.json': buildCostObservations(runs),
    'evaluation_replay_report.json': buildReplayReport(runs)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[evaluation-engine] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[evaluation-engine] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, runs };
}

if (require.main === module) {
  generate({ check: process.argv.includes('--check') });
}

module.exports = { generate };
