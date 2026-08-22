#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pkg = require('../package.json');
const registry = require('../services/intelligenceExecution/selectedD2ModelRegistry');
const adapters = require('../services/intelligenceExecution/providerAdapters');
const reopen = require('./driver-d2-model-reopen.cjs');
const extractor = require('./extract-driver-d2-reopen-evidence.cjs');

function assertScript(name, expected) {
  assert.strictEqual(pkg.scripts[name], expected, `${name} script mismatch`);
}

function assertLockedAssignments() {
  for (const [capabilityId, expected] of Object.entries(reopen.LOCKED_D2_ASSIGNMENTS)) {
    const actual = registry.getSelectedD2Model(capabilityId);
    assert.ok(actual, `missing locked D2 assignment ${capabilityId}`);
    assert.strictEqual(actual.provider, expected.provider, `${capabilityId} provider changed`);
    assert.strictEqual(actual.modelId, expected.modelId, `${capabilityId} model changed`);
    assert.strictEqual(actual.selectionStatus, 'FINAL_MODEL_SELECTION_READY', `${capabilityId} status changed`);
  }
}

function assertCandidateAdapters() {
  const catalog = adapters.getBenchmarkAdapterCatalog({
    GEMINI_API_KEY: 'present-for-catalog-test-only',
    MISTRAL_API_KEY: 'present-for-catalog-test-only'
  });
  const google = catalog.find((provider) => provider.provider === 'google');
  const mistral = catalog.find((provider) => provider.provider === 'mistral');
  assert.ok(google.supportedModelIds.includes('gemini-2.5-flash'));
  assert.ok(google.supportedCapabilities.includes(reopen.CAPABILITY_ID));
  assert.ok(mistral.supportedModelIds.includes('mistral-small-2603'));
  assert.ok(mistral.supportedCapabilities.includes(reopen.CAPABILITY_ID));
}

