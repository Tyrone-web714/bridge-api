#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cost = require('../services/intelligenceExecution/costGovernance');
const evaluationEngine = require('../services/intelligenceExecution/evaluationEngine');
const scoringEngine = require('../services/intelligenceExecution/scoringEngine');
const { generate } = require('./generate-cost-governance-artifacts.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const generatedDir = path.join(repoRoot, 'docs', 'implementation', 'cost-governance', 'generated');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCatalogInvalid(rule, mutate) {
  const catalog = clone(cost.getPricingCatalog('SYNTHETIC_TEST_PRICING_CATALOG', '0.1.0'));
  mutate(catalog);
  const validation = cost.validatePricingCatalog(catalog, [catalog]);
  assert.strictEqual(validation.valid, false, `expected invalid catalog for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function expectModelProfileInvalid(rule, mutate) {
  const profile = clone(cost.getCostModelProfile('DIRECT_EXECUTION_COST_TEST_PROFILE', '0.1.0'));
  mutate(profile);
  const validation = cost.validateCostModelProfile(profile, [profile]);
  assert.strictEqual(validation.valid, false, `expected invalid cost model profile for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function expectBudgetProfileInvalid(rule, mutate) {
  const profile = clone(cost.getBudgetProfile('SYNTHETIC_BUDGET_PROFILE', '0.1.0'));
  mutate(profile);
  const validation = cost.validateBudgetProfile(profile, [profile]);
  assert.strictEqual(validation.valid, false, `expected invalid budget profile for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function expectRequestInvalid(rule, mutate) {
  const request = clone(cost.getCostGovernanceRequest('cost.text_cleanup.initial.offline.v1'));
  mutate(request);
  const validation = cost.validateCostGovernanceRequest(request, [request]);
  assert.strictEqual(validation.valid, false, `expected invalid request for ${rule}`);
  assert.ok(validation.errors.some((error) => error.rule === rule), `expected ${rule}, got ${validation.errors.map((error) => error.rule).join(', ')}`);
}

function assertNoProhibitedOutput(value) {
  const text = JSON.stringify(value);
  assert.ok(!/"winner"\s*:/.test(text), 'cost output must not expose winner fields');
  assert.ok(!/"bestValue"\s*:/.test(text), 'cost output must not expose best-value fields');
  assert.ok(!/"recommendedStrategy"\s*:/.test(text), 'cost output must not expose recommended strategy fields');
  assert.ok(!/"procurementRecommendation"\s*:/.test(text), 'cost output must not expose procurement recommendation fields');
  assert.ok(!/"providerRanking"\s*:/.test(text), 'cost output must not expose provider ranking fields');
  assert.ok(!/"productionRecommendation"\s*:/.test(text), 'cost output must not expose production recommendation fields');
}

function readGenerated() {
  if (!fs.existsSync(generatedDir)) return [];
  return fs.readdirSync(generatedDir).sort().map((file) => [file, fs.readFileSync(path.join(generatedDir, file), 'utf8')]);
}

function main() {
  assert.strictEqual(cost.COST_GOVERNANCE_REQUEST_SCHEMA_VERSION, 'intelligence.cost.governance.request.v1');
  assert.strictEqual(cost.PRICING_CATALOG_SCHEMA_VERSION, 'intelligence.pricing.catalog.v1');
  assert.strictEqual(cost.COST_MODEL_PROFILE_SCHEMA_VERSION, 'intelligence.cost.model.profile.v1');
  assert.strictEqual(cost.BUDGET_PROFILE_SCHEMA_VERSION, 'intelligence.budget.profile.v1');
  assert.strictEqual(cost.COST_RECORD_SCHEMA_VERSION, 'intelligence.cost.record.v1');

  assert.strictEqual(cost.parseUsdToMicros('1.000001'), 1000001n);
  assert.strictEqual(cost.microsToUsdString(1000001n), '1.000001');
  assert.strictEqual(cost.multiplyMicroUsd(2n, 3), 6n);
  assert.throws(() => cost.multiplyMicroUsd(1n, -1), /nonnegative integer/);

  const catalogs = cost.loadPricingCatalogs();
  assert.strictEqual(catalogs.length, 1);
  for (const catalog of catalogs) {
    const validation = cost.validatePricingCatalog(catalog);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(catalog.testOnly, true);
    assert.strictEqual(catalog.productionUseAllowed, false);
    assert.strictEqual(catalog.currency, 'USD');
    assert.ok(catalog.entries.every((entry) => Number.isInteger(entry.priceMicroUsd)));
    assert.ok(catalog.entries.some((entry) => entry.priceMicroUsd === 0));
    assert.ok(catalog.entries.some((entry) => entry.sourceClass === 'MOCK'));
  }
  {
    const catalog = clone(cost.getPricingCatalog('SYNTHETIC_TEST_PRICING_CATALOG', '0.1.0'));
    const validation = cost.validatePricingCatalog(catalog, [catalog, clone(catalog)]);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some((error) => error.rule === 'DUPLICATE_CATALOG_ID_VERSION'));
  }
  expectCatalogInvalid('INVALID_LIFECYCLE', (catalog) => { catalog.lifecycleState = 'ACTIVE'; });
  expectCatalogInvalid('INVALID_CURRENCY', (catalog) => { catalog.currency = 'EUR'; });
  expectCatalogInvalid('NEGATIVE_PRICE_WITHOUT_CREDIT_TYPE', (catalog) => { catalog.entries[0].priceMicroUsd = -1; });
  expectCatalogInvalid('INCOMPATIBLE_UNIT', (catalog) => { catalog.entries[0].unitType = 'BANANA'; });
  expectCatalogInvalid('OVERLAPPING_TIER_RANGE', (catalog) => { catalog.entries.push({ ...clone(catalog.entries[0]), pricingEntryId: 'duplicate.range' }); });
  expectCatalogInvalid('CONTRACTUAL_WITHOUT_EVIDENCE', (catalog) => { catalog.entries[0].sourceClass = 'CONTRACTUAL'; });
  expectCatalogInvalid('PRODUCTION_APPROVED_SYNTHETIC_CATALOG', (catalog) => { catalog.productionUseAllowed = true; });

  const modelProfiles = cost.loadCostModelProfiles();
  assert.strictEqual(modelProfiles.length, 3);
  for (const profile of modelProfiles) {
    const validation = cost.validateCostModelProfile(profile);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(profile.testOnly, true);
    assert.strictEqual(profile.productionUseAllowed, false);
  }
  expectModelProfileInvalid('UNSUPPORTED_ALLOCATION_METHOD', (profile) => { profile.fixedCostAllocationMethod = 'MAGIC'; });
  expectModelProfileInvalid('INCOMPATIBLE_WORKLOAD_DENOMINATOR', (profile) => { profile.workloadDenominator = 'REQUESTISH'; });
  expectModelProfileInvalid('UNKNOWN_COST_POLICY_MISSING', (profile) => { delete profile.unknownCostPolicy; });
  expectModelProfileInvalid('CONTRADICTORY_RETRY_TREATMENT', (profile) => { profile.preventRetryDoubleCount = false; });
  expectModelProfileInvalid('INVALID_ROUNDING_MODE', (profile) => { profile.roundingMode = 'FLOAT'; });
  expectModelProfileInvalid('MIXED_CURRENCY', (profile) => { profile.currency = 'EUR'; });

  const budgetProfiles = cost.loadBudgetProfiles();
  assert.strictEqual(budgetProfiles.length, 2);
  for (const profile of budgetProfiles) {
    const validation = cost.validateBudgetProfile(profile);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(profile.productionEnforcementAllowed, false);
    assert.strictEqual(profile.premiumExecutionAllowed, false);
    assert.strictEqual(profile.safetyOverrideAllowed, false);
  }
  expectBudgetProfileInvalid('NEGATIVE_BUDGET_LIMIT', (profile) => { profile.limitMicroUsd = -1; });
  expectBudgetProfileInvalid('SOFT_LIMIT_GREATER_THAN_HARD_LIMIT', (profile) => { profile.softLimitMicroUsd = profile.hardLimitMicroUsd + 1; });
  expectBudgetProfileInvalid('WARNING_THRESHOLD_GREATER_THAN_BLOCKING_THRESHOLD', (profile) => { profile.warningThresholdPct = 99; profile.blockingThresholdPct = 50; });
  expectBudgetProfileInvalid('PRODUCTION_ENFORCEMENT_PROHIBITED', (profile) => { profile.productionEnforcementAllowed = true; });
  expectBudgetProfileInvalid('SAFETY_OVERRIDE_ALLOWED', (profile) => { profile.safetyOverrideAllowed = true; });
  expectBudgetProfileInvalid('INVENTED_OWNER_APPROVAL', (profile) => { profile.approvedBy = 'owner'; });

  const requests = cost.loadCostGovernanceRequests();
  assert.strictEqual(requests.length, 3);
  for (const request of requests) {
    const validation = cost.validateCostGovernanceRequest(request);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(request.dryRun, true);
    assert.strictEqual(request.simulationOnly, true);
    assert.strictEqual(request.livePricingLookup, false);
    assert.strictEqual(request.productionEnforcementRequested, false);
  }
  expectRequestInvalid('UNKNOWN_EVALUATION_RUN', (request) => { request.evaluationRunIds = ['eval.missing']; });
  expectRequestInvalid('UNKNOWN_SCORE_RUN', (request) => { request.scoreRunIds = ['score.missing']; });
  expectRequestInvalid('UNKNOWN_PRICING_CATALOG', (request) => { request.pricingCatalogId = 'MISSING'; });
  expectRequestInvalid('UNKNOWN_BUDGET_PROFILE', (request) => { request.budgetProfileId = 'MISSING'; });
  expectRequestInvalid('NEGATIVE_BUDGET', (request) => { request.simulatedBudgetAmountMicroUsd = -1; });
  expectRequestInvalid('INVALID_THRESHOLD_OVERRIDE', (request) => { request.warningThresholdOverride = 101; });
  expectRequestInvalid('CONTRADICTORY_CONTROL_FLAGS', (request) => { request.allowUnknownCosts = false; request.failOnUnknownRequiredCost = false; });
  expectRequestInvalid('LIVE_PRICING_REQUEST_PROHIBITED', (request) => { request.livePricingLookup = true; });
  expectRequestInvalid('PRODUCTION_ENFORCEMENT_REQUEST_PROHIBITED', (request) => { request.productionEnforcementRequested = true; });

  assert.ok(evaluationEngine.validateEvaluationRun(evaluationEngine.runEvaluation('eval.text.cleanup.core.offline.v1')).valid);
  assert.ok(scoringEngine.validateScoreRun(scoringEngine.calculateScoreRun('score.structured_output.initial.offline.v1')).valid);

  const runs = cost.runInitialCostGovernance();
  assert.strictEqual(runs.length, 3);
  for (const run of runs) {
    const validation = cost.validateCostGovernanceRun(run);
    assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors, null, 2));
    assert.strictEqual(run.testOnly, true);
    assert.strictEqual(run.productionUseAllowed, false);
    assert.ok(run.costRecords.length > 0);
    assert.ok(run.aggregates.caseCosts.length > 0);
    assert.ok(run.aggregates.datasetCosts.length > 0);
    assert.ok(run.aggregates.capabilityCosts.length > 0);
    assert.ok(run.aggregates.candidateCosts.length > 0);
    assert.ok(run.aggregates.evaluationRunCosts.length > 0);
    assert.ok(run.sensitivityAnalysis.length > 0);
    assert.strictEqual(run.budgetExhaustionSimulation.runtimeBlocked, false);
    assertNoProhibitedOutput(run);
  }

  const records = runs.flatMap((run) => run.costRecords);
  assert.ok(records.some((record) => record.costComponents.some((component) => component.componentType === 'REQUEST_FEE')));
  assert.ok(records.some((record) => record.costComponents.some((component) => component.componentType === 'INPUT_TOKEN' || component.componentType === 'OUTPUT_TOKEN')));
  assert.ok(records.some((record) => record.costComponents.some((component) => component.componentType === 'RETRY')));
  assert.ok(records.some((record) => record.costComponents.some((component) => component.componentType === 'LOCAL_COMPUTE')));
  assert.ok(records.some((record) => record.costComponents.some((component) => component.amountMicroUsd === 0)));
  assert.ok(records.some((record) => record.costSummary.unknownComponentCount > 0));
  assert.ok(records.some((record) => record.costMetrics.costPerValidResultMicroUsd === null));
  assert.ok(records.some((record) => record.budgetEvaluation.status === 'UNKNOWN_COST_FAIL_CLOSED' || record.budgetEvaluation.status === 'SIMULATED_BLOCK' || record.budgetEvaluation.status === 'WARNING'));
  assert.ok(records.every((record) => record.budgetEvaluation.simulatedRuntimeBlock === false));
  assert.ok(records.every((record) => record.costRecordHash === cost.costRecordHash({ ...record, costRecordHash: undefined })));
  assert.ok(cost.listUnknownCostRecords().length > 0);
  assert.ok(cost.listEstimatedCostRecords().length > 0);
  assert.ok(cost.listIncompleteCostRecords().length > 0);
  assert.ok(cost.listPremiumRestrictions().length > 0);
  assert.ok(cost.compareCostRuns(runs[0], cost.calculateCostGovernanceRun(runs[0].costGovernanceRequestId)).equal);
  assert.ok(cost.comparePricingCatalogs(cost.getPricingCatalog('SYNTHETIC_TEST_PRICING_CATALOG'), cost.getPricingCatalog('SYNTHETIC_TEST_PRICING_CATALOG')).equal);
  assert.ok(cost.compareBudgetProfiles(cost.getBudgetProfile('SYNTHETIC_BUDGET_PROFILE'), cost.getBudgetProfile('SYNTHETIC_BUDGET_PROFILE')).equal);
  assert.ok(cost.inspectCostTrace(records[0].costRecordId));
  assert.ok(cost.inspectBudgetTrace(records[0].costRecordId));

  const mutated = clone(runs[0]);
  mutated.costRecords[0].costComponents[0].amountMicroUsd = 123456;
  mutated.costRecords[0].costRecordHash = cost.costRecordHash({ ...mutated.costRecords[0], costRecordHash: undefined });
  mutated.costGovernanceRunHash = cost.costGovernanceRunHash({ ...mutated, costGovernanceRunHash: undefined });
  assert.strictEqual(cost.validateCostGovernanceRun(mutated).valid, false);

  const prohibited = clone(runs[0]);
  prohibited.costRecords[0].bestValue = true;
  prohibited.costRecords[0].costRecordHash = cost.costRecordHash({ ...prohibited.costRecords[0], costRecordHash: undefined });
  prohibited.costGovernanceRunHash = cost.costGovernanceRunHash({ ...prohibited, costGovernanceRunHash: undefined });
  assert.strictEqual(cost.validateCostGovernanceRun(prohibited).valid, false);

  const before = readGenerated();
  const result = generate({ check: true });
  assert.deepStrictEqual(result.changed, []);
  assert.deepStrictEqual(readGenerated(), before);

  console.log('[test:cost-governance] catalogs, profiles, budgets, requests, micro-USD arithmetic, cost records, budget simulations, sensitivity, artifacts, and safety boundaries verified.');
}

main();
