#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cost = require('../services/intelligenceExecution/costGovernance');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(repoRoot, 'docs', 'implementation', 'cost-governance', 'generated');
const generatedFrom = 'bridge-api/cost-governance';
const generatedHeader = 'Generated from bridge-api/cost-governance. Do not hand-edit.';

function ensureDir() {
  fs.mkdirSync(outDir, { recursive: true });
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function catalogs() {
  return cost.loadPricingCatalogs();
}

function modelProfiles() {
  return cost.loadCostModelProfiles();
}

function budgetProfiles() {
  return cost.loadBudgetProfiles();
}

function runs() {
  return cost.runInitialCostGovernance().sort((a, b) => a.costGovernanceRequestId.localeCompare(b.costGovernanceRequestId));
}

function pricingCatalogSummary(catalog) {
  return {
    pricingCatalogId: catalog.pricingCatalogId,
    version: catalog.version,
    lifecycleState: catalog.lifecycleState,
    enabled: catalog.enabled,
    testOnly: catalog.testOnly,
    productionUseAllowed: catalog.productionUseAllowed,
    currency: catalog.currency,
    entryCount: catalog.entries.length,
    contentHash: cost.pricingCatalogHash(catalog)
  };
}

function costModelProfileSummary(profile) {
  return {
    costModelProfileId: profile.costModelProfileId,
    version: profile.version,
    testOnly: profile.testOnly,
    productionUseAllowed: profile.productionUseAllowed,
    fixedCostAllocationMethod: profile.fixedCostAllocationMethod,
    unknownCostPolicy: profile.unknownCostPolicy,
    contentHash: cost.costModelProfileHash(profile)
  };
}

function budgetProfileSummary(profile) {
  return {
    budgetProfileId: profile.budgetProfileId,
    version: profile.version,
    testOnly: profile.testOnly,
    productionEnforcementAllowed: profile.productionEnforcementAllowed,
    premiumExecutionAllowed: profile.premiumExecutionAllowed,
    warningThresholdPct: profile.warningThresholdPct,
    blockingThresholdPct: profile.blockingThresholdPct,
    contentHash: cost.budgetProfileHash(profile)
  };
}

function runSummary(run) {
  return {
    costGovernanceRequestId: run.costGovernanceRequestId,
    pricingCatalogId: run.pricingCatalogId,
    costModelProfileId: run.costModelProfileId,
    budgetProfileId: run.budgetProfileId,
    costRecordCount: run.costRecords.length,
    totalKnownCostMicroUsd: run.costRecords.reduce((sum, record) => sum + record.costSummary.totalKnownCostMicroUsd, 0),
    unknownCostRecordCount: run.costRecords.filter((record) => record.costSummary.unknownComponentCount > 0).length,
    simulatedBlockCount: run.costRecords.filter((record) => record.budgetEvaluation.status === 'SIMULATED_BLOCK').length,
    testOnly: run.testOnly,
    productionUseAllowed: run.productionUseAllowed,
    costGovernanceRunHash: run.costGovernanceRunHash
  };
}

function flattenRecords(allRuns) {
  return allRuns.flatMap((run) => run.costRecords.map((record) => ({ costGovernanceRequestId: run.costGovernanceRequestId, ...record })));
}

function buildIndexRecords(allRuns) {
  return flattenRecords(allRuns).map((record) => ({
    costRecordId: record.costRecordId,
    costGovernanceRequestId: record.costGovernanceRequestId,
    capabilityId: record.capabilityId,
    datasetId: record.datasetId,
    candidateStrategyId: record.candidateStrategyId,
    candidateExecutorId: record.candidateExecutorId,
    totalKnownCostMicroUsd: record.costSummary.totalKnownCostMicroUsd,
    costStatus: record.costSummary.status,
    unknownComponentCount: record.costSummary.unknownComponentCount,
    budgetStatus: record.budgetEvaluation.status,
    costRecordHash: record.costRecordHash
  }));
}

function buildComponentSummary(allRuns) {
  return flattenRecords(allRuns).flatMap((record) => record.costComponents.map((component) => ({
    costRecordId: record.costRecordId,
    capabilityId: record.capabilityId,
    componentType: component.componentType,
    componentCategory: component.componentCategory,
    sourceClass: component.sourceClass,
    amountMicroUsd: component.amountMicroUsd,
    status: component.status,
    usageQuantity: component.usageQuantity,
    usageUnit: component.usageUnit
  })));
}

function buildMetricSummary(allRuns) {
  return flattenRecords(allRuns).map((record) => ({
    costRecordId: record.costRecordId,
    capabilityId: record.capabilityId,
    costMetrics: record.costMetrics,
    costEffectivenessEvidence: record.costMetrics.costEffectivenessEvidence
  }));
}

function buildBudgetSummary(allRuns) {
  return flattenRecords(allRuns).map((record) => ({
    costRecordId: record.costRecordId,
    capabilityId: record.capabilityId,
    budgetEvaluation: record.budgetEvaluation
  }));
}

function buildCompleteness(allRuns) {
  return flattenRecords(allRuns).map((record) => ({
    costRecordId: record.costRecordId,
    capabilityId: record.capabilityId,
    completeness: record.completeness
  }));
}

function buildConfidence(allRuns) {
  return flattenRecords(allRuns).map((record) => ({
    costRecordId: record.costRecordId,
    capabilityId: record.capabilityId,
    confidence: record.confidence
  }));
}

function buildSummaryMd(allRuns) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Cost Governance Summary',
    '',
    'Cost-governance records are synthetic, offline, test-only evidence. They do not rank providers, declare best value, make procurement recommendations, enforce production budgets, or claim production savings.',
    '',
    '| Run | Catalog | Profile | Records | Known Micro-USD | Unknown Records | Simulated Blocks |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  ];
  for (const run of allRuns.map(runSummary)) {
    lines.push(`| ${run.costGovernanceRequestId} | ${run.pricingCatalogId} | ${run.costModelProfileId} | ${run.costRecordCount} | ${run.totalKnownCostMicroUsd} | ${run.unknownCostRecordCount} | ${run.simulatedBlockCount} |`);
  }
  return `${lines.join('\n')}\n`;
}

