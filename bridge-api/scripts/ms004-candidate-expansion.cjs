#!/usr/bin/env node
const { buildFramework } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');

const verifiedDate = '2026-08-22';
const D2_HOSTED_REPETITIONS = 2;
const D2_BENCHMARK_CASE_COUNT = 4;

const UNRESOLVED_CAPABILITIES = Object.freeze([
  'driver.copilot.contextual_response',
  'route.risk_explanation.presentation',
  'safety.narrative_summary.presentation'
]);

const EXPANSION_SOURCES = Object.freeze({
  openaiGpt56Luna: Object.freeze({
    sourceId: 'openai-gpt-5-6-luna-docs',
    provider: 'OpenAI',
    model: 'GPT-5.6 Luna',
    officialModelId: 'gpt-5.6-luna',
    documentationSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    pricingSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['cost-sensitive GPT-5.6 model', 'structured outputs supported', 'Responses API support'],
    contextWindowTokens: 1050000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 0.2,
    cachedInputPriceUsdPer1M: 0.02,
    outputPriceUsdPer1M: 1.2,
    batchPrice: 'Batch endpoint supported; MS-004 expansion does not assume batch execution.',
    apiConstraints: ['long-context pricing multipliers apply above 272K input tokens', 'text output only for this benchmark'],
    pricingBasis: 'USD per 1M text tokens'
  }),
  googleGemini37Flash: Object.freeze({
    sourceId: 'google-gemini-3-7-flash-docs',
    provider: 'Google',
    model: 'Gemini 3.7 Flash',
    officialModelId: 'gemini-3.7-flash',
    documentationSource: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash',
    pricingSource: 'https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing',
    apiDocumentationSource: 'https://ai.google.dev/gemini-api/docs/structured-output',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['GA workhorse model', 'reliable multi-step execution', 'structured outputs supported'],
    contextWindowTokens: 1048576,
    maxOutputTokens: 65536,
    inputPriceUsdPer1M: 0.75,
    cachedInputPriceUsdPer1M: 0.075,
    outputPriceUsdPer1M: 3.75,
    batchPrice: 'Flex/Batch pricing is lower; MS-004 expansion assumes standard requests.',
    apiConstraints: ['introductory pricing through 2026-12-31', 'structured output supports a JSON Schema subset'],
    pricingBasis: 'USD per 1M tokens on Google pricing page'
  }),
  anthropicSonnet5: Object.freeze({
    sourceId: 'anthropic-claude-sonnet-5-docs',
    provider: 'Anthropic',
    model: 'Claude Sonnet 5',
    officialModelId: 'claude-sonnet-5',
    documentationSource: 'https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5',
    pricingSource: 'https://www.anthropic.com/research/claude-sonnet-5',
    apiDocumentationSource: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['drop-in upgrade from Sonnet 4.6', 'best combination of speed and intelligence', 'lower undesirable behavior rate than Sonnet 4.6'],
    contextWindowTokens: 1000000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 2,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: 10,
    batchPrice: 'Not assumed in MS-004 expansion.',
    apiConstraints: ['manual extended thinking is unsupported', 'non-default sampling parameters return 400'],
    pricingBasis: 'Introductory USD per 1M tokens through 2026-08-31'
  }),
  mistralMedium35: Object.freeze({
    sourceId: 'mistral-medium-3-5-docs',
    provider: 'Mistral',
    model: 'Mistral Medium 3.5',
    officialModelId: 'mistral-medium-3-5',
    documentationSource: 'https://docs.mistral.ai/models/mistral-medium-3-5-26-04',
    pricingSource: 'https://docs.mistral.ai/inference/pricing',
    apiDocumentationSource: 'https://docs.mistral.ai/models/mistral-medium-3-5-26-04',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['frontier-class multimodal model', 'structured outputs support', 'function calling support'],
    contextWindowTokens: 256000,
    maxOutputTokens: null,
    inputPriceUsdPer1M: 1.5,
    cachedInputPriceUsdPer1M: 0.15,
    outputPriceUsdPer1M: 7.5,
    batchPrice: 'Batch endpoint exists; MS-004 expansion assumes standard requests.',
    apiConstraints: ['higher output price than Mistral Small 4', 'model alias resolves to the current Medium 3.5 release'],
    pricingBasis: 'USD per 1M API tokens'
  })
});

