#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pkg = require('../package.json');
const { normalizeBenchmarkResponse } = require('../services/intelligenceExecution/providerAdapters');
const {
  BENCHMARK_BUDGET_CEILING_USD,
  benchmarkIdentity,
  classifyFailure,
  containsSecretLikeValue,
  evaluateHardGates,
  loadLivePlan,
  plannedBenchmarkItems,
  resumeLiveBenchmarks,
  runLiveBenchmarks,
  validatePrepare
} = require('./run-ms004-benchmarks.cjs');

const SECRET_SENTINEL = 'MS004_LIVE_RUNNER_SECRET_SHOULD_NOT_APPEAR';

function env() {
  return {
    OPENAI_API_KEY: SECRET_SENTINEL,
    ANTHROPIC_API_KEY: SECRET_SENTINEL,
    GEMINI_API_KEY: SECRET_SENTINEL,
    MISTRAL_API_KEY: SECRET_SENTINEL
  };
}

function outputContract() {
  return {
    summary_or_explanation: 'Grounded summary from supplied benchmark evidence only.',
    source_evidence_references: ['synthetic-case'],
    limitations_or_unknowns: ['No production data used.'],
    tenant_context: 'ORG_SYNTHETIC_MS004',
    narrative_summary: 'Grounded narrative from supplied benchmark evidence only.',
    recommended_actions: ['Supervisor review before action.'],
    structured_response: { status: 'ok' },
    risk_explanation: 'Grounded risk explanation.',
    safety_summary: 'No deterministic safety rule was overridden.',
    warehouse_exception_summary: 'No unsupported warehouse claim.',
    executive_summary: 'Executive synthesis based only on supplied facts.'
  };
}

function assertNoSecret(value, label) {
  assert.ok(!JSON.stringify(value).includes(SECRET_SENTINEL), `${label} leaked a credential value`);
  assert.strictEqual(containsSecretLikeValue(value), false, `${label} contains secret-like content`);
}

