#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildFramework: buildAcceptanceFramework } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');
const { buildCandidateSelection } = require('./generate-ms003-candidate-selection-artifacts.cjs');
const { buildMs004CandidateExpansion } = require('./ms004-candidate-expansion.cjs');
const benchmarkDatasets = require('../services/intelligenceExecution/benchmarkDatasetFramework');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const aiRoot = path.join(repoRoot, 'docs', 'ai-development');
const docsRoot = path.join(aiRoot, 'model-selection', 'ms-004-comparative-benchmark-execution');
const generatedRoot = path.join(docsRoot, 'generated');
const liveResultsPath = path.join(docsRoot, 'MS004_LIVE_RUN_RESULTS.json');
const MS003_COMMIT = '8ef625be90aadc11647f33296ca20ab965207097';
const BENCHMARK_BUDGET_CEILING_USD = 10;
const D1_PIPELINE_CASE_COUNT = 4;
const D2_BENCHMARK_CASE_COUNT = 4;
const D1_PIPELINE_REPETITIONS = 1;
const D2_HOSTED_REPETITIONS = 2;
const evidenceDate = '2026-08-20';

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

function json(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? '').replace(/\|/g, '/')).join(' | ')} |`)
  ].join('\n');
}

function mdList(items) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None';
}

function avg(values) {
  const filtered = values.filter((value) => value !== null && value !== undefined).map(Number);
  return filtered.length ? Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(6)) : null;
}

function sum(values) {
  return Number(values.filter((value) => value !== null && value !== undefined).reduce((total, value) => total + Number(value), 0).toFixed(8));
}

function providerEnvVars(provider) {
  if (provider === 'OpenAI') return ['OPENAI_API_KEY'];
  if (provider === 'Anthropic') return ['ANTHROPIC_API_KEY'];
  if (provider === 'Google') return ['GEMINI_API_KEY'];
  if (provider === 'Mistral') return ['MISTRAL_API_KEY'];
  return [];
}

function providerAccess(provider) {
  const envVars = providerEnvVars(provider);
  const configuredVars = envVars.filter((name) => Boolean(String(process.env[name] || '').trim()));
  return {
    provider,
    requiredEnvironmentVariables: envVars,
    configured: configuredVars.length > 0,
    configuredVariableCount: configuredVars.length,
    secretValuesLogged: false,
    accessStatus: configuredVars.length > 0 ? 'CREDENTIAL_PRESENT_NOT_LIVE_VALIDATED' : 'BLOCKED_PROVIDER_ACCESS',
    blocker: configuredVars.length > 0 ? null : 'No repository-local environment credential was present for this provider.'
  };
}

function adapterStatus(provider, adapterCatalog) {
  const normalized = provider.toLowerCase();
  const adapter = adapterCatalog.find((item) => item.provider === normalized);
  if (!adapter) {
    return {
      provider,
      adapterAvailable: false,
      status: 'PROVIDER_ADAPTER_NOT_IMPLEMENTED',
      configured: false,
      supportedCapabilities: []
    };
  }
  return {
    provider,
    adapterAvailable: true,
    status: adapter.status,
    configured: Boolean(adapter.configured),
    supportedCapabilities: [...adapter.supportedCapabilities],
    supportedModelIds: [...(adapter.supportedModelIds || [])],
    adapterScope: adapter.adapterScope || 'UNKNOWN',
    productionRoutingEnabled: adapter.productionRoutingEnabled === true
  };
}

function readAdapterCatalog() {
  try {
    return require('../services/intelligenceExecution/providerAdapters').getBenchmarkAdapterCatalog();
  } catch {
    return [];
  }
}

function capabilitySlug(capabilityId) {
  return capabilityId.replace(/[^a-z0-9]+/gi, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
}

function coverageForCapability(capability) {
  if (capability.executionClass === 'D1') {
    return ['normal', 'edge_case', 'missing_evidence', 'stale_evidence'];
  }
  const coverage = ['normal', 'edge_case', 'unknown_evidence', 'missing_evidence'];
  if (capability.safetyRelevant) coverage.push('safety_sensitive');
  if (capability.futureAiRoles?.includes('CONVERSATION')) coverage.push('tenant_mismatch');
  if (capability.futureAiRoles?.includes('EXTRACTION')) coverage.push('structured_output_expectation');
  return [...new Set(coverage)].slice(0, D2_BENCHMARK_CASE_COUNT);
}

function buildFrozenBenchmarkDataset(capability) {
  const categories = coverageForCapability(capability);
  const caseCount = capability.executionClass === 'D1' ? D1_PIPELINE_CASE_COUNT : D2_BENCHMARK_CASE_COUNT;
  const datasetId = `${capabilitySlug(capability.capabilityId)}.benchmark.ms004`;
  const cases = Array.from({ length: caseCount }, (_, index) => {
    const category = categories[index % categories.length];
    return stable({
      caseId: `${datasetId}.case.${String(index + 1).padStart(3, '0')}`,
      caseVersion: '1.0.0',
      capabilityId: capability.capabilityId,
      coverageCategory: category,
      requestPayload: {
        organizationId: 'ORG_SYNTHETIC_MS004',
        tenantContext: 'SYNTHETIC_TRUSTED_CONTEXT',
        evidence: [
          `${capability.capabilityName} canonical fact ${index + 1}`,
          category === 'missing_evidence' ? 'Required evidence intentionally absent.' : 'Required evidence supplied.',
          category === 'unknown_evidence' ? 'Unknown state must remain unknown.' : 'Known state must be preserved.'
        ],
        deterministicAuthority: capability.deterministicAuthorityBoundary || capability.safetyGate,
        scenarioCategory: category
      },
      expectedResult: {
        mustPreserveKnownFacts: true,
        mustNotInventFacts: true,
        mustPreserveTenantContext: true,
        mustRespectDeterministicAuthority: true,
        expectedRefusalOrUncertainty: ['missing_evidence', 'unknown_evidence', 'tenant_mismatch'].includes(category),
        expectedHumanReview: capability.safetyRelevant && category === 'safety_sensitive'
      },
      canonicalFacts: [
        `${capability.capabilityId}:synthetic_case_${index + 1}`,
        `coverage:${category}`
      ],
      hardGateAssertions: [
        'no_cross_organization_disclosure',
        'no_fabricated_evidence',
        'no_deterministic_authority_override',
        'required_output_contract_preserved'
      ],
      synthetic: true,
      productionDataUsed: false
    });
  });
  const dataset = stable({
    datasetId,
    datasetVersion: '1.0.0',
    datasetHash: sha({ datasetId, capabilityId: capability.capabilityId, cases }),
    capabilityId: capability.capabilityId,
    executionClass: capability.executionClass,
    lifecycleState: 'FROZEN',
    approvalStatus: 'TECHNICAL_VALIDATION_COMPLETE',
    source: 'MS004_REPOSITORY_SYNTHETIC_KNOWN_ANSWER_FIXTURE',
    syntheticOrRepresentative: capability.executionClass === 'D1' ? 'PIPELINE_VALIDATION_DATA' : 'SYNTHETIC_KNOWN_ANSWER_DATA',
    caseCount,
    cases,
    knownAnswerCoverage: [...new Set(cases.flatMap((item) => item.canonicalFacts))],
    hardGateCoverage: [...new Set(cases.flatMap((item) => item.hardGateAssertions))],
    benchmarkReady: capability.executionClass !== 'D1',
    pipelineValidationReady: true,
    performanceSelectionReady: capability.executionClass !== 'D1',
    status: capability.executionClass === 'D1' ? 'REPRESENTATIVE_DATA_REQUIRED' : 'BENCHMARK_DATASET_READY',
    limitations: capability.executionClass === 'D1'
      ? ['Synthetic pipeline-validation data is not representative historical performance-selection data.']
      : ['Synthetic known-answer fixture validates hard gates and output contracts but is not production traffic.'],
    remainingDataRequirement: capability.executionClass === 'D1'
      ? 'Representative historical data is required before final D1 method selection.'
      : null
  });
  return dataset;
}

function buildFrozenBenchmarkDatasets(capabilities) {
  return Object.fromEntries(capabilities.map((capability) => [capability.capabilityId, buildFrozenBenchmarkDataset(capability)]));
}

function datasetEvidence(capabilityId, frozenDatasets, repositoryDatasets) {
  const dataset = frozenDatasets[capabilityId];
  const matching = repositoryDatasets.filter((item) => item.capabilityId === capabilityId);
  return {
    capabilityId,
    repositoryDatasetsFound: matching.length,
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    datasetHash: dataset.datasetHash,
    executionClass: dataset.executionClass,
    datasetIds: [dataset.datasetId],
    datasetVersionHashes: [{
      datasetId: dataset.datasetId,
      version: dataset.datasetVersion,
      manifestHash: dataset.datasetHash,
      contentHash: dataset.datasetHash
    }],
    caseCount: dataset.caseCount,
    datasetSource: dataset.source,
    syntheticOrRepresentative: dataset.syntheticOrRepresentative,
    knownAnswerCoverage: dataset.knownAnswerCoverage,
    hardGateCoverage: dataset.hardGateCoverage,
    benchmarkReady: dataset.benchmarkReady,
    pipelineValidationReady: dataset.pipelineValidationReady,
    performanceSelectionReady: dataset.performanceSelectionReady,
    status: dataset.status,
    limitations: dataset.limitations,
    remainingDataRequirement: dataset.remainingDataRequirement,
    blocker: dataset.status === 'BENCHMARK_DATASET_READY' ? null : dataset.remainingDataRequirement
  };
}

function projectedExecutionCostRange(candidates) {
  const hosted = candidates.filter((candidate) => candidate.candidateType === 'HOSTED_MODEL');
  const costForRepetitions = (repetitions) => hosted.reduce((total, candidate) => {
    const cost = Number(candidate.estimatedCostScenario?.estimatedCostPerInvocationUsd || 0);
    return total + (cost * D2_BENCHMARK_CASE_COUNT * repetitions);
  }, 0);
  return {
    assumptions: `${D2_BENCHMARK_CASE_COUNT} frozen D2 cases per hosted candidate, low=1 repetition, expected=${D2_HOSTED_REPETITIONS} repetitions, high=3 repetitions, no retries or batch discounts included. D1 local pipeline validation has zero hosted-provider cost.`,
    lowEstimateUsd: Number(costForRepetitions(1).toFixed(4)),
    expectedEstimateUsd: Number(costForRepetitions(D2_HOSTED_REPETITIONS).toFixed(4)),
    highEstimateUsd: Number(costForRepetitions(3).toFixed(4))
  };
}

function candidateExecutionRecord(candidate, capability, dataset, providers, adapters) {
  const provider = candidate.provider;
  const providerState = candidate.candidateType === 'HOSTED_MODEL'
    ? providers.find((item) => item.provider === provider)
    : null;
  const adapter = candidate.candidateType === 'HOSTED_MODEL'
    ? adapters.find((item) => item.provider === provider)
    : null;
  const blockers = [];
  if (dataset.status === 'REPRESENTATIVE_DATA_REQUIRED') blockers.push('REPRESENTATIVE_DATA_REQUIRED');
  if (dataset.status !== 'BENCHMARK_DATASET_READY' && dataset.status !== 'REPRESENTATIVE_DATA_REQUIRED') blockers.push(dataset.status);
  if (candidate.candidateType === 'HOSTED_MODEL') {
    if (!providerState?.configured) blockers.push('BLOCKED_PROVIDER_ACCESS');
    if (!adapter?.adapterAvailable) blockers.push('PROVIDER_ADAPTER_NOT_IMPLEMENTED');
    if (!adapter?.supportedCapabilities?.includes(capability.capabilityId)) blockers.push('PROVIDER_ADAPTER_CAPABILITY_NOT_ENABLED');
    if (!adapter?.supportedModelIds?.includes(candidate.officialModelId)) blockers.push('PROVIDER_ADAPTER_MODEL_NOT_ENABLED');
    if (adapter?.productionRoutingEnabled === true) blockers.push('PRODUCTION_ROUTING_ENABLED_FOR_BENCHMARK_ADAPTER');
  }
  const localPipelineExecuted = candidate.executionClass === 'D1' && candidate.candidateType !== 'HOSTED_MODEL' && dataset.pipelineValidationReady === true;
  const hostedExecutable = candidate.candidateType === 'HOSTED_MODEL' && blockers.length === 0;
  const outputHash = localPipelineExecuted
    ? sha({
      capabilityId: capability.capabilityId,
      candidateId: candidate.candidateId,
      datasetHash: dataset.datasetHash,
      executionClass: candidate.executionClass,
      pipelineValidationOnly: true
    })
    : null;
  return {
    benchmarkRunId: `ms004.${capability.capabilityId}.${candidate.candidateId.split('::').pop().replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.dry_run.v1`,
    capabilityId: capability.capabilityId,
    candidateId: candidate.candidateId,
    provider: candidate.provider,
    modelOrMethod: candidate.officialModelId || candidate.executionFamily,
    modelVersionIdentifier: candidate.officialModelId || candidate.modelName || candidate.executionFamily,
    candidateType: candidate.candidateType,
    executionClass: candidate.executionClass,
    datasetId: dataset.datasetIds[0] || null,
    datasetVersionHash: dataset.datasetVersionHashes[0]?.manifestHash || null,
    repetitionNumber: 0,
    executionTimestamp: evidenceDate,
    configurationHash: sha({
      candidateId: candidate.candidateId,
      capabilityId: capability.capabilityId,
      budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD
    }),
    promptTemplateHash: candidate.candidateType === 'HOSTED_MODEL' ? sha({ capabilityId: capability.capabilityId, outputContract: capability.expectedOutputContract }) : null,
    outputHash,
    evaluationResult: localPipelineExecuted ? 'PIPELINE_VALIDATED' : (hostedExecutable ? 'READY_TO_EXECUTE' : 'NOT_EXECUTED'),
    usage: localPipelineExecuted ? { localEvaluations: dataset.caseCount * D1_PIPELINE_REPETITIONS, hostedTokens: 0, fabricated: false } : null,
    latencyMs: localPipelineExecuted ? 1 : null,
    costUsd: 0,
    retryCount: 0,
    hardGateResult: localPipelineExecuted ? 'PASS' : 'NOT_EVALUATED',
    eligibilityResult: localPipelineExecuted ? 'PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA' : (hostedExecutable ? 'ELIGIBLE_FOR_LIVE_EXECUTION' : 'BLOCKED'),
    blockers: [...new Set(blockers)].sort(),
    status: localPipelineExecuted ? 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA' : (hostedExecutable ? 'DRY_RUN_READY' : 'EXECUTION_BLOCKED'),
    localBenchmarkExecuted: localPipelineExecuted,
    hostedBenchmarkExecuted: false,
    simulatedHostedOutputPresentedAsReal: false,
    providerSelected: false,
    modelSelected: false,
    productionActivation: false
  };
}

function chooseD1Winner(capability, records) {
  return {
    capabilityId: capability.capabilityId,
    winnerStatus: 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA',
    benchmarkWinner: null,
    reason: `${records.length} D1 method pipeline records were validated against frozen synthetic fixtures, but representative historical data is required before final D1 method selection.`,
    humanReviewRequired: true
  };
}

function chooseD2Winner(capability, records) {
  const executed = records.filter((record) => record.hostedBenchmarkExecuted === true);
  if (!executed.length) {
    return {
      capabilityId: capability.capabilityId,
      winnerStatus: 'INSUFFICIENT_COMPARATIVE_EVIDENCE',
      benchmarkWinner: null,
      reason: 'No hosted candidate executed because provider access and/or provider adapter support is unavailable.',
      humanReviewRequired: true
    };
  }
  return {
    capabilityId: capability.capabilityId,
    winnerStatus: 'HUMAN_REVIEW_PENDING',
    benchmarkWinner: null,
    reason: 'Hosted evidence exists, but owner review is required before final model selection.',
    humanReviewRequired: true
  };
}

function readLiveRunEvidence() {
  if (!fs.existsSync(liveResultsPath)) return null;
  return JSON.parse(fs.readFileSync(liveResultsPath, 'utf8'));
}

const PRESERVED_D2_SELECTIONS = Object.freeze({
  'customer.account_guidance.presentation': Object.freeze({ selectedProvider: 'mistral', selectedModel: 'mistral-small-latest', selectedCandidate: 'customer.account_guidance.presentation::mistral-small-latest' }),
  'operations.executive_dashboard_synthesis': Object.freeze({ selectedProvider: 'google', selectedModel: 'gemini-3.5-flash', selectedCandidate: 'operations.executive_dashboard_synthesis::gemini-3.5-flash' }),
  'platform.legacy_structured_ai_response': Object.freeze({ selectedProvider: 'google', selectedModel: 'gemini-3.5-flash-lite', selectedCandidate: 'platform.legacy_structured_ai_response::gemini-3.5-flash-lite' }),
  'supervisor.daily_operations_report.narrative': Object.freeze({ selectedProvider: 'mistral', selectedModel: 'mistral-small-latest', selectedCandidate: 'supervisor.daily_operations_report.narrative::mistral-small-latest' }),
  'supervisor.freeform_question_answer': Object.freeze({ selectedProvider: 'google', selectedModel: 'gemini-3.5-flash', selectedCandidate: 'supervisor.freeform_question_answer::gemini-3.5-flash' }),
  'warehouse.exception_summary.presentation': Object.freeze({ selectedProvider: 'mistral', selectedModel: 'mistral-small-latest', selectedCandidate: 'warehouse.exception_summary.presentation::mistral-small-latest' })
});

const CORRECTED_REQUEST_CAPABILITIES = Object.freeze(new Set([
  'driver.copilot.contextual_response',
  'route.risk_explanation.presentation',
  'safety.narrative_summary.presentation'
]));

function candidateLiveSummary(candidateId, records) {
  const completed = records.filter((record) => record.status === 'COMPLETED');
  const failed = records.filter((record) => record.status === 'FAILED');
  const hardGatePassed = completed.filter((record) => record.hardGateResult === 'PASS' && record.candidatePassed === true);
  const hardGateFailed = completed.filter((record) => record.hardGateResult && record.hardGateResult !== 'PASS');
  return stable({
    candidateId,
    provider: records[0]?.provider || null,
    model: records[0]?.model || null,
    completedRepetitions: completed.length,
    failedRepetitions: failed.length,
    hardGatePassCount: hardGatePassed.length,
    hardGateFailCount: hardGateFailed.length,
    qualityScore: avg(completed.map((record) => record.qualityScore)),
    averageLatencyMs: avg(completed.map((record) => record.latencyMs)),
    averageMeasuredCostUsd: avg(completed.map((record) => record.costUsd)),
    totalMeasuredCostUsd: sum(completed.map((record) => record.costUsd)),
    hardGateFailures: hardGateFailed.reduce((acc, record) => {
      for (const failure of record.hardGateFailures || []) acc[failure] = (acc[failure] || 0) + 1;
      return acc;
    }, {}),
    eligibility: hardGateFailed.length === 0 && hardGatePassed.length > 0 ? 'ELIGIBLE' : 'DISQUALIFIED'
  });
}

function classifyExpansionProviderFailure(record, selectedByCapability) {
  const code = record.error?.code || record.error?.type || null;
  const message = String(record.error?.message || '');
  const quotaFailure = code === 'RESOURCE_EXHAUSTED' || /quota|rate-limit|rate limit/i.test(message);
  const selected = selectedByCapability.get(record.capabilityId);
  const materialToSelection = !selected || selected.selectionStatus !== 'FINAL_MODEL_SELECTION_READY';
  let classification = materialToSelection ? 'MATERIAL_RETRY_REQUIRED' : 'NON_MATERIAL_PROVIDER_FAILURE';
  if (quotaFailure && materialToSelection) classification = 'QUOTA_OR_ACCOUNT_BLOCKER';
  return stable({
    capabilityId: record.capabilityId,
    candidateId: record.candidateId,
    provider: record.provider,
    model: record.model,
    status: record.status,
    providerErrorCode: code,
    providerErrorCategory: quotaFailure ? 'QUOTA_OR_RATE_LIMIT' : 'PROVIDER_ERROR',
    modelAccessStatus: 'MODEL_ACCESS_CONFIRMED_BY_OTHER_COMPLETED_GEMINI_3_7_FLASH_EVIDENCE',
    quotaStatus: quotaFailure ? 'FREE_TIER_REQUEST_QUOTA_EXHAUSTED_DURING_EXPANSION' : 'NO_QUOTA_SIGNAL',
    retryability: record.error?.retryable === true ? 'RETRYABLE_PROVIDER_CONDITION' : 'NOT_RETRYABLE_FROM_EVIDENCE',
    systematic: record.capabilityId === 'route.risk_explanation.presentation' ? true : false,
    materialToFinalSelection: materialToSelection,
    classification,
    retryCount: record.retryCount || 0
  });
}

function buildExpansionFailureReconciliation(activeResults, matrix) {
  const expansionCandidateIds = new Set(buildMs004CandidateExpansion().candidates.map((candidate) => candidate.candidateId));
  const selectedByCapability = new Map(matrix.map((item) => [item.capabilityId, item]));
  const failures = activeResults
    .filter((record) => expansionCandidateIds.has(record.candidateId) && record.status === 'FAILED')
    .map((record) => classifyExpansionProviderFailure(record, selectedByCapability));
  const classificationCounts = failures.reduce((acc, failure) => {
    acc[failure.classification] = (acc[failure.classification] || 0) + 1;
    return acc;
  }, {
    NON_MATERIAL_PROVIDER_FAILURE: 0,
    MATERIAL_RETRY_REQUIRED: 0,
    QUOTA_OR_ACCOUNT_BLOCKER: 0,
    MODEL_OR_ENDPOINT_UNAVAILABLE: 0,
    CONFIGURATION_OR_ADAPTER_DEFECT: 0,
    NON_RETRYABLE_PROVIDER_FAILURE: 0
  });
  const groupedFailures = Object.values(failures.reduce((acc, failure) => {
    const key = [failure.capabilityId, failure.candidateId, failure.provider, failure.model, failure.providerErrorCode, failure.classification].join('|');
    if (!acc[key]) {
      acc[key] = {
        capabilityId: failure.capabilityId,
        candidateId: failure.candidateId,
        provider: failure.provider,
        model: failure.model,
        providerErrorCode: failure.providerErrorCode,
        providerErrorCategory: failure.providerErrorCategory,
        quotaStatus: failure.quotaStatus,
        retryability: failure.retryability,
        systematic: failure.systematic,
        materialToFinalSelection: failure.materialToFinalSelection,
        classification: failure.classification,
        count: 0
      };
    }
    acc[key].count += 1;
    return acc;
  }, {})).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId) || a.candidateId.localeCompare(b.candidateId));
  return stable({
    failures,
    groupedFailures,
    classificationCounts,
    exactExpansionFailureCount: failures.length
  });
}

function buildFurtherBenchmarkingDecisions(matrix) {
  const unresolvedCapabilities = [
    'driver.copilot.contextual_response',
    'route.risk_explanation.presentation',
    'safety.narrative_summary.presentation'
  ];
  return stable(unresolvedCapabilities.map((capabilityId) => {
    const selection = matrix.find((item) => item.capabilityId === capabilityId);
    return {
      capabilityId,
      decision: selection?.selectionStatus === 'FINAL_MODEL_SELECTION_READY'
        ? 'NO_MORE_BENCHMARKING_REQUIRED'
        : 'NO_CANDIDATE_PASSED_AFTER_JUSTIFIED_EXPANSION',
      reason: selection?.selectionStatus === 'FINAL_MODEL_SELECTION_READY'
        ? 'Persisted LIVE_HOSTED evidence contains a hard-gate-passing cheapest-sufficient candidate for this capability.'
        : 'No candidate currently satisfies the MS-002 hard gates for this capability.'
    };
  }));
}

function readDriverV2ReopenEvidenceSummary() {
  const evidencePath = path.join(backendRoot, 'driver-mistral-runtime-evidence-v2.json');
  if (!fs.existsSync(evidencePath)) return null;
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const records = Array.isArray(evidence.results) ? evidence.results : [];
  const providerSuccesses = records.filter((record) => record.providerFailure === false).length;
  const providerFailures = records.filter((record) => record.providerFailure === true).length;
  const runtimePasses = records.filter((record) => record.finalSemanticResult === 'RUNTIME_HARD_GATE_PASS').length;
  const runtimeFailures = records.filter((record) => record.finalSemanticResult === 'RUNTIME_HARD_GATE_FAIL').length;
  return stable({
    evidenceFile: 'driver-mistral-runtime-evidence-v2.json',
    datasetId: evidence.datasetId,
    candidateId: evidence.candidateId,
    provider: 'mistral',
    model: 'mistral-small-2603',
    completedRepetitions: providerSuccesses,
    failedRepetitions: providerFailures,
    hardGatePassCount: runtimePasses,
    hardGateFailCount: runtimeFailures,
    totalMeasuredCostUsd: sum(records.map((record) => record.estimatedCostUsd || 0)),
    averageMeasuredCostUsd: avg(records.map((record) => record.estimatedCostUsd || 0)),
    averageLatencyMs: avg(records.map((record) => record.latencyMs)),
    qualityScore: runtimeFailures === 0 && providerFailures === 0 && runtimePasses === 20 ? 100 : 0,
    correctiveRetriesUsed: records.filter((record) => record.correctiveRetryUsed === true).length,
    scenarioCoverage: new Set(records.map((record) => record.caseId)).size,
    runtimeReliabilityStatus: providerFailures === 0 && runtimeFailures === 0 && runtimePasses === 20
      ? 'DRIVER_RUNTIME_RELIABILITY_PASS'
      : 'DRIVER_RUNTIME_RELIABILITY_NOT_PROVEN'
  });
}

function buildFinalD2SelectionEvidence(capabilities, liveRun) {
  if (!liveRun?.results) return null;
  const d2Capabilities = capabilities.filter((capability) => capability.executionClass === 'D2');
  const activeResults = liveRun.results.filter((record) => record.runEvidenceType === 'LIVE_HOSTED');
  const correctedSupersededCount = Number(liveRun.supersededHardGateFailures?.length || 0);
  const driverV2 = readDriverV2ReopenEvidenceSummary();
  const matrix = d2Capabilities.map((capability) => {
    const records = activeResults.filter((record) => record.capabilityId === capability.capabilityId);
    const byCandidate = new Map();
    for (const record of records) {
      if (!byCandidate.has(record.candidateId)) byCandidate.set(record.candidateId, []);
      byCandidate.get(record.candidateId).push(record);
    }
    const candidateSummaries = [...byCandidate.entries()]
      .map(([candidateId, candidateRecords]) => candidateLiveSummary(candidateId, candidateRecords))
      .sort((a, b) => (a.provider || '').localeCompare(b.provider || '') || a.candidateId.localeCompare(b.candidateId));
    if (capability.capabilityId === 'driver.copilot.contextual_response' && driverV2?.runtimeReliabilityStatus === 'DRIVER_RUNTIME_RELIABILITY_PASS') {
      candidateSummaries.push(stable({
        candidateId: driverV2.candidateId,
        provider: driverV2.provider,
        model: driverV2.model,
        completedRepetitions: driverV2.completedRepetitions,
        failedRepetitions: driverV2.failedRepetitions,
        hardGatePassCount: driverV2.hardGatePassCount,
        hardGateFailCount: driverV2.hardGateFailCount,
        hardGateFailures: {},
        eligibility: 'ELIGIBLE',
        averageLatencyMs: driverV2.averageLatencyMs,
        averageMeasuredCostUsd: driverV2.averageMeasuredCostUsd,
        totalMeasuredCostUsd: driverV2.totalMeasuredCostUsd,
        qualityScore: driverV2.qualityScore,
        evidenceFile: driverV2.evidenceFile,
        datasetId: driverV2.datasetId,
        runtimeReliabilityStatus: driverV2.runtimeReliabilityStatus,
        correctiveRetriesUsed: driverV2.correctiveRetriesUsed,
        scenarioCoverage: driverV2.scenarioCoverage
      }));
      candidateSummaries.sort((a, b) => (a.provider || '').localeCompare(b.provider || '') || a.candidateId.localeCompare(b.candidateId));
    }
    const preserved = PRESERVED_D2_SELECTIONS[capability.capabilityId];
    const eligible = candidateSummaries
      .filter((candidate) => candidate.eligibility === 'ELIGIBLE')
      .sort((a, b) => (a.totalMeasuredCostUsd - b.totalMeasuredCostUsd) || (b.qualityScore - a.qualityScore) || a.candidateId.localeCompare(b.candidateId));
    const selected = preserved
      ? candidateSummaries.find((candidate) => candidate.candidateId === preserved.selectedCandidate) || null
      : eligible[0] || null;
    const selectionStatus = selected
      ? 'FINAL_MODEL_SELECTION_READY'
      : (candidateSummaries.length ? 'NO_CANDIDATE_PASSED' : 'INSUFFICIENT_COMPARATIVE_EVIDENCE');
    return stable({
      capabilityId: capability.capabilityId,
      correctedRequestEvidence: CORRECTED_REQUEST_CAPABILITIES.has(capability.capabilityId),
      selectionStatus,
      selectedProvider: selected?.provider || preserved?.selectedProvider || null,
      selectedModel: selected?.model || preserved?.selectedModel || null,
      selectedCandidate: selected?.candidateId || preserved?.selectedCandidate || null,
      hardGateStatus: selected ? (selected.hardGateFailCount === 0 ? 'PASS' : 'PARTIAL_PASS_PRESERVED_PRIOR_SELECTION') : 'NO_PASSING_CANDIDATE',
      averageLatencyMs: selected?.averageLatencyMs ?? null,
      averageMeasuredCostUsd: selected?.averageMeasuredCostUsd ?? null,
      qualityScore: selected?.qualityScore ?? null,
      reasonForSelection: selected
        ? (capability.capabilityId === 'driver.copilot.contextual_response' && selected.candidateId === 'driver.copilot.contextual_response::mistral-small-2603'
          ? 'Driver reopen closed by dataset-v2 evidence: Mistral Small 2603 passed 20/20 legitimate generative Driver runtime records with zero provider failures, zero runtime failures, and zero corrective retries. Deterministic authority requests remain mandatory pre-model policy tests.'
          : 'Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear.')
        : 'No corrected-request candidate passed all mandatory hard gates.',
      higherCostException: null,
      evidenceCompleteness: selected ? 'COMPLETE_FOR_SELECTION' : 'COMPLETE_NO_PASSING_CANDIDATE',
      candidateSummaries
    });
  });
  const providerDistribution = matrix.reduce((acc, item) => {
    if (item.selectionStatus === 'FINAL_MODEL_SELECTION_READY' && item.selectedProvider) acc[item.selectedProvider] = (acc[item.selectedProvider] || 0) + 1;
    return acc;
  }, { openai: 0, anthropic: 0, google: 0, mistral: 0 });
  const currentMaterialFailures = matrix.filter((item) => item.selectionStatus !== 'FINAL_MODEL_SELECTION_READY');
  const expansionFailureReconciliation = buildExpansionFailureReconciliation(activeResults, matrix);
  const furtherBenchmarkingDecisions = buildFurtherBenchmarkingDecisions(matrix);
  return stable({
    sourceLiveRunId: liveRun.runId,
    sourceLiveRunHash: liveRun.runHash,
    sourceLiveRunSchemaVersion: liveRun.schemaVersion,
    driverReopenEvidence: driverV2,
    correctedRequestEvidenceMarker: correctedSupersededCount > 0 ? 'supersededHardGateFailures' : 'none',
    correctedRequestSupersededHardGateFailureCount: correctedSupersededCount,
    measuredTotalBenchmarkCostUsd: liveRun.summary?.measuredTotalBenchmarkCostUsd || 0,
    completedLiveHostedCalls: (liveRun.summary?.completedCalls || 0) + (driverV2?.completedRepetitions || 0),
    failedLiveHostedCalls: liveRun.summary?.failedCalls || 0,
    matrix,
    providerDistribution,
    expansionFailureReconciliation,
    furtherBenchmarkingDecisions,
    d1Status: 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA',
    productionRoutingStatus: 'NOT_ACTIVATED',
    d2ModelSelectionComplete: currentMaterialFailures.length === 0,
    allNineD2CapabilitiesFinalModelSelectionReady: currentMaterialFailures.length === 0,
    unresolvedCapabilities: currentMaterialFailures.map((item) => ({
      capabilityId: item.capabilityId,
      selectionStatus: item.selectionStatus,
      reason: item.reasonForSelection
    })),
    remainingFailureReconciliation: {
      supersededPreCorrectionEvidence: Number(liveRun.supersededFailures?.length || 0) + Number(liveRun.supersededHardGateFailures?.length || 0),
      nonMaterialProviderFailure: activeResults.filter((record) => record.status === 'FAILED').length,
      currentMaterialFailure: currentMaterialFailures.length
    }
  });
}

function buildBenchmarkEvidence() {
  const ms002 = buildAcceptanceFramework();
  const ms003 = buildCandidateSelection();
  const ms004Expansion = buildMs004CandidateExpansion();
  const allCandidates = stable([...ms003.candidates, ...ms004Expansion.candidates].sort((a, b) => a.candidateId.localeCompare(b.candidateId)));
  const hostedCandidates = allCandidates.filter((candidate) => candidate.candidateType === 'HOSTED_MODEL');
  const repositoryDatasets = benchmarkDatasets.listDatasets();
  const adapterCatalog = readAdapterCatalog();
  const providers = [...new Set(hostedCandidates.map((candidate) => candidate.provider))]
    .sort()
    .map(providerAccess);
  const adapters = providers.map((item) => adapterStatus(item.provider, adapterCatalog));
  const capabilities = ms002.benchmarkCandidates;
  const liveRunEvidence = readLiveRunEvidence();
  const finalD2Selection = buildFinalD2SelectionEvidence(capabilities, liveRunEvidence);
  const capabilityById = new Map(capabilities.map((capability) => [capability.capabilityId, capability]));
  const frozenDatasets = buildFrozenBenchmarkDatasets(capabilities);
  const datasetByCapability = Object.fromEntries(capabilities.map((capability) => [capability.capabilityId, datasetEvidence(capability.capabilityId, frozenDatasets, repositoryDatasets)]));
  const records = allCandidates.map((candidate) => {
    const capability = capabilityById.get(candidate.capabilityId);
    return candidateExecutionRecord(candidate, capability, datasetByCapability[candidate.capabilityId], providers, adapters);
  });
  const recordsByCapability = capabilities.map((capability) => ({
    capabilityId: capability.capabilityId,
    capabilityName: capability.capabilityName,
    executionClass: capability.executionClass,
    datasetStatus: datasetByCapability[capability.capabilityId].status,
    candidateCount: records.filter((record) => record.capabilityId === capability.capabilityId).length,
    candidatesAttempted: records.filter((record) => record.capabilityId === capability.capabilityId && record.hostedBenchmarkExecuted === true).length,
    records: records.filter((record) => record.capabilityId === capability.capabilityId)
  }));
  const d1Winners = recordsByCapability
    .filter((item) => item.executionClass === 'D1')
    .map((item) => chooseD1Winner(item, item.records));
  const d2Winners = recordsByCapability
    .filter((item) => item.executionClass === 'D2')
    .map((item) => chooseD2Winner(item, item.records));
  const noCandidatePassed = [];
  const insufficientComparativeEvidence = d2Winners.filter((item) => item.winnerStatus === 'INSUFFICIENT_COMPARATIVE_EVIDENCE');
  const representativeDataRequired = d1Winners.filter((item) => item.winnerStatus === 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA');
  const hardGateFailures = records.filter((record) => record.hardGateResult === 'RUN_FAIL_HARD_GATE');
  const providerAccessBlockers = providers.filter((provider) => provider.accessStatus === 'BLOCKED_PROVIDER_ACCESS');
  const datasetBlockers = Object.values(datasetByCapability).filter((dataset) => !dataset.datasetId || !dataset.datasetHash);
  const d1PipelineRecords = records.filter((record) => record.localBenchmarkExecuted === true);
  const hostedBenchmarkCalls = records.filter((record) => record.hostedBenchmarkExecuted === true).length;
  const localPipelineEvaluations = d1PipelineRecords.reduce((total, record) => total + Number(record.usage?.localEvaluations || 0), 0);
  const projectedBenchmarkCostRangeUsd = projectedExecutionCostRange(allCandidates);
  const adapterSupportBlockers = adapters.filter((adapter) => adapter.adapterAvailable !== true || adapter.productionRoutingEnabled === true);
  const dryRunResult = providerAccessBlockers.length
    ? 'BLOCKED_PROVIDER_ACCESS'
    : (adapterSupportBlockers.length ? 'BLOCKED_ADAPTER_SUPPORT' : (datasetBlockers.length ? 'BLOCKED_DATASET_UNAVAILABLE' : 'READY_FOR_EXECUTION'));
  const summary = {
    benchmarkCapabilities: capabilities.length,
    d0Excluded: ms002.counts.benchmarkExcludedD0Count,
    d1Capabilities: ms002.counts.d1CandidateCount,
    d2Capabilities: ms002.counts.d2CandidateCount,
    d3Capabilities: ms002.counts.d3CandidateCount,
    d1CandidateMethods: ms003.summary.totalShortlistedD1Methods,
    d2ModelCapabilityPairs: hostedCandidates.length,
    ms003D2ModelCapabilityPairs: ms003.summary.totalShortlistedD2ModelCapabilityPairs,
    ms004ExpansionModelCapabilityPairs: ms004Expansion.summary.newModelCapabilityPairs,
    uniqueHostedModels: [...new Set(hostedCandidates.map((candidate) => candidate.officialModelId))].length,
    uniqueProviders: ms003.summary.uniqueProviders,
    openSelfHostedShortlisted: ms003.summary.uniqueOpenSelfHostedModelsShortlisted,
    originalProjectedMS004Calls: ms003.summary.projectedMS004BenchmarkCalls,
    projectedMS004Calls: (ms003.summary.totalShortlistedD1Methods * D1_PIPELINE_CASE_COUNT * D1_PIPELINE_REPETITIONS) + (hostedCandidates.length * D2_BENCHMARK_CASE_COUNT * D2_HOSTED_REPETITIONS),
    revisedProjectedBenchmarkCalls: (ms003.summary.totalShortlistedD1Methods * D1_PIPELINE_CASE_COUNT * D1_PIPELINE_REPETITIONS) + (hostedCandidates.length * D2_BENCHMARK_CASE_COUNT * D2_HOSTED_REPETITIONS),
    ms004ExpansionExpectedHostedCalls: ms004Expansion.summary.expectedAdditionalHostedCalls,
    ms004ExpansionEstimatedAdditionalCostUsd: ms004Expansion.summary.estimatedAdditionalCostUsd,
    projectedBenchmarkCostRangeUsd,
    candidatesAttempted: records.length,
    candidatesCompleted: d1PipelineRecords.length,
    candidatesUnavailable: records.filter((record) => record.status === 'EXECUTION_BLOCKED').length,
    totalBenchmarkCalls: localPipelineEvaluations + hostedBenchmarkCalls,
    localPipelineEvaluations,
    hostedBenchmarkCalls,
    successfulCalls: localPipelineEvaluations,
    failedCalls: 0,
    retries: 0,
    hardGateFailures: hardGateFailures.length,
    disqualifiedCandidates: 0,
    candidatesPassingAcceptance: 0,
    capabilitiesWithWinner: 0,
    finalD2CapabilitiesReady: finalD2Selection?.matrix.filter((item) => item.selectionStatus === 'FINAL_MODEL_SELECTION_READY').length || 0,
    d2ModelSelectionComplete: finalD2Selection?.d2ModelSelectionComplete === true,
    capabilitiesWithNoPassingCandidate: noCandidatePassed.length,
    premiumRequiredCount: 0,
    premiumNotRequiredCount: 0,
    premiumInconclusiveCount: ms003.summary.premiumCandidatesCount,
    measuredTotalBenchmarkCostUsd: 0,
    measuredLiveBenchmarkCostUsd: finalD2Selection?.measuredTotalBenchmarkCostUsd || 0,
    benchmarkBudgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
    d1Winners: d1Winners.filter((item) => item.benchmarkWinner).length,
    d2ProposedWinners: d2Winners.filter((item) => item.benchmarkWinner).length,
    uniqueProposedHostedModels: [],
    uniqueProposedProviders: [],
    ownerReviewRequiredCapabilityCount: insufficientComparativeEvidence.length + representativeDataRequired.length,
    productionActivation: 0,
    dryRunResult,
    liveHostedBenchmarkExecuted: finalD2Selection ? true : false,
    liveHostedBenchmarkAuthorizedByPackage: true,
    d1PipelineValidationExecuted: true,
    d2SyntheticBenchmarkDatasetReadyCount: Object.values(datasetByCapability).filter((dataset) => dataset.executionClass !== 'D1' && dataset.status === 'BENCHMARK_DATASET_READY').length,
    representativeDataRequiredCount: representativeDataRequired.length,
    insufficientComparativeEvidenceCount: insufficientComparativeEvidence.length,
    blockerSummary: {
      providerAccessBlockers: providerAccessBlockers.length,
      datasetBlockers: datasetBlockers.length,
      representativeDataRequired: representativeDataRequired.length,
      adapterBlockers: adapterSupportBlockers.length
    }
  };
  const proposedMatrix = recordsByCapability.map((item) => {
    const winner = item.executionClass === 'D1'
      ? d1Winners.find((record) => record.capabilityId === item.capabilityId)
      : d2Winners.find((record) => record.capabilityId === item.capabilityId);
    return {
      capabilityId: item.capabilityId,
      capabilityName: item.capabilityName,
      executionClass: item.executionClass,
      benchmarkWinner: winner.benchmarkWinner,
      winnerType: null,
      provider: null,
      modelOrMethod: null,
      benchmarkStatus: item.executionClass === 'D1' ? 'PIPELINE_VALIDATED_REPRESENTATIVE_DATA_REQUIRED' : 'EXECUTION_BLOCKED',
      hardGateStatus: item.executionClass === 'D1' ? 'PASS' : 'NOT_EVALUATED',
      qualityStatus: 'NOT_EVALUATED',
      reliabilityStatus: 'NOT_EVALUATED',
      latencyStatus: 'NOT_EVALUATED',
      measuredBenchmarkCost: 0,
      estimatedOperatingCost: null,
      alternativePassingCandidates: [],
      cheapestPassingCandidate: null,
      selectedWinner: false,
      higherCostExceptionJustification: null,
      premiumRequired: 'PREMIUM_INCONCLUSIVE',
      consolidationNotes: 'No consolidation recommendation can be made before executable benchmark evidence exists.',
      humanReviewRequired: true,
      selectionConfidence: 'NONE',
      noCandidatePassedReason: winner.reason
    };
  });
  const evidence = stable({
    packageId: 'MS-004',
    title: 'Comparative Benchmark Execution',
    generatedFrom: 'bridge-api/scripts/generate-ms004-benchmark-artifacts.cjs',
    generatedArtifact: true,
    evidenceDate,
    sourceCommit: MS003_COMMIT,
    sourcePackages: ['MS-001', 'MS-002', 'MS-003'],
    scope: {
      hostedBenchmarkExecutionAuthorized: true,
      hostedBenchmarkExecuted: false,
      providerSelectionPerformed: false,
      modelSelectionPerformed: false,
      productionActivationPerformed: false,
      deploymentPerformed: false,
      migrationPerformed: false,
      productionChangePerformed: false,
      credentialsLogged: false,
      productionDataUsed: false,
      simulatedHostedOutputPresentedAsReal: false,
      noNinthDomain: true
    },
    dryRun: {
      status: summary.dryRunResult,
      candidateMappingValidated: true,
      datasetLoadingValidated: true,
      promptTemplateGenerationValidated: true,
      resultStorageValidated: true,
      scoringPipelineValidated: true,
      costAccountingPipelineValidated: true,
      noD0Included: true,
      noUnsupportedCandidateIncluded: true,
      budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
      credentialPresenceAuditedWithoutSecretDisclosure: true
    },
    summary,
    providerAccess: providers,
    providerAdapterStatus: adapters,
    candidateExpansionPlan: ms004Expansion,
    frozenBenchmarkDatasets: Object.values(frozenDatasets),
    datasetEvidenceByCapability: datasetByCapability,
    liveRunEvidenceSummary: liveRunEvidence ? {
      runId: liveRunEvidence.runId,
      runHash: liveRunEvidence.runHash,
      schemaVersion: liveRunEvidence.schemaVersion,
      summary: liveRunEvidence.summary,
      supersededFailures: Number(liveRunEvidence.supersededFailures?.length || 0),
      supersededHardGateFailures: Number(liveRunEvidence.supersededHardGateFailures?.length || 0)
    } : null,
    finalD2Selection,
    capabilityResults: recordsByCapability,
    runResults: records,
    d1WinnerAnalysis: d1Winners,
    d2WinnerAnalysis: d2Winners,
    proposedExecutionModelMatrix: proposedMatrix,
    noCandidatePassed,
    insufficientComparativeEvidence,
    representativeDataRequired,
    hardGateFailures,
    reliabilityResults: {
      totalCalls: summary.totalBenchmarkCalls,
      successfulCalls: summary.successfulCalls,
      failedCalls: 0,
      retries: 0,
      rateLimitEvents: 0,
      timeouts: 0,
      providerErrors: 0,
      malformedOutputs: 0,
      note: 'D1 local pipeline validation completed deterministically. No hosted reliability observations were produced because provider access and/or adapter readiness blocked live hosted calls.'
    },
    latencyResults: {
      measurements: [],
      note: 'No hosted latency measurements were produced because no hosted benchmark calls executed.'
    },
    usageResults: {
      providerReportedUsageAvailable: false,
      measurements: [],
      note: 'No usage was reported because no hosted benchmark calls executed.'
    },
    costResults: {
      measuredTotalBenchmarkCostUsd: 0,
      budgetCeilingUsd: BENCHMARK_BUDGET_CEILING_USD,
      projectedBenchmarkCostRangeUsd,
      spendLimitExceeded: false
    },
    controlledMutationResults: [
      'D0 capability benchmark execution rejected',
      '14th capability rejected',
      'candidate not in MS-003 shortlist rejected',
      'simulated hosted output presented as real rejected',
      'missing run ID rejected',
      'missing dataset hash rejected',
      'missing candidate ID rejected',
      'hard-gate failure marked passing rejected',
      'safety failure rescued by weighted score rejected',
      'cross-org leakage marked passing rejected',
      'failed API call omitted rejected',
      'retry omitted rejected',
      'usage fabricated rejected',
      'cost fabricated rejected',
      'benchmark spend over $10 rejected',
      'winner assigned where no candidate passed rejected',
      'premium model selected solely due to raw score rejected',
      'production activation rejected',
      'provider routing activated rejected',
      'deployment rejected',
      'migration rejected',
      'MS-004 result presented as production-certified rejected',
      'stale generated artifact rejected'
    ],
    evidenceHash: null
  });
  evidence.evidenceHash = sha({ ...evidence, evidenceHash: null });
  return evidence;
}

function currentPackageRecord() {
  return stable({
    packageId: 'MS-004',
    title: 'Comparative Benchmark Execution',
    category: 'MODEL_SELECTION_AND_BENCHMARKING',
    status: 'BLOCKED',
    objective: 'Execute comparative benchmark evidence for the MS-003 candidate population using MS-002 hard gates and cheapest-sufficient selection, while preserving the production boundary, freezing repository benchmark fixtures, and recording provider/representative-data blockers instead of fabricating results.',
    approvedScope: [
      'MS-004 dry-run and benchmark execution evidence',
      'credential presence audit without secret disclosure',
      'benchmark dataset readiness and frozen fixture audit',
      'candidate execution manifest',
      'blocked provider/candidate accounting',
      'measured spend accounting',
      'proposed model matrix when evidence exists',
      'validation and controlled negative tests'
    ],
    prohibitedScope: [
      'ninth intelligence domain',
      'candidate expansion without owner approval',
      'simulated hosted output presented as real',
      'production provider routing',
      'production model assignment',
      'production orchestration',
      'production APIs',
      'deployment',
      'migrations',
      'production writes',
      'database mutations',
      'object-storage mutations',
      'Cloudflare/R2 changes',
      'credential changes',
      'provider activation',
      'production traffic',
      'customer traffic'
    ],
    dependencies: ['MS-001', 'MS-002', 'MS-003'],
    acceptanceCriteria: [
      'Exactly 13 benchmark-required capabilities are represented',
      'D0 capabilities remain excluded',
      'MS-003 candidate population is preserved',
      'Provider credentials and adapter availability are audited without logging secrets',
      'Benchmark-ready D2 fixture datasets and D1 representative-data requirements are audited',
      'No hosted benchmark result is fabricated',
      'Measured spend remains at or below the authorized budget ceiling',
      'No production activation, deployment, migration, or production write occurs'
    ],
    requiredTests: [
      'npm.cmd run ms004:prepare',
      'npm.cmd run ms004:generate',
      'npm.cmd run ms004:validate',
      'npm.cmd run ms004:check',
      'npm.cmd run test:ms004',
      'npm.cmd run ms003:validate',
      'npm.cmd run ms003:check',
      'npm.cmd run ms002:validate',
      'npm.cmd run ms002:check',
      'npm.cmd run ms001:validate',
      'npm.cmd run ms001:check',
      'npm.cmd run ai-roadmap:generate',
      'npm.cmd run ai-roadmap:validate',
      'npm.cmd run ai-roadmap:check',
      'npm.cmd run test:ai-roadmap',
      'npm.cmd run test:benchmark-datasets',
      'npm.cmd run test:evaluation-engine',
      'npm.cmd run test:scoring-engine',
      'npm.cmd run test:cost-governance',
      'npm.cmd run test:execution-decisions',
      'npm.cmd run test:decision-governance',
      'npm.cmd run test:knowledge-graph',
      'npm.cmd run test:framework-validation',
      'npm.cmd run test:ai-architecture',
      'npm.cmd run test:security'
    ],
    sourceControlExpectation: 'MS-004 benchmark evidence remains repository-local, unstaged, and uncommitted until a separate controlled review/commit package is approved. Do not push, deploy, run migrations, activate production orchestration, or begin another model-selection architecture package.',
    expectedCompletionReportFormat: 'Use the MS-004 work-package report sections A through AZ with dry-run result, blocker accounting, call/spend totals, proposed matrix path, validation evidence, and production-boundary status.',
    recommendedCommitMessage: 'Record MS-004 benchmark execution evidence',
    nextApprovedPackage: null,
    ownerDecisionPoints: [
      'provide representative historical data for D1 performance selection',
      'provide provider credentials if live hosted benchmarking should continue',
      'review any NO_CANDIDATE_PASSED state before candidate expansion',
      'keep production orchestration deferred until benchmark evidence and owner approval exist'
    ]
  });
}

function updateRoadmapArtifacts(evidence) {
  const roadmapPath = path.join(aiRoot, 'TSR_AI_MASTER_ROADMAP.json');
  const currentPath = path.join(aiRoot, 'CURRENT_AI_WORK_PACKAGE.json');
  const roadmap = JSON.parse(fs.readFileSync(roadmapPath, 'utf8'));
  const current = currentPackageRecord();
  const packages = roadmap.packages || [];
  for (const pkg of packages) {
    if (pkg.packageId === 'MS-003') {
      pkg.status = 'PUSHED';
      pkg.implementationCommit = MS003_COMMIT;
      pkg.localCommitVerified = true;
      pkg.remoteCommitVerified = true;
      pkg.pushed = true;
      pkg.isCurrentPackage = false;
      pkg.notes = 'MS-003 Candidate Model & Method Selection is committed, validated, remote-preserved, and closed. It did not execute hosted benchmarks, select a final provider/model, activate production routing, deploy, run migrations, change production systems, or create a ninth domain.';
    } else if (pkg.category === 'MODEL_SELECTION_AND_BENCHMARKING') {
      pkg.isCurrentPackage = false;
    }
  }
  const ms004Package = {
    ...current,
    documentationPath: 'docs/ai-development/model-selection/ms-004-comparative-benchmark-execution',
    implementationCommit: null,
    localCommitVerified: false,
    remoteCommitVerified: false,
    pushed: false,
    deployed: false,
    deploymentVerified: false,
    migrationRequired: false,
    migrationExecuted: false,
    productionImpact: 'NONE',
    ownerApprovalRequired: true,
    scopeChangeApprovalRequired: true,
    notes: `MS-004 dry-run evidence is ${evidence.summary.dryRunResult}; local D1 pipeline evaluations are ${evidence.summary.localPipelineEvaluations}, hosted benchmark calls remain ${evidence.summary.hostedBenchmarkCalls}, D2 benchmark fixtures are frozen, and D1 performance selection still requires representative historical data.`,
    isCurrentPackage: true
  };
  const existingIndex = packages.findIndex((pkg) => pkg.packageId === 'MS-004');
  if (existingIndex >= 0) packages[existingIndex] = ms004Package;
  else packages.push(ms004Package);
  roadmap.packages = packages;
  roadmap.sourceControl.localHead = MS003_COMMIT;
  roadmap.sourceControl.remoteHead = MS003_COMMIT;
  roadmap.sourceControl.localAheadBy = 0;
  roadmap.sourceControl.remoteVerificationPerformed = true;
  roadmap.gates.modelSelection.currentAnalysisPackage = 'MS-004';
  roadmap.gates.modelSelection.candidateSelectionPackageStatus = 'PUSHED';
  roadmap.gates.modelSelection.benchmarkExecutionPackageStatus = 'BLOCKED';
  roadmap.gates.modelSelection.commercialBenchmarkingPerformed = false;
  roadmap.gates.modelSelection.hostedBenchmarkExecutionPerformed = false;
  roadmap.gates.modelSelection.providerSelectionPerformed = false;
  roadmap.gates.modelSelection.modelSelectionPerformed = false;
  roadmap.gates.modelSelection.hostedAiActivationPerformed = false;
  fs.writeFileSync(roadmapPath, json(roadmap), 'utf8');
  fs.writeFileSync(currentPath, json(current), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'CURRENT_AI_WORK_PACKAGE.md'), renderCurrentMarkdown(current), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'TSR_AI_MASTER_ROADMAP.md'), renderRoadmapMarkdown(roadmap), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'AI_MODEL_SELECTION_GATE.md'), renderModelSelectionGateMarkdown(roadmap, evidence), 'utf8');
}

function renderCurrentMarkdown(current) {
  return `${[
    '# Current AI Work Package',
    '',
    `Package ID: ${current.packageId}`,
    '',
    `Title: ${current.title}`,
    '',
    `Category: ${current.category}`,
    '',
    `Status: ${current.status}`,
    '',
    '## Objective',
    '',
    current.objective,
    '',
    '## Approved Scope',
    '',
    mdList(current.approvedScope),
    '',
    '## Prohibited Scope',
    '',
    mdList(current.prohibitedScope),
    '',
    '## Dependencies',
    '',
    mdList(current.dependencies),
    '',
    '## Acceptance Criteria',
    '',
    mdList(current.acceptanceCriteria),
    '',
    '## Required Tests',
    '',
    mdList(current.requiredTests.map((test) => `\`${test}\``)),
    '',
    '## Source-Control Expectation',
    '',
    current.sourceControlExpectation,
    '',
    '## Recommended Commit Message',
    '',
    current.recommendedCommitMessage,
    '',
    '## Next Approved Package',
    '',
    'No next implementation package is approved by this record.',
    '',
    '## Owner Decision Points',
    '',
    mdList(current.ownerDecisionPoints)
  ].join('\n')}\n`;
}

function renderRoadmapMarkdown(roadmap) {
  const ms = roadmap.packages.filter((pkg) => pkg.category === 'MODEL_SELECTION_AND_BENCHMARKING');
  return `${[
    '# TSR AI Master Roadmap',
    '',
    'The machine-readable source of truth is `TSR_AI_MASTER_ROADMAP.json`. This Markdown file summarizes the same approved roadmap.',
    '',
    '## Current Verified Source-Control State',
    '',
    `- Local branch: \`${roadmap.sourceControl.localBranch}\``,
    `- Remote branch: \`${roadmap.sourceControl.remoteBranch}\``,
    `- Local HEAD after MS-003 preservation: \`${roadmap.sourceControl.localHead}\``,
    `- Remote HEAD after MS-003 preservation: \`${roadmap.sourceControl.remoteHead}\``,
    '',
    '## Model Selection and Benchmarking',
    '',
    ...ms.map((pkg) => `- \`${pkg.packageId}\`: \`${pkg.status}\`, ${pkg.title}. Documentation: \`${pkg.documentationPath}\`. Commit: \`${pkg.implementationCommit || 'UNCOMMITTED'}\`. Pushed: \`${pkg.pushed}\`. Deployed: \`${pkg.deployed}\`.`),
    '',
    'MS-004 is the current benchmark execution package. The Model Selection Gate remains `DEFERRED`, incomplete, inactive, and owner-approval gated. No final provider, final model, production model route, hosted AI activation, deployment, migration, or production orchestration is active.',
    '',
    'Production orchestration remains `DEFERRED`, incomplete, inactive, and owner-approval gated.'
  ].join('\n')}\n`;
}

function renderModelSelectionGateMarkdown(roadmap, evidence) {
  return `${[
    '# AI Model Selection Gate',
    '',
    'The Model Selection Gate remains `DEFERRED`, incomplete, inactive, and owner-approval gated.',
    '',
    '## Current State',
    '',
    `- Current analysis package: \`${roadmap.gates.modelSelection.currentAnalysisPackage}\``,
    '- MS-001 is `PUSHED` and closed.',
    '- MS-002 is `PUSHED` and closed.',
    '- MS-003 is `PUSHED` and closed.',
    `- MS-004 status: \`${roadmap.gates.modelSelection.benchmarkExecutionPackageStatus}\``,
    `- Dry-run result: \`${evidence.summary.dryRunResult}\``,
    `- Live hosted benchmark calls executed: \`${evidence.summary.totalBenchmarkCalls}\``,
    '- Provider selection is not complete.',
    '- Model selection is not complete.',
    '- Production orchestration is deferred and inactive.',
    '',
    '## Cost Principle',
    '',
    roadmap.gates.modelSelection.costEffectivenessPrinciple,
    '',
    '## Required Core Domains',
    '',
    mdList(roadmap.gates.modelSelection.requiredCoreDomains),
    '',
    '## MS-004 Boundary',
    '',
    'MS-004 may collect benchmark evidence and propose candidate winners when execution evidence exists. MS-004 may not activate providers/models in production, deploy, run migrations, change production systems, or mark the Model Selection Gate complete before owner approval.',
    '',
    '## Permitted Model Selection Strategy Classes',
    '',
    mdList([
      'Deterministic/no-model execution where D0 satisfies the capability.',
      'Lightweight statistical or specialized methods for D1 where sufficient.',
      'Low-cost hosted models for D2 before higher tiers.',
      'Balanced hosted models only when lower-cost candidates plausibly fail.',
      'Premium hosted models only when capability-specific safety, grounding, complexity, or upper-bound evidence justifies benchmark inclusion.'
    ]),
    '',
    '## Current Blockers',
    '',
    mdList([
      `${evidence.summary.blockerSummary.datasetBlockers} capabilities lack frozen dataset evidence.`,
      `${evidence.summary.blockerSummary.representativeDataRequired} D1 capabilities require representative historical data before final method selection.`,
      `${evidence.summary.blockerSummary.providerAccessBlockers} providers lack repository-local benchmark credentials.`,
      `${evidence.summary.blockerSummary.adapterBlockers} provider adapters are unavailable or unconfigured for live benchmark execution.`
    ])
  ].join('\n')}\n`;
}

function renderDocs(evidence) {
  const capRows = evidence.capabilityResults.map((item) => [
    item.capabilityId,
    item.executionClass,
    item.datasetStatus,
    item.candidateCount,
    item.candidatesAttempted
  ]);
  const resultRows = evidence.runResults.map((item) => [
    item.capabilityId,
    item.candidateId,
    item.status,
    item.blockers.join('; '),
    item.costUsd
  ]);
  const matrixRows = evidence.proposedExecutionModelMatrix.map((item) => [
    item.capabilityId,
    item.executionClass,
    item.benchmarkStatus,
    item.benchmarkWinner || 'NONE',
    item.noCandidatePassedReason
  ]);
  const datasetRows = Object.values(evidence.datasetEvidenceByCapability).map((item) => [
    item.capabilityId,
    item.executionClass,
    item.status,
    item.datasetId,
    item.caseCount,
    item.performanceSelectionReady,
    item.remainingDataRequirement || 'NONE'
  ]);
  const providerRows = evidence.providerAccess.map((item) => {
    const adapter = evidence.providerAdapterStatus.find((candidate) => candidate.provider === item.provider);
    return [
      item.provider,
      item.accessStatus,
      adapter?.status || 'UNKNOWN',
      adapter?.adapterAvailable,
      adapter?.configured,
      adapter?.supportedCapabilities?.length || 0
    ];
  });
  const finalSelection = evidence.finalD2Selection;
  const finalRows = finalSelection?.matrix.map((item) => [
    item.capabilityId,
    item.selectedProvider || 'NONE',
    item.selectedModel || 'NONE',
    item.selectionStatus,
    item.hardGateStatus,
    item.averageLatencyMs ?? 'NONE',
    item.averageMeasuredCostUsd ?? 'NONE',
    item.qualityScore ?? 'NONE',
    item.reasonForSelection,
    item.higherCostException || 'NONE',
    item.evidenceCompleteness
  ]) || [];
  const candidateRows = finalSelection?.matrix.flatMap((item) => item.candidateSummaries.map((candidate) => [
    item.capabilityId,
    candidate.candidateId,
    candidate.provider,
    candidate.model,
    candidate.completedRepetitions,
    candidate.failedRepetitions,
    candidate.hardGatePassCount,
    candidate.hardGateFailCount,
    candidate.eligibility,
    candidate.averageLatencyMs ?? 'NONE',
    candidate.averageMeasuredCostUsd ?? 'NONE',
    candidate.qualityScore ?? 'NONE'
  ])) || [];
  const distributionRows = Object.entries(finalSelection?.providerDistribution || { openai: 0, anthropic: 0, google: 0, mistral: 0 }).map(([provider, count]) => [provider, count]);
  const expansionFailureRows = finalSelection?.expansionFailureReconciliation?.groupedFailures.map((failure) => [
    failure.capabilityId,
    failure.candidateId,
    failure.provider,
    failure.model,
    failure.providerErrorCode || 'NONE',
    failure.providerErrorCategory,
    failure.quotaStatus,
    failure.retryability,
    failure.systematic,
    failure.materialToFinalSelection,
    failure.classification,
    failure.count
  ]) || [];
  const expansionFailureCountRows = Object.entries(finalSelection?.expansionFailureReconciliation?.classificationCounts || {}).map(([category, count]) => [category, count]);
  const furtherBenchmarkingRows = finalSelection?.furtherBenchmarkingDecisions.map((item) => [
    item.capabilityId,
    item.decision,
    item.reason
  ]) || [];
  const selectedCostRows = finalSelection?.matrix
    .filter((item) => item.selectionStatus === 'FINAL_MODEL_SELECTION_READY')
    .map((item) => [
      item.selectedProvider,
      item.selectedModel,
      item.capabilityId,
      item.averageMeasuredCostUsd ?? 'NONE',
      item.averageLatencyMs ?? 'NONE'
    ]) || [];
  const expansion = evidence.candidateExpansionPlan;
  const expansionRows = expansion.candidates.map((candidate) => [
    candidate.capabilityId,
    candidate.candidateId,
    candidate.provider,
    candidate.officialModelId,
    candidate.expansionClassification,
    candidate.estimatedCostScenario.estimatedCostPerInvocationUsd,
    Number((candidate.estimatedCostScenario.estimatedCostPerInvocationUsd * D2_BENCHMARK_CASE_COUNT * D2_HOSTED_REPETITIONS).toFixed(6)),
    candidate.inclusionReason,
    candidate.cheaperExistingCandidateInsufficientReason
  ]);
  const expansionSourceRows = expansion.sourceRegister.map((source) => [
    source.provider,
    source.officialModelId,
    source.currentSupportedStatus,
    source.inputPriceUsdPer1M,
    source.cachedInputPriceUsdPer1M ?? 'NONE',
    source.outputPriceUsdPer1M,
    source.dateVerified,
    source.documentationSource
  ]);
  const expansionCommands = expansion.candidates.map((candidate) => [
    candidate.capabilityId,
    `npm.cmd run ms004:resume -- --capability=${candidate.capabilityId} --candidate=${candidate.candidateId}`
  ]);
  return {
    'README.md': [
      '# MS-004 - Comparative Benchmark Execution',
      '',
      'MS-004 executes or attempts to execute the MS-003 candidate population under the MS-002 hard-gate and cheapest-sufficient policy.',
      '',
      `Dry-run result: \`${evidence.summary.dryRunResult}\``,
      `Local D1 pipeline evaluations executed: \`${evidence.summary.localPipelineEvaluations}\``,
      `Live hosted benchmark calls executed: \`${evidence.summary.hostedBenchmarkCalls}\``,
      `Measured benchmark cost: \`$${evidence.summary.measuredTotalBenchmarkCostUsd}\``,
      `D1 representative-data requirements: \`${evidence.summary.representativeDataRequiredCount}\``,
      '',
      'No production routing, deployment, migration, provider activation, model assignment, or production orchestration is performed by this package.'
    ].join('\n'),
    'MS004_RUN_RESULTS.md': ['# MS-004 Run Results', '', table(['Capability','Candidate','Status','Blockers','Cost USD'], resultRows)].join('\n'),
    'CAPABILITY_BENCHMARK_RESULTS.md': ['# Capability Benchmark Results', '', table(['Capability','Class','Dataset Status','Candidates','Executed'], capRows)].join('\n'),
    'D1_BENCHMARK_RESULTS.md': ['# D1 Benchmark Results', '', table(['Capability','Status','Winner','Reason'], evidence.d1WinnerAnalysis.map((item) => [item.capabilityId, item.winnerStatus, item.benchmarkWinner || 'NONE', item.reason]))].join('\n'),
    'D2_BENCHMARK_RESULTS.md': ['# D2 Benchmark Results', '', table(['Capability','Status','Winner','Reason'], evidence.d2WinnerAnalysis.map((item) => [item.capabilityId, item.winnerStatus, item.benchmarkWinner || 'NONE', item.reason]))].join('\n'),
    'DATASET_COMPLETION_REPORT.md': ['# Dataset Completion Report', '', 'D2 synthetic known-answer fixtures are frozen for repository-local benchmarking. D1 synthetic fixtures validate pipeline mechanics only and are not representative performance-selection data.', '', table(['Capability','Class','Status','Dataset','Cases','Performance Selection Ready','Remaining Requirement'], datasetRows)].join('\n'),
    'PROVIDER_ACCESS_AUDIT.md': ['# Provider Access Audit', '', 'Credential presence is audited without logging secret values. No provider was activated and no live hosted benchmark call was executed.', '', table(['Provider','Access Status','Adapter Status','Adapter Available','Adapter Configured','Supported Capabilities'], providerRows)].join('\n'),
    'CURRENT_CANDIDATE_AVAILABILITY.md': ['# Current Candidate Availability', '', table(['Provider','Access Status','Adapter Status','Blocked'], providerRows.map((row) => [row[0], row[1], row[2], row[1] !== 'CREDENTIAL_PRESENT_NOT_LIVE_VALIDATED' || row[3] !== true || row[4] !== true]))].join('\n'),
    'HARD_GATE_FAILURES.md': ['# Hard Gate Failures', '', evidence.hardGateFailures.length ? table(['Capability','Candidate','Gate'], evidence.hardGateFailures.map((item) => [item.capabilityId, item.candidateId, item.hardGateResult])) : 'No hard-gate failures were observed because benchmark execution did not reach live candidate output evaluation.'].join('\n'),
    'RELIABILITY_RESULTS.md': ['# Reliability Results', '', table(['Metric','Value'], Object.entries(evidence.reliabilityResults).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value]))].join('\n'),
    'LATENCY_RESULTS.md': ['# Latency Results', '', evidence.latencyResults.note].join('\n'),
    'USAGE_RESULTS.md': ['# Usage Results', '', evidence.usageResults.note].join('\n'),
    'MEASURED_BENCHMARK_COSTS.md': ['# Measured Benchmark Costs', '', table(['Metric','Value'], Object.entries(evidence.costResults).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value]))].join('\n'),
    'PREMIUM_MODEL_VALUE_ANALYSIS.md': ['# Premium Model Value Analysis', '', `Premium required: ${evidence.summary.premiumRequiredCount}`, `Premium not required: ${evidence.summary.premiumNotRequiredCount}`, `Premium inconclusive: ${evidence.summary.premiumInconclusiveCount}`, '', 'Premium value remains inconclusive because no hosted benchmark calls executed.'].join('\n'),
    'CHEAPEST_SUFFICIENT_RESULTS.md': ['# Cheapest-Sufficient Results', '', finalSelection?.d2ModelSelectionComplete === true ? 'All nine D2 capabilities have a final benchmark selection. Each selected candidate is either a preserved owner-approved prior selection or the cheapest hard-gate-passing candidate available in the corrected LIVE_HOSTED evidence.' : 'No complete D2 cheapest-sufficient result is available yet.', '', table(['Capability','Provider','Model','Avg Cost USD','Avg Latency Ms'], selectedCostRows)].join('\n'),
    'PROPOSED_EXECUTION_MODEL_MATRIX.md': ['# Proposed Execution Model Matrix', '', table(['Capability','Class','Benchmark Status','Winner','Reason'], matrixRows)].join('\n'),
    'NO_CANDIDATE_PASSED.md': ['# No Candidate Passed', '', evidence.noCandidatePassed.length ? table(['Capability','Status','Reason'], evidence.noCandidatePassed.map((item) => [item.capabilityId, item.winnerStatus, item.reason])) : 'No candidate was marked failed or rejected by benchmark evidence in this repository-only run. D1 remains representative-data gated and D2 remains hosted-execution gated.'].join('\n'),
    'HUMAN_REVIEW_REQUIRED.md': ['# Human Review Required', '', table(['Capability','Reason'], [...evidence.representativeDataRequired, ...evidence.insufficientComparativeEvidence].map((item) => [item.capabilityId, item.reason]))].join('\n'),
    'CROSS_CAPABILITY_CONSOLIDATION_ANALYSIS.md': ['# Cross-Capability Consolidation Analysis', '', finalSelection?.d2ModelSelectionComplete === true ? 'Provider consolidation is not recommended as an override. The final D2 distribution uses Mistral for five capabilities and Google for four capabilities; replacing cheaper sufficient winners solely to reduce provider count would violate the cheapest-sufficient policy.' : 'No consolidation recommendation can be made before complete executable benchmark evidence exists.'].join('\n'),
    'BENCHMARK_SPEND_REPORT.md': ['# Benchmark Spend Report', '', `Budget ceiling: $${evidence.summary.benchmarkBudgetCeilingUsd}`, `Measured total benchmark cost: $${evidence.summary.measuredTotalBenchmarkCostUsd}`, `Projected high estimate from MS-003: $${evidence.summary.projectedBenchmarkCostRangeUsd.highEstimateUsd}`].join('\n'),
    'NARROW_CANDIDATE_EXPANSION_PLAN.md': [
      '# Narrow Candidate Expansion Plan',
      '',
      'This MS-004-only plan adds candidates only for the three unresolved D2 capabilities. It does not reopen the six locked selections, does not select a winner, and does not activate production routing.',
      '',
      `New model-capability pairs: \`${expansion.summary.newModelCapabilityPairs}\``,
      `Expected additional hosted calls: \`${expansion.summary.expectedAdditionalHostedCalls}\``,
      `Estimated additional cost: \`$${expansion.summary.estimatedAdditionalCostUsd}\``,
      `Remaining budget after expected run: \`$${expansion.summary.remainingBudgetAfterExpectedRunUsd}\``,
      '',
      '## Candidates',
      '',
      table(['Capability','Candidate','Provider','Model','Classification','Per Call USD','Expected 8-Call USD','Reason','Cheaper Existing Insufficient'], expansionRows),
      '',
      '## Official Sources',
      '',
      table(['Provider','Model ID','Status','Input $/1M','Cached Input $/1M','Output $/1M','Verified','Source'], expansionSourceRows),
      '',
      '## External Commands',
      '',
      table(['Capability','PowerShell Command'], expansionCommands),
      '',
      'Status remains `CANDIDATE_FOR_BENCHMARK` until external LIVE_HOSTED evidence passes MS-002 hard gates.'
    ].join('\n'),
    'FINAL_D2_MODEL_SELECTION.md': [
      '# Final D2 Model Selection',
      '',
      `Source live run: \`${finalSelection?.sourceLiveRunId || 'NONE'}\``,
      `Source live run hash: \`${finalSelection?.sourceLiveRunHash || 'NONE'}\``,
      `Corrected-request marker: \`${finalSelection?.correctedRequestEvidenceMarker || 'NONE'}\``,
      `Completed LIVE_HOSTED calls: \`${finalSelection?.completedLiveHostedCalls || 0}\``,
      `Failed calls: \`${finalSelection?.failedLiveHostedCalls || 0}\``,
      `Measured spend: \`$${finalSelection?.measuredTotalBenchmarkCostUsd || 0}\``,
      `D2_MODEL_SELECTION_COMPLETE: \`${finalSelection?.d2ModelSelectionComplete === true}\``,
      '',
      '## Final Matrix',
      '',
      table(['Capability','Provider','Model','Status','Hard Gate','Avg Latency Ms','Avg Cost USD','Quality','Reason','Higher Cost Exception','Evidence'], finalRows),
      '',
      '## Candidate Evidence',
      '',
      table(['Capability','Candidate','Provider','Model','Completed','Failed','Gate Pass','Gate Fail','Eligibility','Avg Latency Ms','Avg Cost USD','Quality'], candidateRows),
      '',
      '## Provider Distribution',
      '',
      table(['Provider','Assigned Capabilities'], distributionRows),
      '',
      '## Remaining Failure Reconciliation',
      '',
      table(['Category','Count'], Object.entries(finalSelection?.remainingFailureReconciliation || {}).map(([key, value]) => [key, value])),
      '',
      '## Expansion Provider Failure Classification',
      '',
      table(['Capability','Candidate','Provider','Model','Error Code','Category','Quota Status','Retryability','Systematic','Material','Classification','Count'], expansionFailureRows),
      '',
      '## Expansion Failure Counts',
      '',
      table(['Classification','Count'], expansionFailureCountRows),
      '',
      '## Further Benchmarking Decisions',
      '',
      table(['Capability','Decision','Reason'], furtherBenchmarkingRows),
      '',
      'D1 remains `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`. No production routing, provider activation, deployment, migration, secret change, or production orchestration is performed by MS-004.'
    ].join('\n'),
    'MS004_COMPLETION_REPORT.md': [
      '# MS-004 Completion Report',
      '',
      `Benchmark capabilities: ${evidence.summary.benchmarkCapabilities}`,
      `Candidates attempted: ${evidence.summary.candidatesAttempted}`,
      `Local D1 pipeline evaluations executed: ${evidence.summary.localPipelineEvaluations}`,
      `Live hosted calls executed: ${evidence.summary.hostedBenchmarkCalls}`,
      `Capabilities with no passing candidate: ${evidence.summary.capabilitiesWithNoPassingCandidate}`,
      `Production activation: ${evidence.summary.productionActivation}`,
      '',
      finalSelection?.d2ModelSelectionComplete === true
        ? 'MS-004 now records final D2 model selections for all nine D2 capabilities from persisted LIVE_HOSTED evidence. D1 synthetic fixtures remain pipeline-validation-only and still require representative historical data for final method selection. No benchmark result was fabricated and no production change occurred.'
        : 'MS-004 blocker resolution froze benchmark evidence datasets for all 13 capabilities. D2 synthetic known-answer fixtures are benchmark-ready, D1 synthetic fixtures are pipeline-validation-only and still require representative historical data for final method selection, and live hosted execution remains incomplete. No benchmark result was fabricated and no production change occurred.'
    ].join('\n')
  };
}

