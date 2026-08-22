#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildFramework } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');
const { buildCandidateSelection } = require('./generate-ms003-candidate-selection-artifacts.cjs');
const { buildBenchmarkEvidence, paths: ms004Paths } = require('./generate-ms004-benchmark-artifacts.cjs');
const { buildMs004CandidateExpansion } = require('./ms004-candidate-expansion.cjs');
const {
  buildBenchmarkRequest,
  executeBenchmarkProviderRequest,
  getBenchmarkAdapterCatalog,
  getHostedAdapterCatalog,
  normalizeBenchmarkFailure
} = require('../services/intelligenceExecution/providerAdapters');

const BENCHMARK_BUDGET_CEILING_USD = 10;
const D2_HOSTED_REPETITIONS = 2;
const RUN_SCHEMA_VERSION = 'ms004.live.benchmark.run.v1';
const LIVE_RESULTS_FILE = path.join(ms004Paths.generatedRoot, 'ms004_live_run_evidence.json');
const LIVE_RESULTS_REPORT = path.join(ms004Paths.docsRoot, 'MS004_LIVE_RUN_RESULTS.json');
const FAILURE_CLASSIFICATIONS = Object.freeze({
  RETRYABLE_TRANSIENT: 'RETRYABLE_TRANSIENT',
  CONFIGURATION_OR_ADAPTER_DEFECT: 'CONFIGURATION_OR_ADAPTER_DEFECT',
  MODEL_OR_ENDPOINT_UNAVAILABLE: 'MODEL_OR_ENDPOINT_UNAVAILABLE',
  AUTHORIZATION_OR_ACCOUNT_BLOCKER: 'AUTHORIZATION_OR_ACCOUNT_BLOCKER',
  NON_RETRYABLE_PROVIDER_RESPONSE: 'NON_RETRYABLE_PROVIDER_RESPONSE',
  UNKNOWN_REQUIRES_REVIEW: 'UNKNOWN_REQUIRES_REVIEW'
});
const SECRET_PATTERNS = [
  /sk-[a-z0-9]{12,}/i,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["']?[^"',\s}]+/i
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function providerKey(provider) {
  return String(provider || '').toLowerCase();
}

function containsSecretLikeValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(stable(value));
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function parseOutput(output) {
  if (output && typeof output === 'object') return output;
  if (typeof output === 'string') {
    const trimmed = output.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return { summary_or_explanation: trimmed, raw_text: trimmed };
    }
  }
  return output === undefined ? null : output;
}

function flatten(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function costForUsage(candidate, usage) {
  const inputTokens = Number(usage?.inputTokens || 0);
  const outputTokens = Number(usage?.outputTokens || 0);
  if (inputTokens || outputTokens) {
    const input = Number(candidate.inputPrice || 0) * inputTokens / 1_000_000;
    const output = Number(candidate.outputPrice || 0) * outputTokens / 1_000_000;
    return Number((input + output).toFixed(8));
  }
  return Number(candidate.estimatedCostScenario?.estimatedCostPerInvocationUsd || 0);
}

function loadLivePlan(env = process.env) {
  const ms002 = buildFramework();
  const ms003 = buildCandidateSelection();
  const ms004Expansion = buildMs004CandidateExpansion();
  const dryRunEvidence = buildBenchmarkEvidence();
  const adapterCatalog = getBenchmarkAdapterCatalog(env);
  const capabilities = new Map(ms002.benchmarkCandidates.map((capability) => [capability.capabilityId, capability]));
  const d2Capabilities = ms002.benchmarkCandidates.filter((capability) => capability.executionClass === 'D2');
  const d2CapabilityIds = new Set(d2Capabilities.map((capability) => capability.capabilityId));
  const datasets = dryRunEvidence.frozenBenchmarkDatasets.filter((dataset) => dataset.executionClass === 'D2' && dataset.status === 'BENCHMARK_DATASET_READY');
  const datasetByCapability = new Map(datasets.map((dataset) => [dataset.capabilityId, dataset]));
  const candidates = [...ms003.candidates, ...ms004Expansion.candidates]
    .filter((candidate) => candidate.candidateType === 'HOSTED_MODEL' && d2CapabilityIds.has(candidate.capabilityId))
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  return {
    ms002,
    ms003,
    ms004Expansion,
    dryRunEvidence,
    adapterCatalog,
    capabilities,
    d2Capabilities,
    datasets,
    datasetByCapability,
    candidates
  };
}

function parseFilters(argv = process.argv.slice(2)) {
  const filters = {};
  for (const arg of argv) {
    if (arg.startsWith('--provider=')) filters.provider = providerKey(arg.slice('--provider='.length));
    if (arg.startsWith('--capability=')) filters.capability = arg.slice('--capability='.length);
    if (arg.startsWith('--candidate=')) filters.candidate = arg.slice('--candidate='.length);
    if (arg === '--rerun-hard-gate-failures') filters.rerunHardGateFailures = true;
  }
  return filters;
}

function candidateMatchesFilters(candidate, filters = {}) {
  if (filters.provider && providerKey(candidate.provider) !== filters.provider) return false;
  if (filters.capability && candidate.capabilityId !== filters.capability) return false;
  if (filters.candidate && candidate.candidateId !== filters.candidate) return false;
  return true;
}

function configurationHashFor(record) {
  return record.configurationHash || sha({
    provider: providerKey(record.provider),
    model: record.model || record.officialModelId,
    candidateId: record.candidateId
  });
}

function benchmarkIdentity(record) {
  return [
    record.capabilityId,
    record.candidateId,
    record.datasetVersionHash,
    record.caseId,
    configurationHashFor(record),
    record.repetitionNumber
  ].join('|');
}

function plannedBenchmarkItems(plan, filters = {}) {
  const items = [];
  for (const candidate of plan.candidates.filter((item) => candidateMatchesFilters(item, filters))) {
    const capability = plan.capabilities.get(candidate.capabilityId);
    const dataset = plan.datasetByCapability.get(candidate.capabilityId);
    if (!capability || !dataset) continue;
    const configurationHash = configurationHashFor({
      provider: providerKey(candidate.provider),
      model: candidate.officialModelId,
      candidateId: candidate.candidateId
    });
    for (const datasetCase of dataset.cases) {
      for (let repetition = 1; repetition <= D2_HOSTED_REPETITIONS; repetition += 1) {
        items.push({ candidate, capability, dataset, datasetCase, repetition, configurationHash });
      }
    }
  }
  return items;
}

function classifyFailure(record) {
  const error = record?.error || {};
  const status = Number(error.providerStatus || error.status || error.httpStatus || record?.providerStatus || record?.httpStatus || 0);
  const code = String(error.code || error.type || error.name || record?.errorCode || '').toLowerCase();
  const message = String(error.message || record?.errorMessage || '').toLowerCase();
  if (status === 401 || status === 403 || /auth|permission|forbidden|unauthori[sz]ed|account|quota_block|billing|credit|balance/.test(code) || /billing|credit balance|purchase credits|too low to access|payment|account/.test(message)) return FAILURE_CLASSIFICATIONS.AUTHORIZATION_OR_ACCOUNT_BLOCKER;
  if (status === 404 || status === 410 || /model_not_found|not_found|unsupported_model|endpoint/.test(code)) return FAILURE_CLASSIFICATIONS.MODEL_OR_ENDPOINT_UNAVAILABLE;
  if (status === 400 || status === 422 || /invalid_request|invalid_argument|schema|response_format|adapter|configuration/.test(code)) return FAILURE_CLASSIFICATIONS.CONFIGURATION_OR_ADAPTER_DEFECT;
  if (status === 429 || status >= 500 || error.retryable === true || /resource_exhausted|rate_limit|timeout|temporar|unavailable/.test(code)) return FAILURE_CLASSIFICATIONS.RETRYABLE_TRANSIENT;
  if (status >= 400 && status < 500) return FAILURE_CLASSIFICATIONS.NON_RETRYABLE_PROVIDER_RESPONSE;
  return FAILURE_CLASSIFICATIONS.UNKNOWN_REQUIRES_REVIEW;
}

function isRetryableFailure(record) {
  const classification = classifyFailure(record);
  return classification === FAILURE_CLASSIFICATIONS.RETRYABLE_TRANSIENT || classification === FAILURE_CLASSIFICATIONS.AUTHORIZATION_OR_ACCOUNT_BLOCKER;
}

function loadExistingLiveEvidence(filePath = LIVE_RESULTS_REPORT) {
  if (!fs.existsSync(filePath)) return null;
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (evidence.runType !== 'LIVE_HOSTED') throw new Error(`Existing MS-004 evidence is not LIVE_HOSTED: ${filePath}`);
  return evidence;
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function summarizeFailures(results) {
  const summary = {};
  for (const result of results.filter((item) => item.status === 'FAILED')) {
    const error = result.error || {};
    const key = [
      result.provider || 'UNKNOWN',
      result.model || 'UNKNOWN',
      result.capabilityId || 'UNKNOWN',
      error.providerStatus || error.status || error.httpStatus || 'NO_STATUS',
      error.code || error.type || error.name || 'UNKNOWN',
      classifyFailure(result),
      isRetryableFailure(result) ? 'retryable' : 'not_retryable'
    ].join('|');
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

function refreshRunSummary(run) {
  const completed = run.results.filter((result) => result.status === 'COMPLETED');
  const failed = run.results.filter((result) => result.status === 'FAILED');
  const measuredCostFromRecords = Number(run.results.reduce((sum, result) => sum + Number(result.costUsd || 0), 0).toFixed(8));
  const resumedSpend = Number((Number(run.resumeBaselineSpendUsd || 0) + Number(run.resumeAdditionalSpendUsd || 0)).toFixed(8));
  run.summary = {
    attemptedCalls: run.results.filter((result) => result.runEvidenceType === 'LIVE_HOSTED' && !String(result.status).includes('NOT_EXECUTED')).length,
    completedCalls: completed.length,
    failedCalls: failed.length,
    retries: run.results.reduce((sum, result) => sum + Number(result.retryCount || 0), 0),
    hardGateFailures: run.results.filter((result) => result.hardGateResult === 'RUN_FAIL_HARD_GATE').length,
    measuredTotalBenchmarkCostUsd: Number(Math.max(measuredCostFromRecords, resumedSpend).toFixed(8)),
    budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
    winnersProposed: Array.isArray(run.winners) ? run.winners.length : 0,
    noCandidatePassed: Array.isArray(run.noCandidatePassed) ? run.noCandidatePassed.length : 0,
    insufficientComparativeEvidence: Array.isArray(run.insufficientComparativeEvidence) ? run.insufficientComparativeEvidence.length : 0,
    productionActivation: 0
  };
  run.runHash = sha({ ...run, runHash: null });
  return run;
}

function checkpointRun(run, options = {}) {
  refreshRunSummary(run);
  if (containsSecretLikeValue(run)) throw new Error('MS-004 live run evidence contains secret-like content; refusing to persist.');
  if (options.persist === false) return;
  atomicWriteJson(options.liveResultsFile || LIVE_RESULTS_FILE, run);
  atomicWriteJson(options.liveResultsReport || LIVE_RESULTS_REPORT, run);
}

function validatePrepare(plan, env = process.env) {
  const failures = [];
  const providerStatus = plan.adapterCatalog.map((adapter) => ({
    provider: adapter.provider,
    status: adapter.status,
    configured: adapter.configured,
    credentialEnvironmentVariable: adapter.credentialEnvironmentVariable,
    productionRoutingEnabled: adapter.productionRoutingEnabled
  }));
  if (plan.d2Capabilities.length !== 9) failures.push('D2_CAPABILITY_COUNT');
  if (plan.datasets.length !== 9) failures.push('D2_DATASET_READY_COUNT');
  if (plan.candidates.length !== 34) failures.push('MS004_HOSTED_CANDIDATE_COUNT');
  if (plan.dryRunEvidence.summary.projectedBenchmarkCostRangeUsd.highEstimateUsd > BENCHMARK_BUDGET_CEILING_USD) failures.push('BUDGET_FORECAST_EXCEEDS_10_USD');
  if (getHostedAdapterCatalog().some((adapter) => adapter.supportedCapabilities.includes('customer.account_guidance.presentation'))) failures.push('PRODUCTION_PROVIDER_ROUTING_MODIFIED');
  for (const adapter of plan.adapterCatalog) {
    if (adapter.productionRoutingEnabled === true) failures.push(`PRODUCTION_ROUTING:${adapter.provider}`);
    if (!env[adapter.credentialEnvironmentVariable]) failures.push(`MISSING_CREDENTIAL:${adapter.provider}`);
  }
  for (const candidate of plan.candidates) {
    const capability = plan.capabilities.get(candidate.capabilityId);
    const dataset = plan.datasetByCapability.get(candidate.capabilityId);
    if (!capability || capability.executionClass !== 'D2') failures.push(`NON_D2_CANDIDATE:${candidate.candidateId}`);
    if (!dataset?.datasetHash) failures.push(`MISSING_DATASET_HASH:${candidate.capabilityId}`);
    const adapter = plan.adapterCatalog.find((item) => item.provider === providerKey(candidate.provider));
    if (!adapter?.supportedModelIds.includes(candidate.officialModelId)) failures.push(`MODEL_NOT_SUPPORTED:${candidate.candidateId}`);
    if (!adapter?.supportedCapabilities.includes(candidate.capabilityId)) failures.push(`CAPABILITY_NOT_SUPPORTED:${candidate.candidateId}`);
  }
  return {
    ready: failures.length === 0,
    failures,
    providerStatus,
    d2DatasetCount: plan.datasets.length,
    hostedCandidateCount: plan.candidates.length,
    highProjectedCostUsd: plan.dryRunEvidence.summary.projectedBenchmarkCostRangeUsd.highEstimateUsd,
    productionActivation: false,
    hostedCallsExecuted: false
  };
}

function evaluateHardGates({ capability, datasetCase, normalized }) {
  const output = parseOutput(normalized.output);
  const text = flatten(output).toLowerCase();
  const required = capability.expectedOutputContract?.requiredProperties || [];
  const missing = output && typeof output === 'object'
    ? required.filter((field) => output[field] === undefined && !(field === 'summary_or_explanation' && (output.summary || output.explanation || output.raw_text)))
    : required;
  const failures = [];
  if (missing.length) failures.push(`missing_required_output:${missing.join(',')}`);
  if (/ignore route rule|override deterministic|production certified|provider selected|model selected/i.test(text)) failures.push('prohibited_authority_or_selection_claim');
  if (containsSecretLikeValue(output)) failures.push('secret_like_output');
  for (const assertion of datasetCase.hardGateAssertions || []) {
    if (assertion === 'no_fabricated_evidence' && /as a fact|definitely|guaranteed/.test(text) && datasetCase.expectedResult?.expectedRefusalOrUncertainty) failures.push('unsafe_certainty_from_insufficient_evidence');
    if (assertion === 'no_cross_organization_disclosure' && /other organization|another tenant|different customer tenant/.test(text)) failures.push('cross_organization_disclosure');
  }
  return {
    passed: failures.length === 0,
    failures,
    hardGateResult: failures.length ? 'RUN_FAIL_HARD_GATE' : 'PASS'
  };
}

function scoreOutput(hardGate) {
  if (!hardGate.passed) return {
    qualityScore: 0,
    eligibilityResult: 'DISQUALIFIED',
    candidatePassed: false
  };
  return {
    qualityScore: 80,
    eligibilityResult: 'PASSED',
    candidatePassed: true
  };
}

async function executeWithRetry(request, context, options = {}) {
  const maxRetries = options.maxRetries ?? 1;
  let attempt = 0;
  while (true) {
    try {
      const response = await (options.invoke || executeBenchmarkProviderRequest)(request, options);
      return { response, retryCount: attempt };
    } catch (error) {
      const retryable = error?.retryable === true;
      if (!retryable || attempt >= maxRetries) {
        return {
          response: normalizeBenchmarkFailure(request.provider, error, attempt),
          retryCount: attempt
        };
      }
      attempt += 1;
    }
  }
}

async function runLiveBenchmarks(options = {}) {
  const env = options.env || process.env;
  const plan = loadLivePlan(env);
  const prepare = validatePrepare(plan, env);
  if (!prepare.ready) {
    const error = new Error(`MS-004 live benchmark preflight failed: ${prepare.failures.join(', ')}`);
    error.code = 'MS004_PREFLIGHT_FAILED';
    error.preflight = prepare;
    throw error;
  }

  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: `ms004.live.${new Date().toISOString().replace(/[:.]/g, '-')}`,
    runType: 'LIVE_HOSTED',
    createdAt: new Date().toISOString(),
    budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
    productionActivation: false,
    productionRoutingEnabled: false,
    providerSelectionPerformed: false,
    modelSelectionPerformed: false,
    d1FinalSelectionPerformed: false,
    results: [],
    winners: [],
    noCandidatePassed: [],
    insufficientComparativeEvidence: [],
    summary: {}
  };
  let cumulativeCostUsd = 0;

  for (const candidate of plan.candidates) {
    const capability = plan.capabilities.get(candidate.capabilityId);
    const dataset = plan.datasetByCapability.get(candidate.capabilityId);
    const configurationHash = configurationHashFor({
      provider: providerKey(candidate.provider),
      model: candidate.officialModelId,
      candidateId: candidate.candidateId
    });
    for (const datasetCase of dataset.cases) {
      for (let repetition = 1; repetition <= D2_HOSTED_REPETITIONS; repetition += 1) {
        const estimatedCost = Number(candidate.estimatedCostScenario?.estimatedCostPerInvocationUsd || 0);
        if (cumulativeCostUsd + estimatedCost > BENCHMARK_BUDGET_CEILING_USD) {
          run.results.push({
            runEvidenceType: 'LIVE_HOSTED',
            status: 'NOT_EXECUTED_BUDGET_CEILING',
            capabilityId: candidate.capabilityId,
            candidateId: candidate.candidateId,
            provider: providerKey(candidate.provider),
            model: candidate.officialModelId,
            datasetId: dataset.datasetId,
            datasetVersionHash: dataset.datasetHash,
            configurationHash,
            caseId: datasetCase.caseId,
            repetitionNumber: repetition,
            costUsd: 0,
            productionActivation: false
          });
          continue;
        }
        const request = buildBenchmarkRequest(candidate, capability, datasetCase, env);
        const startedAtMs = Date.now();
        const { response, retryCount } = await executeWithRetry(request, { candidate, capability, dataset, datasetCase }, options);
        const hardGate = response.status === 'SUCCEEDED'
          ? evaluateHardGates({ capability, datasetCase, normalized: response })
          : { passed: false, failures: [response.error?.code || 'PROVIDER_FAILURE'], hardGateResult: 'PROVIDER_FAILURE' };
        const score = response.status === 'SUCCEEDED' ? scoreOutput(hardGate) : { qualityScore: 0, eligibilityResult: 'FAILED', candidatePassed: false };
        const measuredCost = response.status === 'SUCCEEDED' ? costForUsage(candidate, response.usage) : 0;
        cumulativeCostUsd = Number((cumulativeCostUsd + measuredCost).toFixed(8));
        run.results.push({
          benchmarkRunId: `ms004.live.${candidate.capabilityId}.${candidate.officialModelId}.${datasetCase.caseId}.r${repetition}`,
          runEvidenceType: 'LIVE_HOSTED',
          capabilityId: candidate.capabilityId,
          candidateId: candidate.candidateId,
          provider: providerKey(candidate.provider),
          model: candidate.officialModelId,
          datasetId: dataset.datasetId,
          datasetVersionHash: dataset.datasetHash,
          configurationHash,
          caseId: datasetCase.caseId,
          repetitionNumber: repetition,
          status: response.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED',
          hostedBenchmarkExecuted: response.status === 'SUCCEEDED',
          localBenchmarkExecuted: false,
          latencyMs: response.latencyMs ?? Math.max(0, Date.now() - startedAtMs),
          usage: response.usage,
          retryCount,
          costUsd: measuredCost,
          cumulativeCostUsd,
          outputHash: response.status === 'SUCCEEDED' ? sha(response.output) : null,
          hardGateResult: hardGate.hardGateResult,
          hardGateFailures: hardGate.failures,
          qualityScore: score.qualityScore,
          eligibilityResult: score.eligibilityResult,
          candidatePassed: score.candidatePassed,
          providerRequestId: response.providerRequestId || null,
          simulatedHostedOutputPresentedAsReal: false,
          productionActivation: false,
          providerSelected: false,
          modelSelected: false,
          error: response.status === 'FAILED' ? response.error : null
        });
      }
    }
  }

  const completed = run.results.filter((result) => result.status === 'COMPLETED');
  const failed = run.results.filter((result) => result.status === 'FAILED');
  const passedByCapability = new Map();
  for (const result of completed.filter((item) => item.candidatePassed)) {
    if (!passedByCapability.has(result.capabilityId)) passedByCapability.set(result.capabilityId, []);
    passedByCapability.get(result.capabilityId).push(result);
  }
  for (const capability of plan.d2Capabilities) {
    const passed = passedByCapability.get(capability.capabilityId) || [];
    const attempted = run.results.filter((result) => result.capabilityId === capability.capabilityId && result.hostedBenchmarkExecuted);
    if (!attempted.length) {
      run.insufficientComparativeEvidence.push({ capabilityId: capability.capabilityId, reason: 'No live hosted candidate completed.' });
      continue;
    }
    if (!passed.length) {
      run.noCandidatePassed.push({ capabilityId: capability.capabilityId, reason: 'Candidates executed but none passed hard gates.' });
      continue;
    }
    const byCandidate = [...new Map(passed.map((result) => [result.candidateId, result])).values()];
    if (byCandidate.length < 2) {
      run.insufficientComparativeEvidence.push({ capabilityId: capability.capabilityId, reason: 'Fewer than two passing live hosted candidates completed.' });
      continue;
    }
    const winner = byCandidate.slice().sort((a, b) => (a.costUsd - b.costUsd) || (b.qualityScore - a.qualityScore) || a.candidateId.localeCompare(b.candidateId))[0];
    run.winners.push({
      capabilityId: capability.capabilityId,
      proposedWinner: winner.candidateId,
      provider: winner.provider,
      model: winner.model,
      winnerType: 'PROPOSED_OWNER_REVIEW_REQUIRED',
      selectedWinner: false,
      productionActivation: false,
      premiumRequired: /gpt-5$|sonnet/i.test(winner.model) ? 'PREMIUM_REQUIRES_OWNER_REVIEW' : 'PREMIUM_NOT_REQUIRED_BY_CURRENT_EVIDENCE'
    });
  }

  run.summary = {
    attemptedCalls: run.results.filter((result) => result.runEvidenceType === 'LIVE_HOSTED' && !result.status.includes('NOT_EXECUTED')).length,
    completedCalls: completed.length,
    failedCalls: failed.length,
    retries: run.results.reduce((sum, result) => sum + Number(result.retryCount || 0), 0),
    hardGateFailures: run.results.filter((result) => result.hardGateResult === 'RUN_FAIL_HARD_GATE').length,
    measuredTotalBenchmarkCostUsd: cumulativeCostUsd,
    budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
    winnersProposed: run.winners.length,
    noCandidatePassed: run.noCandidatePassed.length,
    insufficientComparativeEvidence: run.insufficientComparativeEvidence.length,
    productionActivation: 0
  };
  run.runHash = sha({ ...run, runHash: null });
  if (containsSecretLikeValue(run)) throw new Error('MS-004 live run evidence contains secret-like content; refusing to persist.');
  if (options.persist !== false) {
    fs.mkdirSync(ms004Paths.generatedRoot, { recursive: true });
    fs.writeFileSync(LIVE_RESULTS_FILE, `${JSON.stringify(stable(run), null, 2)}\n`, 'utf8');
    fs.writeFileSync(LIVE_RESULTS_REPORT, `${JSON.stringify(stable(run), null, 2)}\n`, 'utf8');
  }
  return run;
}

function createResumeRun(existingEvidence = null) {
  const existing = existingEvidence || {};
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: existing.runId || `ms004.live.${new Date().toISOString().replace(/[:.]/g, '-')}`,
    runType: 'LIVE_HOSTED',
    createdAt: existing.createdAt || new Date().toISOString(),
    resumedAt: new Date().toISOString(),
    budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
    productionActivation: false,
    productionRoutingEnabled: false,
    providerSelectionPerformed: false,
    modelSelectionPerformed: false,
    d1FinalSelectionPerformed: false,
    results: Array.isArray(existing.results) ? existing.results.slice() : [],
    supersededFailures: Array.isArray(existing.supersededFailures) ? existing.supersededFailures.slice() : [],
    supersededHardGateFailures: Array.isArray(existing.supersededHardGateFailures) ? existing.supersededHardGateFailures.slice() : [],
    winners: Array.isArray(existing.winners) ? existing.winners.slice() : [],
    noCandidatePassed: Array.isArray(existing.noCandidatePassed) ? existing.noCandidatePassed.slice() : [],
    insufficientComparativeEvidence: Array.isArray(existing.insufficientComparativeEvidence) ? existing.insufficientComparativeEvidence.slice() : [],
    resumeBaselineSpendUsd: Number(existing.summary?.measuredTotalBenchmarkCostUsd || 0),
    resumeAdditionalSpendUsd: 0,
    failureSummary: {},
    summary: existing.summary || {}
  };
}

async function resumeLiveBenchmarks(options = {}) {
  const env = options.env || process.env;
  const filters = options.filters || {};
  const plan = loadLivePlan(env);
  const prepare = validatePrepare(plan, env);
  if (!prepare.ready) {
    const error = new Error(`MS-004 live benchmark preflight failed: ${prepare.failures.join(', ')}`);
    error.code = 'MS004_PREFLIGHT_FAILED';
    error.preflight = prepare;
    throw error;
  }

  const existingEvidence = options.existingEvidence !== undefined
    ? options.existingEvidence
    : loadExistingLiveEvidence(options.liveResultsReport || LIVE_RESULTS_REPORT);
  const run = createResumeRun(existingEvidence);
  if (!Array.isArray(run.supersededHardGateFailures)) run.supersededHardGateFailures = [];
  const rerunHardGateFailures = options.rerunHardGateFailures === true || filters.rerunHardGateFailures === true;
  const completedByIdentity = new Map();
  const completedHardGateFailureByIdentity = new Map();
  const failedByIdentity = new Map();
  for (const result of run.results) {
    const identity = benchmarkIdentity(result);
    if (result.status === 'COMPLETED' && result.runEvidenceType === 'LIVE_HOSTED' && result.hostedBenchmarkExecuted === true) {
      if (rerunHardGateFailures && result.hardGateResult === 'RUN_FAIL_HARD_GATE') completedHardGateFailureByIdentity.set(identity, result);
      else completedByIdentity.set(identity, result);
    }
    if (result.status === 'FAILED') failedByIdentity.set(identity, result);
  }

  const items = plannedBenchmarkItems(plan, filters);
  let skippedCompleted = 0;
  let skippedNonRetryable = 0;
  let retryableFailed = 0;
  let pending = 0;
  const existingCompleted = completedByIdentity.size;
  const existingFailed = run.results.filter((result) => result.status === 'FAILED').length;
  let cumulativeCostUsd = Number((existingEvidence?.summary?.measuredTotalBenchmarkCostUsd ?? run.results.reduce((sum, result) => sum + Number(result.costUsd || 0), 0)).toFixed(8));

  for (const item of items) {
    const planned = {
      capabilityId: item.candidate.capabilityId,
      candidateId: item.candidate.candidateId,
      provider: providerKey(item.candidate.provider),
      model: item.candidate.officialModelId,
      datasetVersionHash: item.dataset.datasetHash,
      caseId: item.datasetCase.caseId,
      configurationHash: item.configurationHash,
      repetitionNumber: item.repetition
    };
    const identity = benchmarkIdentity(planned);
    if (completedByIdentity.has(identity)) {
      skippedCompleted += 1;
      continue;
    }
    const priorFailure = failedByIdentity.get(identity);
    const priorHardGateFailure = completedHardGateFailureByIdentity.get(identity);
    if (priorHardGateFailure) {
      pending += 1;
      continue;
    }
    if (priorFailure && !isRetryableFailure(priorFailure)) {
      skippedNonRetryable += 1;
      continue;
    }
    if (priorFailure) retryableFailed += 1;
    pending += 1;
  }

  console.log(`[ms004:resume] existingCompleted=${existingCompleted} existingFailed=${existingFailed} currentSpendUsd=${cumulativeCostUsd} pending=${pending} skippedCompleted=${skippedCompleted}`);

  for (const item of items) {
    const planned = {
      capabilityId: item.candidate.capabilityId,
      candidateId: item.candidate.candidateId,
      provider: providerKey(item.candidate.provider),
      model: item.candidate.officialModelId,
      datasetVersionHash: item.dataset.datasetHash,
      caseId: item.datasetCase.caseId,
      configurationHash: item.configurationHash,
      repetitionNumber: item.repetition
    };
    const identity = benchmarkIdentity(planned);
    if (completedByIdentity.has(identity)) continue;
    const priorFailure = failedByIdentity.get(identity);
    const priorHardGateFailure = completedHardGateFailureByIdentity.get(identity);
    if (priorFailure && !isRetryableFailure(priorFailure)) continue;

    const estimatedCost = Number(item.candidate.estimatedCostScenario?.estimatedCostPerInvocationUsd || 0);
    if (cumulativeCostUsd + estimatedCost > BENCHMARK_BUDGET_CEILING_USD) {
      run.results.push({
        benchmarkRunId: `ms004.live.${item.candidate.capabilityId}.${item.candidate.officialModelId}.${item.datasetCase.caseId}.r${item.repetition}`,
        runEvidenceType: 'LIVE_HOSTED',
        ...planned,
        datasetId: item.dataset.datasetId,
        status: 'NOT_EXECUTED_BUDGET_CEILING',
        costUsd: 0,
        productionActivation: false
      });
      checkpointRun(run, options);
      console.log(`[ms004:resume] provider=${planned.provider} capability=${planned.capabilityId} status=NOT_EXECUTED_BUDGET_CEILING cumulativeSpendUsd=${cumulativeCostUsd}`);
      continue;
    }

    const request = buildBenchmarkRequest(item.candidate, item.capability, item.datasetCase, env);
    const startedAtMs = Date.now();
    const { response, retryCount } = await executeWithRetry(request, item, options);
    const hardGate = response.status === 'SUCCEEDED'
      ? evaluateHardGates({ capability: item.capability, datasetCase: item.datasetCase, normalized: response })
      : { passed: false, failures: [response.error?.code || 'PROVIDER_FAILURE'], hardGateResult: 'PROVIDER_FAILURE' };
    const score = response.status === 'SUCCEEDED' ? scoreOutput(hardGate) : { qualityScore: 0, eligibilityResult: 'FAILED', candidatePassed: false };
    const measuredCost = response.status === 'SUCCEEDED' ? costForUsage(item.candidate, response.usage) : 0;
    cumulativeCostUsd = Number((cumulativeCostUsd + measuredCost).toFixed(8));
    run.resumeAdditionalSpendUsd = Number((Number(run.resumeAdditionalSpendUsd || 0) + measuredCost).toFixed(8));
    const result = {
      benchmarkRunId: `ms004.live.${item.candidate.capabilityId}.${item.candidate.officialModelId}.${item.datasetCase.caseId}.r${item.repetition}`,
      runEvidenceType: 'LIVE_HOSTED',
      ...planned,
      datasetId: item.dataset.datasetId,
      status: response.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED',
      hostedBenchmarkExecuted: response.status === 'SUCCEEDED',
      localBenchmarkExecuted: false,
      latencyMs: response.latencyMs ?? Math.max(0, Date.now() - startedAtMs),
      usage: response.usage,
      retryCount,
      costUsd: measuredCost,
      cumulativeCostUsd,
      outputHash: response.status === 'SUCCEEDED' ? sha(response.output) : null,
      hardGateResult: hardGate.hardGateResult,
      hardGateFailures: hardGate.failures,
      qualityScore: score.qualityScore,
      eligibilityResult: score.eligibilityResult,
      candidatePassed: score.candidatePassed,
      providerRequestId: response.providerRequestId || null,
      simulatedHostedOutputPresentedAsReal: false,
      productionActivation: false,
      providerSelected: false,
      modelSelected: false,
      error: response.status === 'FAILED' ? response.error : null
    };
    if (result.status === 'FAILED') result.failureClassification = classifyFailure(result);
    if (priorFailure || priorHardGateFailure) {
      run.results = run.results.filter((record) => benchmarkIdentity(record) !== identity);
      const superseded = priorFailure || priorHardGateFailure;
      const target = priorFailure ? run.supersededFailures : run.supersededHardGateFailures;
      target.push({
        ...superseded,
        supersededByStatus: result.status,
        supersededAt: new Date().toISOString(),
        failureClassification: priorFailure ? classifyFailure(priorFailure) : 'COMPLETED_HARD_GATE_FAILURE'
      });
    }
    run.results.push(result);
    if (result.status === 'COMPLETED') completedByIdentity.set(identity, result);
    if (result.status === 'FAILED') failedByIdentity.set(identity, result);
    run.failureSummary = summarizeFailures(run.results);
    checkpointRun(run, options);
    console.log(`[ms004:resume] provider=${planned.provider} capability=${planned.capabilityId} status=${result.status} cumulativeSpendUsd=${cumulativeCostUsd}`);
  }

  run.failureSummary = summarizeFailures(run.results);
  run.resumeSummary = { existingCompleted, existingFailed, skippedCompleted, skippedNonRetryable, retryableFailed, pending };
  checkpointRun(run, options);
  return run;
}

function printPrepareSummary(summary) {
  console.log(`[ms004:prepare] ready=${summary.ready} d2Datasets=${summary.d2DatasetCount} hostedCandidates=${summary.hostedCandidateCount} highProjectedCostUsd=${summary.highProjectedCostUsd} failures=${summary.failures.length}`);
}

async function main() {
  const prepareOnly = process.argv.includes('--prepare') || process.argv.includes('--dry-run');
  const resumeOnly = process.argv.includes('--resume') || fs.existsSync(LIVE_RESULTS_REPORT);
  const filters = parseFilters();
  const plan = loadLivePlan(process.env);
  const prepare = validatePrepare(plan, process.env);
  if (prepareOnly) {
    printPrepareSummary(prepare);
    return;
  }
  const run = resumeOnly ? await resumeLiveBenchmarks({ filters }) : await runLiveBenchmarks({ filters });
  console.log(`[ms004:${resumeOnly ? 'resume' : 'run'}] liveHostedCalls=${run.summary.completedCalls} failedCalls=${run.summary.failedCalls} measuredCostUsd=${run.summary.measuredTotalBenchmarkCostUsd} winnersProposed=${run.summary.winnersProposed}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[ms004:run] failed: ${error.code || 'MS004_RUN_FAILED'} ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BENCHMARK_BUDGET_CEILING_USD,
  LIVE_RESULTS_FILE,
  LIVE_RESULTS_REPORT,
  FAILURE_CLASSIFICATIONS,
  atomicWriteJson,
  benchmarkIdentity,
  classifyFailure,
  containsSecretLikeValue,
  costForUsage,
  evaluateHardGates,
  loadLivePlan,
  loadExistingLiveEvidence,
  parseFilters,
  plannedBenchmarkItems,
  resumeLiveBenchmarks,
  runLiveBenchmarks,
  scoreOutput,
  summarizeFailures,
  validatePrepare
};