function buildRunCatalogMd(allRuns) {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Cost Governance Run Catalog',
    '',
    'Runs are simulation-only and do not perform runtime budget enforcement.',
    '',
    '| Run | Pricing Catalog | Budget Profile | Records | Production Use |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const run of allRuns.map(runSummary)) lines.push(`| ${run.costGovernanceRequestId} | ${run.pricingCatalogId} | ${run.budgetProfileId} | ${run.costRecordCount} | ${run.productionUseAllowed} |`);
  return `${lines.join('\n')}\n`;
}

function buildPricingCatalogMd() {
  const lines = [
    '<!-- ' + generatedHeader + ' -->',
    '# Pricing Catalog Index',
    '',
    'Catalogs are synthetic and test-only; no real provider pricing or contractual claim is represented.',
    '',
    '| Catalog | Version | Lifecycle | Currency | Entries | Production Use |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  for (const catalog of catalogs().map(pricingCatalogSummary)) lines.push(`| ${catalog.pricingCatalogId} | ${catalog.version} | ${catalog.lifecycleState} | ${catalog.currency} | ${catalog.entryCount} | ${catalog.productionUseAllowed} |`);
  return `${lines.join('\n')}\n`;
}

function writeIfChanged(fileName, content, options = {}) {
  const filePath = path.join(outDir, fileName);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function generate(options = {}) {
  ensureDir();
  const allRuns = runs();
  const outputs = {
    'pricing_catalog_index.json': json({ generatedFrom, generatedArtifact: true, pricingCatalogs: cost.stable(catalogs().map(pricingCatalogSummary)) }),
    'pricing_catalog_index.csv': ['# ' + generatedHeader, 'pricingCatalogId,version,lifecycleState,currency,entryCount,productionUseAllowed'].concat(catalogs().map(pricingCatalogSummary).map((item) => ['pricingCatalogId', 'version', 'lifecycleState', 'currency', 'entryCount', 'productionUseAllowed'].map((column) => csvEscape(item[column])).join(','))).join('\n') + '\n',
    'PRICING_CATALOG_INDEX.md': buildPricingCatalogMd(),
    'cost_model_profile_index.json': json({ generatedFrom, generatedArtifact: true, costModelProfiles: cost.stable(modelProfiles().map(costModelProfileSummary)) }),
    'budget_profile_index.json': json({ generatedFrom, generatedArtifact: true, budgetProfiles: cost.stable(budgetProfiles().map(budgetProfileSummary)) }),
    'cost_governance_run_catalog.json': json({ generatedFrom, generatedArtifact: true, costGovernanceRuns: cost.stable(allRuns.map(runSummary)) }),
    'cost_governance_run_catalog.csv': ['# ' + generatedHeader, 'costGovernanceRequestId,pricingCatalogId,costModelProfileId,budgetProfileId,costRecordCount,totalKnownCostMicroUsd,unknownCostRecordCount,simulatedBlockCount'].concat(allRuns.map(runSummary).map((item) => ['costGovernanceRequestId', 'pricingCatalogId', 'costModelProfileId', 'budgetProfileId', 'costRecordCount', 'totalKnownCostMicroUsd', 'unknownCostRecordCount', 'simulatedBlockCount'].map((column) => csvEscape(item[column])).join(','))).join('\n') + '\n',
    'COST_GOVERNANCE_RUN_CATALOG.md': buildRunCatalogMd(allRuns),
    'cost_record_index.json': json({ generatedFrom, generatedArtifact: true, costRecords: cost.stable(buildIndexRecords(allRuns)) }),
    'cost_component_summary.json': json({ generatedFrom, generatedArtifact: true, components: cost.stable(buildComponentSummary(allRuns)) }),
    'cost_metric_summary.json': json({ generatedFrom, generatedArtifact: true, metrics: cost.stable(buildMetricSummary(allRuns)) }),
    'cost_effectiveness_evidence.json': json({ generatedFrom, generatedArtifact: true, evidence: cost.stable(buildMetricSummary(allRuns).map((item) => ({ costRecordId: item.costRecordId, costEffectivenessEvidence: item.costEffectivenessEvidence, safetyCompliant: item.costMetrics.safetyCompliant, thresholdCompliant: item.costMetrics.thresholdCompliant }))) }),
    'budget_evaluation_summary.json': json({ generatedFrom, generatedArtifact: true, budgetEvaluations: cost.stable(buildBudgetSummary(allRuns)) }),
    'budget_warning_report.json': json({ generatedFrom, generatedArtifact: true, warnings: cost.stable(buildBudgetSummary(allRuns).filter((item) => ['WARNING', 'SOFT_LIMIT_EXCEEDED'].includes(item.budgetEvaluation.status))) }),
    'simulated_block_report.json': json({ generatedFrom, generatedArtifact: true, simulatedBlocks: cost.stable(buildBudgetSummary(allRuns).filter((item) => item.budgetEvaluation.status === 'SIMULATED_BLOCK')) }),
    'premium_restriction_report.json': json({ generatedFrom, generatedArtifact: true, premiumRestrictions: cost.stable(cost.listPremiumRestrictions().map((profile) => ({ budgetProfileId: profile.budgetProfileId, premiumExecutionAllowed: profile.premiumExecutionAllowed, premiumRequiresExplicitApproval: profile.premiumRequiresExplicitApproval }))) }),
    'unknown_cost_report.json': json({ generatedFrom, generatedArtifact: true, unknownCosts: cost.stable(buildIndexRecords(allRuns).filter((record) => record.unknownComponentCount > 0)) }),
    'cost_completeness_report.json': json({ generatedFrom, generatedArtifact: true, completeness: cost.stable(buildCompleteness(allRuns)) }),
    'cost_confidence_report.json': json({ generatedFrom, generatedArtifact: true, confidence: cost.stable(buildConfidence(allRuns)) }),
    'cost_sensitivity_report.json': json({ generatedFrom, generatedArtifact: true, sensitivity: cost.stable(allRuns.flatMap((run) => run.sensitivityAnalysis.map((item) => ({ costGovernanceRequestId: run.costGovernanceRequestId, ...item })))) }),
    'COST_GOVERNANCE_SUMMARY.md': buildSummaryMd(allRuns)
  };
  const changed = Object.entries(outputs).filter(([fileName, content]) => writeIfChanged(fileName, content, options)).map(([fileName]) => fileName);
  if (options.check && changed.length) {
    console.error(`[cost-governance] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[cost-governance] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, outDir)}`);
  }
  return { changed, runs: allRuns };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });

module.exports = { generate };
