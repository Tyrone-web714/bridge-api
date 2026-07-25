#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const scoring = require('../services/intelligenceExecution/scoringEngine');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'scoring-engine', 'generated');
const generatedFrom = 'bridge-api/scoring';
const generatedHeader = 'Generated from bridge-api/scoring. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function profiles() {
  return scoring.loadScoringProfiles();
}

function runs() {
  return scoring.runInitialScoring().sort((a, b) => a.scoringRequestId.localeCompare(b.scoringRequestId));
}

function profileSummary(profile) {
  return {
    scoringProfileId: profile.scoringProfileId,
    version: profile.version,
    lifecycleState: profile.lifecycleState,
    enabled: profile.enabled,
    testOnly: profile.testOnly,
    productionUseAllowed: profile.productionUseAllowed,
    compositeMethod: profile.compositeMethod,
    dimensionCount: profile.dimensions.length,
    dimensionWeightTotal: profile.dimensionWeightTotal,
    contentHash: scoring.profileHash(profile)
  };
}

function buildProfileCatalogJson() {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, profiles: scoring.stable(profiles().map(profileSummary)) }, null, 2)}\n`;
}

function buildProfileCatalogCsv() {
  const columns = ['scoringProfileId', 'version', 'lifecycleState', 'enabled', 'testOnly', 'productionUseAllowed', 'compositeMethod', 'dimensionCount', 'dimensionWeightTotal', 'contentHash'];
  const rows = [`# ${generatedHeader}`, columns.join(',')];
  for (const profile of profiles().map(profileSummary)) rows.push(columns.map((column) => csvEscape(profile[column])).join(','));
  return `${rows.join('\n')}\n`;
}

function buildProfileCatalogMd() {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Scoring Profile Catalog',
    '',
    'Profiles are test-only and are not production-approved scoring policy.',
    '',
    '| Profile | Version | Lifecycle | Enabled | Composite Method | Dimensions | Production Use |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const profile of profiles().map(profileSummary)) {
    lines.push(`| ${profile.scoringProfileId} | ${profile.version} | ${profile.lifecycleState} | ${profile.enabled} | ${profile.compositeMethod} | ${profile.dimensionCount} | ${profile.productionUseAllowed} |`);
  }
  return `${lines.join('\n')}\n`;
}

function runSummary(run) {
  return {
    scoringRequestId: run.scoringRequestId,
    scoringProfileId: run.scoringProfileId,
    scoringProfileVersion: run.scoringProfileVersion,
    sourceEvaluationRunIds: run.sourceEvaluationRunIds,
    scoreRecordCount: run.scoreRecords.length,
    totalObservations: run.totalObservations,
    gateFailureCount: run.gateOutcomes.length,
    thresholdRecordCount: run.thresholdOutcomes.length,
    testOnly: run.testOnly,
    productionUseAllowed: run.productionUseAllowed,
    scoreRunHash: run.scoreRunHash
  };
}

function buildScoreRunCatalogJson(allRuns) {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, scoreRuns: scoring.stable(allRuns.map(runSummary)) }, null, 2)}\n`;
}

function buildScoreRunCatalogCsv(allRuns) {
  const columns = ['scoringRequestId', 'scoringProfileId', 'scoringProfileVersion', 'scoreRecordCount', 'totalObservations', 'gateFailureCount', 'testOnly', 'productionUseAllowed', 'scoreRunHash'];
  const rows = [`# ${generatedHeader}`, columns.join(',')];
  for (const run of allRuns.map(runSummary)) rows.push(columns.map((column) => csvEscape(run[column])).join(','));
  return `${rows.join('\n')}\n`;
}

function buildScoreRunCatalogMd(allRuns) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Score Run Catalog',
    '',
    'Score runs are synthetic, offline, and test-only. They do not select strategies or make production recommendations.',
    '',
    '| Score Run | Profile | Records | Observations | Gate Findings | Production Use |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  for (const run of allRuns.map(runSummary)) lines.push(`| ${run.scoringRequestId} | ${run.scoringProfileId}@${run.scoringProfileVersion} | ${run.scoreRecordCount} | ${run.totalObservations} | ${run.gateFailureCount} | ${run.productionUseAllowed} |`);
  return `${lines.join('\n')}\n`;
}

function flattenRecords(allRuns) {
  return allRuns.flatMap((run) => run.scoreRecords.map((record) => ({ scoringRequestId: run.scoringRequestId, ...record })));
}

function indexRecords(allRuns, fields) {
  return flattenRecords(allRuns).map((record) => {
    const item = {
      scoreId: record.scoreId,
      scoringRequestId: record.scoringRequestId,
      scoringProfileId: record.scoringProfileId,
      capabilityId: record.capabilityId,
      datasetId: record.datasetId,
      caseId: record.caseId,
      candidateId: record.candidateId,
      candidateStrategyId: record.candidateStrategyId,
      candidateExecutorId: record.candidateExecutorId,
      compositeScore: record.compositeScore.gateAdjustedComposite,
      validity: record.validity,
      completenessStatus: record.completeness.status,
      confidenceStatus: record.confidence.status,
      scoreHash: record.scoreHash
    };
    return Object.fromEntries(Object.entries(item).filter(([key]) => fields.includes(key)));
  });
}