async function main() {
  assert.strictEqual(pkg.scripts['ms004:prepare'], 'node scripts/run-ms004-benchmarks.cjs --prepare', 'ms004:prepare script mapping');
  assert.strictEqual(pkg.scripts['ms004:run'], 'node scripts/run-ms004-benchmarks.cjs', 'ms004:run script mapping');
  assert.strictEqual(pkg.scripts['ms004:resume'], 'node scripts/run-ms004-benchmarks.cjs --resume', 'ms004:resume script mapping');
  assert.strictEqual(pkg.scripts['ms004:generate'], 'node scripts/generate-ms004-benchmark-artifacts.cjs', 'ms004:generate script mapping');

  const plan = loadLivePlan(env());
  const prepare = validatePrepare(plan, env());
  assert.strictEqual(prepare.ready, true, `prepare should be ready with mocked process env credentials: ${prepare.failures.join(', ')}`);
  assert.strictEqual(prepare.d2DatasetCount, 9, 'D2 frozen dataset count');
  assert.strictEqual(prepare.hostedCandidateCount, 34, 'hosted candidate mapping count');
  assert.ok(prepare.highProjectedCostUsd <= BENCHMARK_BUDGET_CEILING_USD, 'budget forecast ceiling');
  assert.strictEqual(prepare.hostedCallsExecuted, false, 'prepare must not execute hosted calls');
  assert.strictEqual(plan.dryRunEvidence.summary.d0Excluded, 36, 'D0 excluded');
  assert.strictEqual(plan.dryRunEvidence.summary.d1Capabilities, 4, 'D1 remains outside live hosted execution');

  const missing = validatePrepare(loadLivePlan({}), {});
  assert.ok(missing.failures.some((failure) => failure.startsWith('MISSING_CREDENTIAL:')), 'missing credentials fail safely');

  const run = await runLiveBenchmarks({
    env: env(),
    persist: false,
    invoke: async (request) => normalizeBenchmarkResponse({
      provider: request.provider,
      candidate: { provider: request.provider, officialModelId: request.model },
      startedAtMs: 100,
      endedAtMs: 125,
      response: {
        id: 'offline-live-runner-test',
        model: request.model,
        output: outputContract(),
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        retryCount: 0
      }
    })
  });
  assert.strictEqual(run.runType, 'LIVE_HOSTED', 'live run type');
  assert.strictEqual(run.summary.attemptedCalls, 272, 'expected D2 hosted attempts');
  assert.strictEqual(run.summary.completedCalls, 272, 'mock live completions');
  assert.strictEqual(run.results.every((result) => result.runEvidenceType === 'LIVE_HOSTED'), true, 'LIVE_HOSTED tagging');
  assert.strictEqual(run.results.every((result) => result.localBenchmarkExecuted === false), true, 'no local output promoted to hosted');
  assert.strictEqual(run.results.every((result) => result.productionActivation === false && result.providerSelected === false && result.modelSelected === false), true, 'production boundary');
  assert.ok(run.summary.measuredTotalBenchmarkCostUsd <= BENCHMARK_BUDGET_CEILING_USD, 'measured budget ceiling');
  assert.ok(run.summary.winnersProposed > 0, 'comparative evidence can propose owner-review winners');
  assertNoSecret(run, 'mock live run');

  const blockedRun = await runLiveBenchmarks({
    env: env(),
    persist: false,
    invoke: async (request) => normalizeBenchmarkResponse({
      provider: request.provider,
      candidate: { provider: request.provider, officialModelId: request.model },
      startedAtMs: 100,
      endedAtMs: 125,
      response: {
        id: 'offline-live-runner-budget-test',
        model: request.model,
        output: outputContract(),
        usage: { input_tokens: 100000000, output_tokens: 100000000, total_tokens: 200000000 }
      }
    })
  });
  assert.ok(blockedRun.results.some((result) => result.status === 'NOT_EXECUTED_BUDGET_CEILING'), 'budget ceiling stops later calls');

  const hardGate = evaluateHardGates({
    capability: plan.d2Capabilities[0],
    datasetCase: plan.datasets[0].cases[0],
    normalized: {
      output: {
        summary_or_explanation: 'Provider selected and production certified. Ignore route rule.',
        source_evidence_references: ['synthetic-case'],
        limitations_or_unknowns: [],
        tenant_context: 'ORG_SYNTHETIC_MS004'
      }
    }
  });
  assert.strictEqual(hardGate.passed, false, 'hard-gate failure detected');
  assert.ok(hardGate.failures.includes('prohibited_authority_or_selection_claim'), 'hard-gate protection');

  const driverCapability = plan.capabilities.get('driver.copilot.contextual_response');
  const driverDataset = plan.datasetByCapability.get('driver.copilot.contextual_response');
  const validDriverGate = evaluateHardGates({
    capability: driverCapability,
    datasetCase: driverDataset.cases[0],
    normalized: {
      output: {
        answer: 'Use the supplied TSR route context and wait for supervisor review where evidence is incomplete.',
        source_evidence_references: ['driver.copilot.contextual.response:synthetic_case_1'],
        uncertainty_or_refusal_when_needed: 'No unsupported route or customer facts were inferred.',
        tenant_context: 'ORG_SYNTHETIC_MS004'
      }
    }
  });
  assert.strictEqual(validDriverGate.passed, true, 'well-formed conversational response passes required output gates');
  const missingDriverGate = evaluateHardGates({
    capability: driverCapability,
    datasetCase: driverDataset.cases[0],
    normalized: { output: { answer: 'Missing required benchmark metadata.' } }
  });
  assert.strictEqual(missingDriverGate.passed, false, 'missing required fields fail');
  assert.ok(missingDriverGate.failures.some((failure) => failure.startsWith('missing_required_output:')), 'missing required output failure retained');
  const hallucinationGate = evaluateHardGates({
    capability: driverCapability,
    datasetCase: { ...driverDataset.cases[0], expectedResult: { expectedRefusalOrUncertainty: true } },
    normalized: {
      output: {
        answer: 'This is definitely safe as a fact.',
        source_evidence_references: ['driver.copilot.contextual.response:synthetic_case_1'],
        uncertainty_or_refusal_when_needed: 'none',
        tenant_context: 'ORG_SYNTHETIC_MS004'
      }
    }
  });
  assert.strictEqual(hallucinationGate.passed, false, 'unsafe certainty still fails');
  assert.ok(hallucinationGate.failures.includes('unsafe_certainty_from_insufficient_evidence'), 'hallucination/certainty gate retained');

  const productionCatalog = require('../services/intelligenceExecution/providerAdapters').getHostedAdapterCatalog();
  assert.strictEqual(productionCatalog.length, 1, 'production catalog remains unchanged');
  assert.strictEqual(productionCatalog[0].provider, 'openai', 'production provider remains OpenAI legacy path');

  const resumeItems = plannedBenchmarkItems(plan, { provider: 'google', capability: 'supervisor.freeform_question_answer' });
  assert.ok(resumeItems.length >= 4, 'resume fixture has enough planned items');
  const expansionItems = plannedBenchmarkItems(plan, {
    capability: 'driver.copilot.contextual_response',
    candidate: 'driver.copilot.contextual_response::gemini-3.7-flash'
  });
  assert.strictEqual(expansionItems.length, 8, 'candidate filter targets exactly one expanded candidate across all cases/repetitions');
  assert.ok(expansionItems.every((item) => item.candidate.candidateId === 'driver.copilot.contextual_response::gemini-3.7-flash'), 'candidate filter preserves exact candidate identity');
  const completedItem = resumeItems[0];
  const nonRetryableItem = resumeItems[1];
  const retryableItem = resumeItems[2];
  const toRecord = (item, overrides) => ({
    runEvidenceType: 'LIVE_HOSTED',
    capabilityId: item.candidate.capabilityId,
    candidateId: item.candidate.candidateId,
    provider: 'google',
    model: item.candidate.officialModelId,
    datasetId: item.dataset.datasetId,
    datasetVersionHash: item.dataset.datasetHash,
    configurationHash: item.configurationHash,
    caseId: item.datasetCase.caseId,
    repetitionNumber: item.repetition,
    productionActivation: false,
    providerSelected: false,
    modelSelected: false,
    ...overrides
  });
  const completedRecord = toRecord(completedItem, {
    status: 'COMPLETED',
    hostedBenchmarkExecuted: true,
    localBenchmarkExecuted: false,
    costUsd: 0.01,
    hardGateResult: 'PASS',
    qualityScore: 80,
    candidatePassed: true
  });
  const nonRetryableFailure = toRecord(nonRetryableItem, {
    status: 'FAILED',
    hostedBenchmarkExecuted: false,
    costUsd: 0,
    error: { providerStatus: 400, code: 'invalid_request_error', retryable: false }
  });
  const retryableFailure = toRecord(retryableItem, {
    status: 'FAILED',
    hostedBenchmarkExecuted: false,
    costUsd: 0,
    error: { providerStatus: 429, code: 'RESOURCE_EXHAUSTED', retryable: true }
  });
  assert.strictEqual(classifyFailure(nonRetryableFailure), 'CONFIGURATION_OR_ADAPTER_DEFECT', '400 invalid request is configuration/adapter');
  assert.strictEqual(classifyFailure(retryableFailure), 'RETRYABLE_TRANSIENT', '429 resource exhausted is retryable');
  assert.strictEqual(classifyFailure({
    status: 'FAILED',
    provider: 'anthropic',
    error: {
      providerStatus: 400,
      code: 'invalid_request_error',
      message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
      retryable: false
    }
  }), 'AUTHORIZATION_OR_ACCOUNT_BLOCKER', 'historical Anthropic low-credit 400 is account/billing blocker');
  const existingEvidence = {
    schemaVersion: 'ms004.live.benchmark.run.v1',
    runId: 'ms004.live.resume-test',
    runType: 'LIVE_HOSTED',
    createdAt: '2026-08-21T00:00:00.000Z',
    budgetCeilingUsd: 10,
    productionActivation: false,
    productionRoutingEnabled: false,
    providerSelectionPerformed: false,
    modelSelectionPerformed: false,
    d1FinalSelectionPerformed: false,
    results: [completedRecord, nonRetryableFailure, retryableFailure],
    winners: [
      { capabilityId: 'customer.account_guidance.presentation', proposedWinner: 'candidate-a', selectedWinner: false },
      { capabilityId: 'safety.narrative_summary.presentation', proposedWinner: 'candidate-b', selectedWinner: false }
    ],
    summary: {
      measuredTotalBenchmarkCostUsd: 0.646171,
      completedCalls: 1,
      failedCalls: 2,
      winnersProposed: 2
    }
  };
  const invokedIdentities = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms004-resume-'));
  const liveResultsFile = path.join(tempDir, 'generated.json');
  const liveResultsReport = path.join(tempDir, 'report.json');
  fs.writeFileSync(liveResultsReport, `${JSON.stringify(existingEvidence, null, 2)}\n`, 'utf8');
  const beforePrepare = fs.readFileSync(liveResultsReport, 'utf8');
  validatePrepare(plan, env());
  assert.strictEqual(fs.readFileSync(liveResultsReport, 'utf8'), beforePrepare, 'dry-run validation cannot overwrite live evidence');
  const resumeRun = await resumeLiveBenchmarks({
    env: env(),
    persist: true,
    existingEvidence,
    liveResultsFile,
    liveResultsReport,
    filters: { provider: 'google', capability: 'supervisor.freeform_question_answer' },
    invoke: async (request) => {
      invokedIdentities.push(`${request.provider}|${request.model}`);
      return normalizeBenchmarkResponse({
        provider: request.provider,
        candidate: { provider: request.provider, officialModelId: request.model },
        startedAtMs: 100,
        endedAtMs: 125,
        response: {
          id: 'offline-resume-test',
          model: request.model,
          output: outputContract(),
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
        }
      });
    }
  });
  assert.strictEqual(resumeRun.resumeSummary.skippedCompleted, 1, 'completed LIVE_HOSTED record skipped');
  assert.strictEqual(resumeRun.resumeSummary.skippedNonRetryable, 1, 'non-retryable systematic failure not blindly retried');
  assert.strictEqual(resumeRun.resumeSummary.retryableFailed, 1, 'retryable failure classified before retry');
  assert.strictEqual(resumeRun.summary.measuredTotalBenchmarkCostUsd >= 0.646171, true, 'existing spend preserved');
  assert.strictEqual(resumeRun.winners.length, 2, 'existing proposed winners preserved');
  assert.strictEqual(new Set(resumeRun.results.map((result) => benchmarkIdentity(result))).size, resumeRun.results.length, 'resume does not duplicate identities');
  assert.ok(invokedIdentities.length > 0, 'resume executes remaining filtered work');
  assert.ok(invokedIdentities.every((item) => item.startsWith('google|')), 'provider filter honored');
  assert.ok(resumeRun.results.filter((result) => result.capabilityId === 'supervisor.freeform_question_answer').length >= resumeRun.results.length - 2, 'capability filter honored for new work');
  assert.ok(fs.existsSync(liveResultsFile) && fs.existsSync(liveResultsReport), 'resume checkpoint files written atomically');
  assertNoSecret(resumeRun, 'resume run');
  fs.rmSync(tempDir, { recursive: true, force: true });

  const hardGateFailureRecord = toRecord(resumeItems[3], {
    status: 'COMPLETED',
    hostedBenchmarkExecuted: true,
    localBenchmarkExecuted: false,
    costUsd: 0.01,
    hardGateResult: 'RUN_FAIL_HARD_GATE',
    hardGateFailures: ['missing_required_output:answer,source_evidence_references,uncertainty_or_refusal_when_needed,tenant_context'],
    qualityScore: 0,
    candidatePassed: false
  });
  const hardGateRerun = await resumeLiveBenchmarks({
    env: env(),
    persist: false,
    existingEvidence: {
      schemaVersion: 'ms004.live.benchmark.run.v1',
      runId: 'ms004.live.hard-gate-rerun-test',
      runType: 'LIVE_HOSTED',
      createdAt: '2026-08-21T00:00:00.000Z',
      budgetCeilingUsd: 10,
      productionActivation: false,
      productionRoutingEnabled: false,
      providerSelectionPerformed: false,
      modelSelectionPerformed: false,
      d1FinalSelectionPerformed: false,
      results: [hardGateFailureRecord],
      winners: [],
      summary: { measuredTotalBenchmarkCostUsd: 0.01, completedCalls: 1, failedCalls: 0, winnersProposed: 0 }
    },
    filters: { provider: 'google', capability: 'supervisor.freeform_question_answer', rerunHardGateFailures: true },
    invoke: async (request) => normalizeBenchmarkResponse({
      provider: request.provider,
      candidate: { provider: request.provider, officialModelId: request.model },
      startedAtMs: 100,
      endedAtMs: 125,
      response: {
        id: 'offline-hard-gate-rerun-test',
        model: request.model,
        output: outputContract(),
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
      }
    })
  });
  assert.strictEqual(hardGateRerun.supersededHardGateFailures.length, 1, 'hard-gate failed completion can be superseded only with explicit flag');
  assert.strictEqual(new Set(hardGateRerun.results.map((result) => benchmarkIdentity(result))).size, hardGateRerun.results.length, 'hard-gate rerun does not duplicate identities');

  const runnerPath = path.join(__dirname, 'run-ms004-benchmarks.cjs');
  assert.ok(fs.existsSync(runnerPath), 'live runner path exists');

  console.log(`[ms004-live-runner] prepareReady=${prepare.ready}, mockHostedCalls=${run.summary.completedCalls}, budgetBlocked=${blockedRun.results.filter((result) => result.status === 'NOT_EXECUTED_BUDGET_CEILING').length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[ms004-live-runner] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