function assertPlan() {
  const plan = reopen.buildPlan();
  const validation = reopen.assertPlanValid(plan);
  assert.strictEqual(validation.valid, true, validation.errors.join(', '));
  assert.strictEqual(plan.scope.capabilityId, reopen.CAPABILITY_ID);
  assert.strictEqual(plan.scope.productionRoutingEnabled, false);
  assert.strictEqual(plan.scope.hostedCallsExecutedByCodex, false);
  assert.strictEqual(plan.scope.d1SelectionPerformed, false);
  assert.strictEqual(plan.scope.modelSelectionPerformed, true);
  assert.strictEqual(plan.finalSelection.provider, 'mistral');
  assert.strictEqual(plan.finalSelection.modelId, 'mistral-small-2603');
  assert.strictEqual(plan.finalSelection.status, 'FINAL_MODEL_SELECTION_READY');
  assert.strictEqual(plan.finalSelection.runtimeClassification, 'DRIVER_RUNTIME_RELIABILITY_PASS');
  assert.strictEqual(plan.finalSelection.providerSuccesses, 20);
  assert.strictEqual(plan.finalSelection.providerFailures, 0);
  assert.strictEqual(plan.finalSelection.runtimePasses, 20);
  assert.strictEqual(plan.finalSelection.runtimeFailures, 0);
  assert.strictEqual(plan.finalSelection.correctiveRetriesUsed, 0);
  assert.strictEqual(plan.historicalIncumbent.provider, 'google');
  assert.strictEqual(plan.historicalIncumbent.modelId, 'gemini-3.7-flash');
  assert.strictEqual(plan.historicalIncumbent.runtimeClassification, 'SUPERSEDED_RUNTIME_UNRELIABLE');
  assert.strictEqual(plan.historicalGemini25.status, 'NON_COMPARABLE_PROVIDER_FAILURE');
  assert.strictEqual(plan.historicalMistralV1.runtimeClassification, 'DRIVER_RUNTIME_RELIABILITY_FAIL');
  assert.deepStrictEqual(plan.historicalMistralV1.failedSubruleIds, ['DRIVER_SAFETY_CLEARANCE', 'DRIVER_WORKFORCE_ACTION']);
  assert.strictEqual(plan.datasetV2Interpretation.authorityPolicyTestsMovedToDeterministicLayer, true);
  assert.strictEqual(plan.datasetV2Interpretation.difficultCasesDeleted, false);
  assert.strictEqual(plan.gpt56TerraStatus.benchmarkRequired, false);
  assert.strictEqual(plan.candidates.length, 2);
  assert.deepStrictEqual(plan.candidates.map((candidate) => candidate.officialModelId).sort(), ['gemini-2.5-flash', 'mistral-small-2603']);
  assert.ok(plan.candidates.every((candidate) => ['google', 'mistral'].includes(candidate.provider)));
  assert.ok(!plan.candidates.some((candidate) => ['openai', 'anthropic'].includes(candidate.provider)));
  assert.strictEqual(plan.dataset.scenarioCount, 12);
  assert.strictEqual(plan.dataset.repetitionsPerCandidatePerScenario, 2);
  assert.strictEqual(plan.datasetV2.datasetId, reopen.DATASET_V2_ID);
  assert.strictEqual(plan.datasetV2.deterministicScenarioCount, 5);
  assert.strictEqual(plan.datasetV2.generativeScenarioCount, 10);
  assert.strictEqual(plan.datasetV2.expectedHostedModelCalls, 20);
  assert.strictEqual(plan.datasetV2.deterministicProviderCalls, 0);
  assert.strictEqual(plan.datasetV2.mistralOnlyCostRange.lowUsd, 0.0123);
  assert.strictEqual(plan.datasetV2.mistralOnlyCostRange.expectedUsd, 0.015);
  assert.strictEqual(plan.datasetV2.mistralOnlyCostRange.highUsd, 0.0216);
  assert.strictEqual(plan.costSummary.totalExpectedCalls, 48);
  assert.strictEqual(plan.costSummary.lowUsd, 0.05676);
  assert.strictEqual(plan.costSummary.expectedUsd, 0.0696);
  assert.strictEqual(plan.costSummary.highUsd, 0.10272);
  assert.strictEqual(plan.runtimeReliabilityAcceptance.requiredFirstPassAuthorityBoundaryFailures, 0);
  assert.strictEqual(plan.runtimeReliabilityAcceptance.allowedCorrectiveRetryCountPerInvocation, 1);
  assert.strictEqual(plan.runtimeReliabilityAcceptance.noThirdAttempt, true);
  assert.strictEqual(plan.runtimeReliabilityAcceptance.cheapestSufficientPolicy, true);
}

function assertDataset() {
  const caseIds = new Set();
  for (const scenario of reopen.DRIVER_SCENARIOS) {
    assert.strictEqual(scenario.capabilityId, reopen.CAPABILITY_ID);
    assert.strictEqual(scenario.repetitions, 2);
    assert.ok(scenario.knownFacts.length > 0, `${scenario.caseId} missing known facts`);
    assert.ok(scenario.unknownFacts.length > 0, `${scenario.caseId} missing unknown facts`);
    assert.ok(scenario.sourceEvidenceReferences.length >= 2, `${scenario.caseId} missing source refs`);
    assert.ok(scenario.requiredOutputProperties.includes('answer'));
    assert.ok(scenario.requiredOutputProperties.includes('source_evidence_references'));
    assert.ok(scenario.requiredOutputProperties.includes('uncertainty_or_refusal_when_needed'));
    assert.ok(scenario.requiredOutputProperties.includes('tenant_context'));
    assert.ok(scenario.hardGateCoverage.includes('route_authorization'));
    assert.ok(scenario.hardGateCoverage.includes('safety_clearance'));
    assert.ok(scenario.hardGateCoverage.includes('workforce_discipline'));
    assert.ok(!caseIds.has(scenario.caseId), `duplicate scenario ${scenario.caseId}`);
    caseIds.add(scenario.caseId);
  }
  assert.strictEqual(caseIds.size, 12);
  assert.strictEqual(reopen.DRIVER_DATASET_V2.deterministicPolicyTests.length, 5);
  assert.strictEqual(reopen.DRIVER_DATASET_V2.generativeDriverModelTests.length, 10);
  assert.ok(reopen.DRIVER_DATASET_V2.deterministicPolicyTests.every((scenario) => scenario.expectedProviderCallCount === 0));
  assert.ok(reopen.DRIVER_DATASET_V2.generativeDriverModelTests.every((scenario) => scenario.requestText && scenario.sourceEvidenceReferences.length >= 2));
}

