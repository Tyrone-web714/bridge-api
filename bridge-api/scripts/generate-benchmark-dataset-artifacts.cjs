#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const framework = require('../services/intelligenceExecution/benchmarkDatasetFramework');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'benchmark-dataset-framework', 'generated');
const generatedFrom = 'bridge-api/benchmarks/datasets';
const generatedHeader = 'Generated from bridge-api/benchmarks/datasets. Do not hand-edit.';

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function datasetSummary(dataset) {
  const coverage = new Set(dataset.coveredScenarioCategories || []);
  const required = new Set(dataset.requiredScenarioCategories || []);
  return {
    datasetId: dataset.datasetId,
    version: dataset.version,
    displayName: dataset.displayName,
    capabilityId: dataset.capabilityId,
    lifecycleState: dataset.lifecycleState,
    enabled: dataset.enabled,
    approvalStatus: dataset.approvalStatus,
    sourceType: dataset.sourceType,
    dataClassification: dataset.dataClassification,
    caseCount: dataset.caseCount,
    evaluationTypes: dataset.evaluationType || [],
    riskCoverage: dataset.riskTierCoverage || [],
    privacyIndicators: {
      containsPersonalData: dataset.containsPersonalData,
      containsSensitivePersonalData: dataset.containsSensitivePersonalData,
      containsEmployeeData: dataset.containsEmployeeData,
      containsCustomerData: dataset.containsCustomerData,
      containsPreciseLocationData: dataset.containsPreciseLocationData,
      productionDataUsed: dataset.productionDataUsed
    },
    allowedEnvironments: dataset.allowedEnvironments || [],
    benchmarkReadiness: dataset.lifecycleState === framework.DATASET_LIFECYCLE_STATES.BENCHMARK_READY ? 'BENCHMARK_READY' : 'NOT_READY',
    knownLimitations: dataset.knownLimitations || [],
    missingCoverage: [...required].filter((category) => !coverage.has(category)).sort(),
    contentHash: framework.computeManifestHash(dataset)
  };
}

function buildCatalogJson(datasets) {
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, datasets: framework.stable(datasets.map(datasetSummary)) }, null, 2)}\n`;
}

function buildCatalogCsv(datasets) {
  const columns = ['datasetId', 'version', 'capabilityId', 'lifecycleState', 'approvalStatus', 'sourceType', 'dataClassification', 'caseCount', 'evaluationTypes', 'riskCoverage', 'allowedEnvironments', 'benchmarkReadiness', 'missingCoverage'];
  const rows = [`# ${generatedHeader}`, columns.join(',')];
  for (const dataset of datasets.map(datasetSummary)) {
    rows.push(columns.map((column) => csvEscape(dataset[column])).join(','));
  }
  return `${rows.join('\n')}\n`;
}

function buildCatalogMd(datasets) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Benchmark Dataset Catalog',
    '',
    '| Dataset ID | Version | Capability | Lifecycle | Approval | Source | Classification | Cases | Evaluation Types | Readiness | Missing Coverage |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const dataset of datasets.map(datasetSummary)) {
    lines.push([
      dataset.datasetId,
      dataset.version,
      dataset.capabilityId,
      dataset.lifecycleState,
      dataset.approvalStatus,
      dataset.sourceType,
      dataset.dataClassification,
      dataset.caseCount,
      dataset.evaluationTypes.join('<br>'),
      dataset.benchmarkReadiness,
      dataset.missingCoverage.join('<br>') || 'none'
    ].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  return `${lines.join('\n')}\n`;
}

function buildCaseIndex(datasets) {
  const cases = [];
  for (const dataset of datasets) {
    for (const testCase of dataset.cases || []) {
      cases.push({
        datasetId: dataset.datasetId,
        datasetVersion: dataset.version,
        caseId: testCase.caseId,
        caseVersion: testCase.caseVersion,
        capabilityId: testCase.capabilityId,
        lifecycleState: testCase.lifecycleState,
        enabled: testCase.enabled,
        benchmarkEligible: testCase.benchmarkEligible,
        testOnly: testCase.testOnly,
        evaluationTypes: testCase.evaluationTypes || [],
        riskTier: testCase.riskTier,
        coverageCategories: testCase.coverageCategories || [],
        contentHash: framework.computeCaseHash(testCase)
      });
    }
  }
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, cases: framework.stable(cases) }, null, 2)}\n`;
}

function buildCoverageJson(datasets) {
  return `${JSON.stringify(framework.stable(framework.summarizeCoverage(datasets)), null, 2)}\n`;
}

function buildCoverageMd(datasets) {
  const coverage = framework.summarizeCoverage(datasets).reports;
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Benchmark Coverage Report',
    '',
    'Coverage reports scenario presence only. Thresholds and benchmark-readiness scores remain owner decisions.',
    '',
    '| Dataset ID | Version | Capability | Required Categories | Covered Categories | Missing Categories | Threshold Decision |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const report of coverage) {
    lines.push([
      report.datasetId,
      report.version,
      report.capabilityId,
      report.requiredScenarioCategories.join('<br>'),
      report.coveredScenarioCategories.join('<br>'),
      report.missingScenarioCategories.join('<br>') || 'none',
      report.thresholdDecision
    ].map((value) => String(value).replace(/\|/g, '\\|')).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  return `${lines.join('\n')}\n`;
}

function buildDependencies(datasets) {
  const dependencies = datasets.map((dataset) => ({
    datasetId: dataset.datasetId,
    version: dataset.version,
    capabilityId: dataset.capabilityId,
    supportedCapabilityVersions: dataset.supportedCapabilityVersions || [],
    inputSchemaId: dataset.inputSchemaId,
    outputSchemaId: dataset.outputSchemaId,
    promptVersionCompatibility: dataset.promptVersionCompatibility || [],
    policyVersionCompatibility: dataset.policyVersionCompatibility || [],
    executorVersionCompatibility: dataset.executorVersionCompatibility || [],
    sourceFiles: dataset.sourceFiles || []
  }));
  return `${JSON.stringify({ generatedFrom, generatedArtifact: true, dependencies: framework.stable(dependencies) }, null, 2)}\n`;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function generate(options = {}) {
  const validation = framework.validateDatasets();
  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(`[benchmark-datasets] ${error.datasetId || 'dataset'} ${error.caseId || ''} ${error.field}: ${error.rule} - ${error.guidance}`);
    }
    process.exitCode = 1;
    return { changed: true, validation };
  }
  ensureDir();
  const datasets = framework.listDatasets();
  const outputs = {
    'benchmark_dataset_catalog.json': buildCatalogJson(datasets),
    'benchmark_dataset_catalog.csv': buildCatalogCsv(datasets),
    'BENCHMARK_DATASET_CATALOG.md': buildCatalogMd(datasets),
    'benchmark_case_index.json': buildCaseIndex(datasets),
    'benchmark_coverage_report.json': buildCoverageJson(datasets),
    'BENCHMARK_COVERAGE_REPORT.md': buildCoverageMd(datasets),
    'benchmark_dataset_dependencies.json': buildDependencies(datasets)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[benchmark-datasets] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[benchmark-datasets] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, validation };
}

if (require.main === module) {
  generate({ check: process.argv.includes('--check') });
}

module.exports = { generate };