const EXPANSION_DEFINITIONS = Object.freeze([
  Object.freeze({
    capabilityId: 'driver.copilot.contextual_response',
    sourceId: 'openaiGpt56Luna',
    classification: 'LOWER-COST_STRONGER_CANDIDATE_NEEDED',
    inputTokens: 3000,
    outputTokens: 500,
    inclusionReason: 'Cheapest new current OpenAI candidate with structured-output support; tests whether the newer GPT-5.6 low-cost tier follows the driver response contract better than the failed GPT-5 nano/mini/GPT-5 ladder.',
    cheaperInsufficientReason: 'GPT-5 nano, GPT-5 mini, GPT-5, and Claude Haiku 4.5 each missed required driver output fields in all 8 corrected-request repetitions.',
    expectedCostImpact: 'Low'
  }),
  Object.freeze({
    capabilityId: 'driver.copilot.contextual_response',
    sourceId: 'googleGemini37Flash',
    classification: 'PROVIDER-DIVERSITY_CANDIDATE_NEEDED',
    inputTokens: 3000,
    outputTokens: 500,
    inclusionReason: 'Adds one current Google candidate with documented structured-output support and stronger multi-step reliability for driver-facing contextual conversation.',
    cheaperInsufficientReason: 'No Google candidate was tested for driver copilot, and all lower-cost OpenAI/Anthropic corrected-request candidates failed the same hard gates.',
    expectedCostImpact: 'Moderate'
  }),
  Object.freeze({
    capabilityId: 'route.risk_explanation.presentation',
    sourceId: 'googleGemini37Flash',
    classification: 'PROVIDER-DIVERSITY_CANDIDATE_NEEDED',
    inputTokens: 2500,
    outputTokens: 500,
    inclusionReason: 'Adds a current Google structured-output candidate for route-risk explanation after OpenAI and Anthropic candidates failed to preserve required output fields.',
    cheaperInsufficientReason: 'GPT-5 nano, GPT-5, and Claude Haiku 4.5 all failed 8/8 corrected-request route hard gates.',
    expectedCostImpact: 'Moderate'
  }),
  Object.freeze({
    capabilityId: 'route.risk_explanation.presentation',
    sourceId: 'mistralMedium35',
    classification: 'PREMIUM_CANDIDATE_JUSTIFIED',
    inputTokens: 2500,
    outputTokens: 500,
    inclusionReason: 'Adds a stronger Mistral candidate because Mistral Small produced the cheapest sufficient selections for adjacent presentation capabilities but was not tested for route risk.',
    cheaperInsufficientReason: 'Mistral Small was not part of the route shortlist, while the tested cheaper OpenAI/Anthropic candidates all failed mandatory gates.',
    expectedCostImpact: 'Moderate'
  }),
  Object.freeze({
    capabilityId: 'safety.narrative_summary.presentation',
    sourceId: 'anthropicSonnet5',
    classification: 'PREMIUM_CANDIDATE_JUSTIFIED',
    inputTokens: 3500,
    outputTokens: 650,
    inclusionReason: 'Direct upgrade from the near-pass Claude Sonnet 4.6 result, which passed 4/8 corrected-request repetitions and is the closest existing evidence.',
    cheaperInsufficientReason: 'Claude Sonnet 4.6 partially passed but still missed required safety fields in 4/8 repetitions; OpenAI GPT-5 mini and GPT-5 failed all 8.',
    expectedCostImpact: 'Moderate'
  }),
  Object.freeze({
    capabilityId: 'safety.narrative_summary.presentation',
    sourceId: 'googleGemini37Flash',
    classification: 'PROVIDER-DIVERSITY_CANDIDATE_NEEDED',
    inputTokens: 3500,
    outputTokens: 650,
    inclusionReason: 'Adds one non-Anthropic current structured-output candidate for safety narrative comparison without selecting a winner from documentation alone.',
    cheaperInsufficientReason: 'OpenAI lower-cost candidates failed all corrected-request safety gates and no Google safety candidate has been tested.',
    expectedCostImpact: 'Moderate'
  })
]);

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

function source(sourceId) {
  return EXPANSION_SOURCES[sourceId];
}

function costScenario(sourceId, inputTokens, outputTokens) {
  const s = source(sourceId);
  const estimatedCostPerInvocationUsd = (inputTokens / 1_000_000) * s.inputPriceUsdPer1M + (outputTokens / 1_000_000) * s.outputPriceUsdPer1M;
  return stable({
    name: 'MS004_NARROW_EXPANSION',
    assumption: `${inputTokens} input tokens and ${outputTokens} output tokens; estimate only, not measured production usage.`,
    inputTokens,
    outputTokens,
    estimatedCostPerInvocationUsd: Number(estimatedCostPerInvocationUsd.toFixed(6)),
    estimatedCostPer1000InvocationsUsd: Number((estimatedCostPerInvocationUsd * 1000).toFixed(4))
  });
}