function buildFindings(allRuns, type) {
  if (type === 'gates') return allRuns.flatMap((run) => run.gateOutcomes.map((finding) => ({ scoringRequestId: run.scoringRequestId, ...finding })));
  if (type === 'thresholds') return allRuns.flatMap((run) => run.thresholdOutcomes.map((finding) => ({ scoringRequestId: run.scoringRequestId, ...finding }))).filter((item) => item.status !== 'MET' && item.status !== 'NOT_APPLICABLE');
  if (type === 'completeness') return flattenRecords(allRuns).map((record) => ({ scoringRequestId: record.scoringRequestId, scoreId: record.scoreId, completeness: record.completeness }));
  if (type === 'confidence') return flattenRecords(allRuns).map((record) => ({ scoringRequestId: record.scoringRequestId, scoreId: record.scoreId, confidence: record.confidence }));
  if (type === 'sensitivity') return allRuns.flatMap((run) => run.sensitivityAnalysis.map((item) => ({ scoringRequestId: run.scoringRequestId, ...item })));
  return [];
}

function buildScoreSummaryMd(allRuns) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Score Summary',
    '',
    'Scores are benchmark evidence records only. They do not rank providers, rank models, declare a preferred strategy, calculate cost effectiveness, TCO, or ROI, or claim production readiness.',
    '',
    '| Score Run | Profile | Mean Composite | Gate Findings | Incomplete Scores | Low Confidence Scores |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  for (const run of allRuns) {
    const values = run.scoreRecords.map((record) => record.compositeScore.gateAdjustedComposite).filter((value) => value !== null);
    const stats = scoring.describeNumbers(values);
    lines.push(`| ${run.scoringRequestId} | ${run.scoringProfileId} | ${stats.mean ?? 'UNKNOWN'} | ${run.gateOutcomes.length} | ${run.scoreRecords.filter((record) => record.completeness.status !== 'COMPLETE').length} | ${run.scoreRecords.filter((record) => ['LOW', 'INSUFFICIENT'].includes(record.confidence.status)).length} |`);
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
  ensureDir();
  const allRuns = runs();
  const fields = ['scoreId', 'scoringRequestId', 'scoringProfileId', 'capabilityId', 'datasetId', 'caseId', 'candidateId', 'candidateStrategyId', 'candidateExecutorId', 'compositeScore', 'validity', 'completenessStatus', 'confidenceStatus', 'scoreHash'];
  const outputs = {
    'scoring_profile_catalog.json': buildProfileCatalogJson(),
    'scoring_profile_catalog.csv': buildProfileCatalogCsv(),
    'SCORING_PROFILE_CATALOG.md': buildProfileCatalogMd(),
    'score_run_catalog.json': buildScoreRunCatalogJson(allRuns),
    'score_run_catalog.csv': buildScoreRunCatalogCsv(allRuns),
    'SCORE_RUN_CATALOG.md': buildScoreRunCatalogMd(allRuns),
    'case_score_index.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, scores: scoring.stable(indexRecords(allRuns, fields)) }, null, 2)}\n`,
    'dataset_score_index.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, scores: scoring.stable(allRuns.flatMap((run) => run.aggregates.datasetScores)) }, null, 2)}\n`,
    'capability_score_index.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, scores: scoring.stable(allRuns.flatMap((run) => run.aggregates.capabilityScores)) }, null, 2)}\n`,
    'candidate_score_index.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, scores: scoring.stable(allRuns.flatMap((run) => run.aggregates.candidateScores)) }, null, 2)}\n`,
    'scoring_gate_findings.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, findings: scoring.stable(buildFindings(allRuns, 'gates')) }, null, 2)}\n`,
    'scoring_threshold_findings.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, findings: scoring.stable(buildFindings(allRuns, 'thresholds')) }, null, 2)}\n`,
    'scoring_completeness_report.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, completeness: scoring.stable(buildFindings(allRuns, 'completeness')) }, null, 2)}\n`,
    'scoring_confidence_report.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, confidence: scoring.stable(buildFindings(allRuns, 'confidence')) }, null, 2)}\n`,
    'scoring_sensitivity_report.json': `${JSON.stringify({ generatedFrom, generatedArtifact: true, sensitivity: scoring.stable(buildFindings(allRuns, 'sensitivity')) }, null, 2)}\n`,
    'SCORE_SUMMARY.md': buildScoreSummaryMd(allRuns)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[scoring-engine] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[scoring-engine] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, runs: allRuns };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });

module.exports = { generate };