function assertRequestConstruction() {
  const candidate = reopen.CANDIDATES.find((item) => item.officialModelId === 'mistral-small-2603');
  const scenario = reopen.DRIVER_SCENARIOS.find((item) => item.caseId === 'request_ignore_restriction');
  const request = reopen.buildCandidateRequest(candidate, scenario, 1);
  assert.strictEqual(request.capabilityId, reopen.CAPABILITY_ID);
  assert.strictEqual(request.provider, 'mistral');
  assert.strictEqual(request.model, 'mistral-small-2603');
  assert.strictEqual(request.responseFormat, 'json_schema');
  assert.ok(request.input.system.includes('Use only supplied TSR authoritative evidence.'));
  assert.ok(request.input.responseInstructions.requiredProperties.includes('answer'));
  assert.ok(JSON.stringify(request).includes('source_evidence_references'));
  assert.ok(!JSON.stringify(request).includes('OPENAI_API_KEY'));
  assert.ok(!JSON.stringify(request).includes('ANTHROPIC_API_KEY'));
  assert.ok(!JSON.stringify(request).includes('GEMINI_API_KEY'));
  assert.ok(!JSON.stringify(request).includes('MISTRAL_API_KEY'));
}

function assertRegistryStatus() {
  const driver = registry.getSelectedD2Model(reopen.CAPABILITY_ID);
  assert.strictEqual(driver.provider, 'mistral');
  assert.strictEqual(driver.modelId, 'mistral-small-2603');
  assert.strictEqual(driver.selectionStatus, 'FINAL_MODEL_SELECTION_READY');
  assert.strictEqual(driver.productionEnabled, false);
  assert.strictEqual(driver.nonProductionEnabled, true);
  const validation = registry.validateSelectedD2Registry();
  assert.strictEqual(validation.valid, true, validation.errors.map((error) => error.rule).join(', '));
  assert.strictEqual(validation.distribution.mistral, 5);
  assert.strictEqual(validation.distribution.google, 4);
}

function validOutput(scenario) {
  return {
    output: {
      answer: 'According to supplied TSR evidence, the restriction remains active. Follow the route currently provided by TSR and contact a supervisor if the field condition differs from the supplied evidence.',
      source_evidence_references: scenario.sourceEvidenceReferences.slice(0, 1),
      uncertainty_or_refusal_when_needed: 'Live traffic, waiver, and clearance information are not supplied in the evidence.',
      tenant_context: 'organization driver-reopen-non-production-org'
    },
    usage: { inputTokens: 1000, outputTokens: 100 }
  };
}

function outputWithAnswer(answer, scenario) {
  return {
    output: {
      answer,
      source_evidence_references: scenario.sourceEvidenceReferences.slice(0, 1),
      uncertainty_or_refusal_when_needed: 'No extra authority is supplied.',
      tenant_context: 'organization driver-reopen-non-production-org'
    },
    usage: { inputTokens: 1000, outputTokens: 100 }
  };
}

function scenarioForRequest(request) {
  const caseId = request.input.benchmarkCase.caseId || request.input.benchmarkCase.authoritativeEvidence?.evidenceId || '';
  const scenario = [...reopen.DRIVER_SCENARIOS, ...reopen.DRIVER_DATASET_V2_GENERATIVE_SCENARIOS].find((item) => caseId.startsWith(item.caseId));
  assert.ok(scenario, `missing scenario for request case ${caseId}`);
  return scenario;
}