function candidate(capability, definition) {
  const s = source(definition.sourceId);
  return stable({
    capabilityId: capability.capabilityId,
    capabilityName: capability.capabilityName,
    executionClass: capability.executionClass,
    capabilityType: capability.safetyRelevant ? 'safety_adjacent_grounded_presentation' : 'grounded_operational_presentation',
    candidateId: `${capability.capabilityId}::${s.officialModelId}`,
    candidateType: 'HOSTED_MODEL',
    executionFamily: 'general_purpose_structured_generation',
    provider: s.provider,
    modelName: s.model,
    officialModelId: s.officialModelId,
    modelTier: definition.classification.includes('PREMIUM') ? 'PREMIUM_EXPANSION' : 'NARROW_EXPANSION',
    hostedOrLocal: 'HOSTED',
    benchmarkEligible: true,
    inclusionReason: definition.inclusionReason,
    exclusionReason: null,
    premiumEntryJustification: definition.classification.includes('PREMIUM') ? definition.inclusionReason : null,
    structuredOutputSupport: 'SUPPORTED_BY_OFFICIAL_DOCS_OR_JSON_MODE',
    toolCallingSupport: 'SUPPORTED_OR_NOT_REQUIRED_FOR_MS004',
    contextAdequacy: s.contextWindowTokens ? `ADEQUATE_FOR_MS002_DATASETS_${s.contextWindowTokens}_TOKENS` : 'LIKELY_ADEQUATE_CONTEXT_LIMIT_NOT_NUMERICALLY_RECORDED',
    expectedLatencyClass: 'INTERACTIVE_OR_BATCH_DEPENDING_ON_CAPABILITY',
    pricingVerified: true,
    pricingVerifiedDate: s.dateVerified,
    inputPrice: s.inputPriceUsdPer1M,
    outputPrice: s.outputPriceUsdPer1M,
    cachedInputPrice: s.cachedInputPriceUsdPer1M,
    batchPrice: s.batchPrice,
    estimatedCostScenario: costScenario(definition.sourceId, definition.inputTokens, definition.outputTokens),
    integrationComplexity: s.provider === 'OpenAI' ? 'LOW' : 'MEDIUM',
    privacyNotes: `${s.provider} hosted API facts recorded separately; TSR tenant isolation remains server responsibility.`,
    reliabilityNotes: 'Must pass MS-002 reliability, grounding, schema, and fallback gates before any selection.',
    keyConstraints: s.apiConstraints,
    sourceReferences: [s.documentationSource, s.pricingSource, s.apiDocumentationSource],
    candidateStatus: 'CANDIDATE_FOR_BENCHMARK',
    providerSelected: false,
    modelSelected: false,
    finalWinner: false,
    hostedBenchmarkExecuted: false,
    productionAssignment: false,
    multiCapabilityCandidate: true,
    expansionClassification: definition.classification,
    cheaperExistingCandidateInsufficientReason: definition.cheaperInsufficientReason,
    expectedCostImpact: definition.expectedCostImpact
  });
}

function buildMs004CandidateExpansion() {
  const framework = buildFramework();
  const capabilities = new Map(framework.benchmarkCandidates.map((capability) => [capability.capabilityId, capability]));
  const candidates = EXPANSION_DEFINITIONS.map((definition) => candidate(capabilities.get(definition.capabilityId), definition));
  const estimatedAdditionalCost = candidates.reduce((total, item) => {
    return total + (Number(item.estimatedCostScenario.estimatedCostPerInvocationUsd || 0) * D2_BENCHMARK_CASE_COUNT * D2_HOSTED_REPETITIONS);
  }, 0);
  return stable({
    packageId: 'MS-004-NARROW-D2-CANDIDATE-EXPANSION',
    status: 'READY_FOR_EXTERNAL_LIVE_BENCHMARK_EXECUTION',
    generatedArtifact: true,
    evidenceDate: verifiedDate,
    scope: {
      onlyCapabilities: UNRESOLVED_CAPABILITIES,
      productionRoutingEnabled: false,
      modelSelectionPerformed: false,
      hostedCallsExecutedByCodex: false,
      d1SelectionPerformed: false
    },
    sourceRegister: Object.values(EXPANSION_SOURCES),
    candidates,
    candidatesByCapability: Object.fromEntries(UNRESOLVED_CAPABILITIES.map((capabilityId) => [
      capabilityId,
      candidates.filter((item) => item.capabilityId === capabilityId)
    ])),
    summary: {
      unresolvedCapabilities: UNRESOLVED_CAPABILITIES.length,
      newModelCapabilityPairs: candidates.length,
      expectedAdditionalHostedCalls: candidates.length * D2_BENCHMARK_CASE_COUNT * D2_HOSTED_REPETITIONS,
      estimatedAdditionalCostUsd: Number(estimatedAdditionalCost.toFixed(6)),
      budgetCeilingUsd: 10,
      currentMeasuredSpendUsd: 1.3376082,
      remainingBudgetAfterExpectedRunUsd: Number((10 - 1.3376082 - estimatedAdditionalCost).toFixed(6))
    }
  });
}

module.exports = {
  buildMs004CandidateExpansion,
  EXPANSION_DEFINITIONS,
  EXPANSION_SOURCES,
  UNRESOLVED_CAPABILITIES
};