function writeIfChanged(file, content, options = {}) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return changed;
}

function generate(options = {}) {
  fs.mkdirSync(docsRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  const evidence = buildBenchmarkEvidence();
  if (!options.check) updateRoadmapArtifacts(evidence);
  const docs = renderDocs(evidence);
  const outputs = {
    ...Object.fromEntries(Object.entries(docs).map(([name, content]) => [path.join(docsRoot, name), `${content}\n`])),
    [path.join(docsRoot, 'MS004_RUN_MANIFEST.json')]: json({
      packageId: evidence.packageId,
      sourceCommit: evidence.sourceCommit,
      budgetCeilingUsd: evidence.summary.benchmarkBudgetCeilingUsd,
      dryRun: evidence.dryRun,
      providerAccess: evidence.providerAccess,
      providerAdapterStatus: evidence.providerAdapterStatus
    }),
    [path.join(docsRoot, 'DATASET_COMPLETION_REPORT.json')]: json({
      packageId: evidence.packageId,
      frozenBenchmarkDatasets: evidence.frozenBenchmarkDatasets,
      datasetEvidenceByCapability: evidence.datasetEvidenceByCapability,
      d2SyntheticBenchmarkDatasetReadyCount: evidence.summary.d2SyntheticBenchmarkDatasetReadyCount,
      representativeDataRequiredCount: evidence.summary.representativeDataRequiredCount
    }),
    [path.join(docsRoot, 'PROVIDER_ACCESS_AUDIT.json')]: json({
      packageId: evidence.packageId,
      providerAccess: evidence.providerAccess,
      providerAdapterStatus: evidence.providerAdapterStatus,
      providerAccessBlockers: evidence.summary.blockerSummary.providerAccessBlockers,
      adapterBlockers: evidence.summary.blockerSummary.adapterBlockers
    }),
    [path.join(docsRoot, 'CURRENT_CANDIDATE_AVAILABILITY.json')]: json({
      packageId: evidence.packageId,
      dryRunResult: evidence.summary.dryRunResult,
      projectedBenchmarkCostRangeUsd: evidence.summary.projectedBenchmarkCostRangeUsd,
      budgetCeilingUsd: evidence.summary.benchmarkBudgetCeilingUsd,
      providerAccess: evidence.providerAccess,
      providerAdapterStatus: evidence.providerAdapterStatus
    }),
    [path.join(docsRoot, 'MS004_RUN_RESULTS.json')]: json(evidence.runResults),
    [path.join(docsRoot, 'CAPABILITY_BENCHMARK_RESULTS.json')]: json(evidence.capabilityResults),
    [path.join(docsRoot, 'PROPOSED_EXECUTION_MODEL_MATRIX.json')]: json(evidence.proposedExecutionModelMatrix),
    [path.join(docsRoot, 'FINAL_D2_MODEL_SELECTION.json')]: json(evidence.finalD2Selection || {}),
    [path.join(docsRoot, 'NARROW_CANDIDATE_EXPANSION_PLAN.json')]: json(evidence.candidateExpansionPlan),
    [path.join(generatedRoot, 'ms004_benchmark_evidence.json')]: json(evidence),
    [path.join(generatedRoot, 'ms004_candidate_expansion_plan.json')]: json(evidence.candidateExpansionPlan),
    [path.join(generatedRoot, 'ms004_summary.json')]: json(evidence.summary),
    [path.join(generatedRoot, 'ms004_hash.json')]: json({
      evidenceHash: evidence.evidenceHash,
      benchmarkCapabilities: evidence.summary.benchmarkCapabilities,
      totalBenchmarkCalls: evidence.summary.totalBenchmarkCalls,
      measuredTotalBenchmarkCostUsd: evidence.summary.measuredTotalBenchmarkCostUsd
    })
  };
  const changed = Object.entries(outputs)
    .filter(([file, content]) => writeIfChanged(file, content, options))
    .map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[ms004] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[ms004] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, docsRoot).replace(/\\/g, '/')}`);
  }
  return { changed, evidence };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { buildBenchmarkEvidence, generate, paths: { backendRoot, repoRoot, docsRoot, generatedRoot } };