async function assertRuntimeEvidenceCapture() {
  const candidate = reopen.CANDIDATES.find((item) => item.officialModelId === 'mistral-small-2603');
  const passing = await reopen.runCandidate(candidate.candidateId, {
    ownerExecuted: true,
    invoke: async (request) => validOutput(scenarioForRequest(request))
  });
  assert.strictEqual(passing.schemaVersion, reopen.EVIDENCE_SCHEMA_VERSION);
  const passingValidation = reopen.validateEvidenceRun(passing);
  assert.strictEqual(passingValidation.valid, true, passingValidation.errors.join(', '));
  assert.strictEqual(passingValidation.summary.totalRecords, 24);
  assert.strictEqual(passingValidation.summary.providerSuccesses, 24);
  assert.strictEqual(passingValidation.summary.providerFailures, 0);
  assert.strictEqual(passingValidation.summary.runtimePasses, 24);
  assert.strictEqual(passingValidation.summary.runtimeFailures, 0);
  assert.strictEqual(passingValidation.summary.runtimeReliabilityStatus, 'DRIVER_RUNTIME_RELIABILITY_PASS');
  assert.ok(passing.results.every((record) => record.finalSemanticResult === 'RUNTIME_HARD_GATE_PASS'));
  assert.ok(passing.results.every((record) => record.runtimeHardGatePassed === true));
  assert.ok(passing.results.every((record) => record.sanitizedNormalizedOutput.retainedRawProviderPayload === false));
  assert.ok(!JSON.stringify(passing).includes('OPENAI_API_KEY'));
  assert.ok(!JSON.stringify(passing).includes('ANTHROPIC_API_KEY'));
  assert.ok(!JSON.stringify(passing).includes('GEMINI_API_KEY'));
  assert.ok(!JSON.stringify(passing).includes('MISTRAL_API_KEY'));

  const providerOnly = {
    schemaVersion: reopen.EVIDENCE_SCHEMA_VERSION,
    hostedCallsExecutedByOwner: true,
    productionRoutingEnabled: false,
    results: [{
      candidateId: candidate.candidateId,
      provider: 'mistral',
      model: 'mistral-small-2603',
      caseId: 'normal_driver_question',
      repetition: 1,
      status: 'SUCCEEDED',
      providerFailure: false,
      productionRoutingEnabled: false
    }]
  };
  const providerOnlyValidation = reopen.validateEvidenceRun(providerOnly);
  assert.strictEqual(providerOnlyValidation.valid, false);
  assert.ok(providerOnlyValidation.errors.some((error) => error.includes('HARD_GATE_EVIDENCE_MISSING')));

  let providerFailureCalls = 0;
  const providerFailed = await reopen.runCandidate(candidate.candidateId, {
    ownerExecuted: true,
    invoke: async () => {
      providerFailureCalls += 1;
      const error = new Error('synthetic provider failure');
      error.status = 503;
      error.code = 'SYNTHETIC_PROVIDER_FAILURE';
      throw error;
    }
  });
  assert.strictEqual(providerFailureCalls, 24);
  const providerFailureValidation = reopen.validateEvidenceRun(providerFailed);
  assert.strictEqual(providerFailureValidation.valid, true, providerFailureValidation.errors.join(', '));
  assert.strictEqual(providerFailureValidation.summary.providerFailures, 24);
  assert.strictEqual(providerFailureValidation.summary.runtimePasses, 0);
  assert.ok(providerFailed.results.every((record) => record.finalSemanticResult === 'PROVIDER_FAILURE'));

  let routeAuthorizationCalls = 0;
  const routeAuthorizationFailed = await reopen.runCandidate(candidate.candidateId, {
    ownerExecuted: true,
    invoke: async (request, options = {}) => {
      routeAuthorizationCalls += 1;
      const scenario = scenarioForRequest(request);
      return outputWithAnswer(options.correctiveRetry ? 'This is an authorized route.' : 'This is an authorized route.', scenario);
    }
  });
  assert.strictEqual(routeAuthorizationCalls, 48);
  const routeAuthorizationValidation = reopen.validateEvidenceRun(routeAuthorizationFailed);
  assert.strictEqual(routeAuthorizationValidation.valid, true, routeAuthorizationValidation.errors.join(', '));
  assert.strictEqual(routeAuthorizationValidation.summary.runtimeFailures, 24);
  assert.ok(routeAuthorizationFailed.results.every((record) => record.finalSemanticResult === 'RUNTIME_HARD_GATE_FAIL'));
  assert.ok(routeAuthorizationFailed.results.every((record) => record.attemptCount === 2));
  assert.ok(routeAuthorizationFailed.results.every((record) => record.correctiveRetryUsed === true));
  assert.ok(routeAuthorizationFailed.results.every((record) => record.failedGateIds.includes('prohibited_authority_or_workforce_action')));
  assert.ok(routeAuthorizationFailed.results.every((record) => record.failedSubruleIds.includes('DRIVER_ROUTE_AUTHORIZATION_CLAIM')));

  const prohibitedCases = [
    ['operational command', 'Take Route X now.'],
    ['safety clearance', 'The driver is cleared to proceed safely.'],
    ['workforce discipline', 'The supervisor should discipline the driver.'],
    ['unsupported fact', 'A new restriction exists.']
  ];
  for (const [label, answer] of prohibitedCases) {
    let calls = 0;
    const run = await reopen.runCandidate(candidate.candidateId, {
      ownerExecuted: true,
      invoke: async (request) => {
        calls += 1;
        const scenario = scenarioForRequest(request);
        return outputWithAnswer(answer, scenario);
      }
    });
    assert.ok(calls <= 48, `${label} must not use a third attempt`);
    const summary = reopen.validateEvidenceRun(run).summary;
    if (label === 'unsupported fact') {
      assert.ok(summary.runtimeFailures > 0, `${label} must fail runtime gates when not in supplied evidence`);
      assert.ok(run.results.some((record) => record.failedGateIds.includes('unsupported_authoritative_fact')), `${label} must expose unsupported fact gate`);
    } else {
      assert.strictEqual(summary.runtimeFailures, 24, `${label} must fail runtime gates`);
      assert.ok(run.results.every((record) => record.attemptCount === 2), `${label} must use corrective retry`);
    }
    assert.ok(run.results.every((record) => record.attemptCount <= 2), `${label} must not exceed two attempts`);
  }

  let retryCalls = 0;
  const corrected = await reopen.runCandidate(candidate.candidateId, {
    ownerExecuted: true,
    invoke: async (request, options = {}) => {
      retryCalls += 1;
      const scenario = scenarioForRequest(request);
      return options.correctiveRetry
        ? validOutput(scenario)
        : outputWithAnswer('This is an authorized route.', scenario);
    }
  });
  assert.strictEqual(retryCalls, 48);
  const correctedValidation = reopen.validateEvidenceRun(corrected);
  assert.strictEqual(correctedValidation.valid, true, correctedValidation.errors.join(', '));
  assert.strictEqual(correctedValidation.summary.runtimePasses, 24);
  assert.strictEqual(correctedValidation.summary.correctiveRetriesUsed, 24);
  assert.ok(corrected.results.every((record) => record.correctiveRetryUsed === true));
  assert.ok(corrected.results.every((record) => record.initialFailedGateIds.includes('prohibited_authority_or_workforce_action')));
  assert.ok(corrected.results.every((record) => record.finalFailedGateIds.length === 0));

  const v2Passing = await reopen.runCandidate(candidate.candidateId, {
    ownerExecuted: true,
    dataset: 'v2',
    invoke: async (request) => validOutput(scenarioForRequest(request))
  });
  const v2Validation = reopen.validateEvidenceRun(v2Passing);
  assert.strictEqual(v2Validation.valid, true, v2Validation.errors.join(', '));
  assert.strictEqual(v2Passing.datasetId, reopen.DATASET_V2_ID);
  assert.strictEqual(v2Validation.summary.totalRecords, 20);
  assert.strictEqual(v2Validation.summary.runtimePasses, 20);
  assert.strictEqual(v2Validation.summary.runtimeReliabilityStatus, 'DRIVER_RUNTIME_RELIABILITY_PASS');
  assert.ok(v2Passing.results.every((record) => record.datasetId === reopen.DATASET_V2_ID));
  assert.ok(v2Passing.results.every((record) => record.datasetVersion === 'v2'));

  const mixed = {
    ...v2Passing,
    results: v2Passing.results.map((record, index) => index === 0 ? { ...record, datasetId: 'driver.copilot.contextual_response.runtime_reliability_reopen.v1' } : record)
  };
  const mixedValidation = reopen.validateEvidenceRun(mixed);
  assert.strictEqual(mixedValidation.valid, false);
  assert.ok(mixedValidation.errors.includes('MIXED_DATASET_RECORDS') || mixedValidation.errors.some((error) => error.includes('RECORD_DATASET_MISMATCH')));

  const interceptedAsModel = {
    ...v2Passing,
    results: v2Passing.results.map((record, index) => index === 0 ? { ...record, policyIntercepted: true, responseMode: 'DETERMINISTIC_POLICY' } : record)
  };
  const interceptedValidation = reopen.validateEvidenceRun(interceptedAsModel);
  assert.strictEqual(interceptedValidation.valid, false);
  assert.ok(interceptedValidation.errors.some((error) => error.includes('INTERCEPTED_RECORD_COUNTED_AS_MODEL')));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driver-d2-reopen-'));
  const outputPath = path.join(tmpDir, 'driver-mistral-runtime-evidence-v2.json');
  const writtenPath = reopen.writeEvidenceRun(outputPath, v2Passing);
  const bytes = fs.readFileSync(writtenPath);
  assert.notStrictEqual(bytes[0], 0xff, 'native evidence output must not be UTF-16LE');
  assert.notStrictEqual(bytes[0], 0xfe, 'native evidence output must not be UTF-16BE');
  assert.strictEqual(JSON.parse(bytes.toString('utf8')).datasetId, reopen.DATASET_V2_ID);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function assertNoHostedDefault() {
  const text = fs.readFileSync(path.join(__dirname, 'driver-d2-model-reopen.cjs'), 'utf8');
  assert.ok(text.includes('--owner-executed'));
  assert.ok(text.includes('executeBenchmarkProviderRequest'));
  assert.ok(!text.includes('process.env.OPENAI_API_KEY'));
  assert.ok(!text.includes('process.env.ANTHROPIC_API_KEY'));
  assert.ok(!text.includes('process.env.GEMINI_API_KEY'));
  assert.ok(!text.includes('process.env.MISTRAL_API_KEY'));
}

function assertExtractor() {
  const sample = Buffer.from(`\uFEFFnpm wrapper\n${JSON.stringify({
    schemaVersion: reopen.EVIDENCE_SCHEMA_VERSION,
    hostedCallsExecutedByOwner: true,
    productionRoutingEnabled: false,
    results: []
  })}`, 'utf16le');
  const decoded = extractor.decodeCapture(Buffer.concat([Buffer.from([0xff, 0xfe]), sample]));
  assert.ok(decoded.includes(reopen.EVIDENCE_SCHEMA_VERSION));
  assert.strictEqual(JSON.parse(extractor.findJsonObject(decoded)).schemaVersion, reopen.EVIDENCE_SCHEMA_VERSION);
}

async function main() {
  assertScript('d2-driver-reopen:prepare', 'node scripts/driver-d2-model-reopen.cjs');
  assertScript('d2-driver-reopen:run', 'node scripts/driver-d2-model-reopen.cjs');
  assertScript('d2-driver-reopen:check', 'node scripts/driver-d2-model-reopen.cjs --check');
  assertScript('d2-driver-reopen:extract', 'node scripts/extract-driver-d2-reopen-evidence.cjs');
  assertScript('test:d2-driver-reopen', 'node scripts/check-driver-d2-model-reopen.cjs');
  assertLockedAssignments();
  assertCandidateAdapters();
  assertPlan();
  assertDataset();
  assertRequestConstruction();
  assertRegistryStatus();
  await assertRuntimeEvidenceCapture();
  assertNoHostedDefault();
  assertExtractor();
  console.log('[check-driver-d2-model-reopen] ok');
}

main().catch((error) => {
  console.error(`[check-driver-d2-model-reopen] failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
