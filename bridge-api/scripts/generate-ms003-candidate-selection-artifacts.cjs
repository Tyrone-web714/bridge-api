#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildRegistry, stable } = require('./generate-ms001-capability-classification-artifacts.cjs');
const { buildFramework } = require('./generate-ms002-benchmark-acceptance-artifacts.cjs');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const aiRoot = path.join(repoRoot, 'docs', 'ai-development');
const docsRoot = path.join(aiRoot, 'model-selection', 'ms-003-candidate-model-method-selection');
const generatedRoot = path.join(docsRoot, 'generated');
const verifiedDate = '2026-08-20';

const MS002_COMMIT = '9c68894de9609c8f884a11c31be0e45eb44b058a';

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
  return items.map((item) => `- ${item}`).join('\n');
}

const SOURCES = Object.freeze({
  openaiGpt5Nano: {
    sourceId: 'openai-gpt-5-nano-docs',
    provider: 'OpenAI',
    model: 'GPT-5 nano',
    officialModelId: 'gpt-5-nano',
    documentationSource: 'https://developers.openai.com/api/docs/models/gpt-5-nano',
    pricingSource: 'https://developers.openai.com/api/docs/models/gpt-5-nano',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models/gpt-5-nano',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['fastest and most cost-efficient GPT-5 version', 'summarization and classification fit', 'structured outputs supported'],
    contextWindowTokens: 400000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 0.05,
    cachedInputPriceUsdPer1M: 0.005,
    outputPriceUsdPer1M: 0.4,
    batchPrice: 'Batch API supported; explicit discount not assumed in MS-003.',
    apiConstraints: ['text input/output', 'image input only', 'reasoning token support'],
    pricingBasis: 'USD per 1M text tokens'
  },
  openaiGpt5Mini: {
    sourceId: 'openai-gpt-5-mini-docs',
    provider: 'OpenAI',
    model: 'GPT-5 mini',
    officialModelId: 'gpt-5-mini',
    documentationSource: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    pricingSource: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['cost-efficient GPT-5 version', 'well-defined task fit', 'function calling and structured outputs supported'],
    contextWindowTokens: 400000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 0.25,
    cachedInputPriceUsdPer1M: 0.025,
    outputPriceUsdPer1M: 2,
    batchPrice: 'Batch API supported; explicit discount not assumed in MS-003.',
    apiConstraints: ['text input/output', 'image input only', 'reasoning token support'],
    pricingBasis: 'USD per 1M text tokens'
  },
  openaiGpt5: {
    sourceId: 'openai-gpt-5-docs',
    provider: 'OpenAI',
    model: 'GPT-5',
    officialModelId: 'gpt-5',
    documentationSource: 'https://developers.openai.com/api/docs/models/gpt-5',
    pricingSource: 'https://developers.openai.com/api/docs/models/gpt-5',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models/gpt-5',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED_PREVIOUS_MODEL',
    keyCapabilityClaims: ['reasoning and coding across domains', 'function calling and structured outputs supported', 'upper-bound comparison candidate'],
    contextWindowTokens: 400000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 1.25,
    cachedInputPriceUsdPer1M: 0.125,
    outputPriceUsdPer1M: 10,
    batchPrice: 'Batch API supported; explicit discount not assumed in MS-003.',
    apiConstraints: ['text input/output', 'image input only', 'reasoning token support'],
    pricingBasis: 'USD per 1M text tokens'
  },
  anthropicHaiku45: {
    sourceId: 'anthropic-claude-haiku-4-5-docs',
    provider: 'Anthropic',
    model: 'Claude Haiku 4.5',
    officialModelId: 'claude-haiku-4-5',
    documentationSource: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    pricingSource: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    apiDocumentationSource: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['fastest current Claude model', 'near-frontier intelligence', 'structured outputs generally available'],
    contextWindowTokens: 200000,
    maxOutputTokens: 64000,
    inputPriceUsdPer1M: 1,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: 5,
    batchPrice: 'Not used by MS-003.',
    apiConstraints: ['text and image input', 'text output', 'structured output schema restrictions apply'],
    pricingBasis: 'USD per 1M tokens'
  },
  anthropicSonnet46: {
    sourceId: 'anthropic-claude-sonnet-4-6-docs',
    provider: 'Anthropic',
    model: 'Claude Sonnet 4.6',
    officialModelId: 'claude-sonnet-4-6',
    documentationSource: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    pricingSource: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    apiDocumentationSource: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['best combination of speed and intelligence in current Claude comparison', '1M token context', 'structured outputs generally available'],
    contextWindowTokens: 1000000,
    maxOutputTokens: 64000,
    inputPriceUsdPer1M: 3,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: 15,
    batchPrice: 'Not used by MS-003.',
    apiConstraints: ['text and image input', 'text output', 'structured output schema restrictions apply'],
    pricingBasis: 'USD per 1M tokens'
  },
  googleFlashLite35: {
    sourceId: 'google-gemini-3-5-flash-lite-docs',
    provider: 'Google',
    model: 'Gemini 3.5 Flash-Lite',
    officialModelId: 'gemini-3.5-flash-lite',
    documentationSource: 'https://ai.google.dev/gemini-api/docs/models',
    pricingSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    apiDocumentationSource: 'https://ai.google.dev/gemini-api/docs/structured-output',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['fastest and most cost-effective Gemini 3.5 model', 'high-throughput fit', 'structured outputs support JSON Schema subset'],
    contextWindowTokens: null,
    maxOutputTokens: null,
    inputPriceUsdPer1M: 0.3,
    cachedInputPriceUsdPer1M: 0.03,
    outputPriceUsdPer1M: 2.5,
    batchPrice: 'Batch pricing listed as $0.15 input / $1.25 output per 1M tokens; MS-003 does not assume batch execution.',
    apiConstraints: ['paid tier data not used to improve products', 'schema subset applies'],
    pricingBasis: 'USD per 1M text/image/video tokens on paid tier'
  },
  googleFlash35: {
    sourceId: 'google-gemini-3-5-flash-docs',
    provider: 'Google',
    model: 'Gemini 3.5 Flash',
    officialModelId: 'gemini-3.5-flash',
    documentationSource: 'https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5',
    pricingSource: 'https://ai.google.dev/gemini-api/docs/pricing',
    apiDocumentationSource: 'https://ai.google.dev/gemini-api/docs/structured-output',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['GA stable scaled production model', '1M token context', 'structured outputs and function calling support'],
    contextWindowTokens: 1000000,
    maxOutputTokens: 65000,
    inputPriceUsdPer1M: 1.5,
    cachedInputPriceUsdPer1M: 0.15,
    outputPriceUsdPer1M: 9,
    batchPrice: 'Batch listed at $0.75 input / $4.50 output per 1M tokens for standard text mode.',
    apiConstraints: ['thinking levels affect cost/latency', 'paid tier data not used to improve products'],
    pricingBasis: 'USD per 1M tokens on paid tier'
  },
  mistralSmall: {
    sourceId: 'mistral-small-latest-docs',
    provider: 'Mistral',
    model: 'Mistral Small 4',
    officialModelId: 'mistral-small-latest',
    documentationSource: 'https://docs.mistral.ai/models/model-cards/mistral-small-4-0-26-03',
    pricingSource: 'https://mistral.ai/pricing/api/',
    apiDocumentationSource: 'https://docs.mistral.ai/models/model-selection-guide',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED',
    keyCapabilityClaims: ['multimodal lightweight model', 'structured outputs listed in model docs', 'Apache 2.0 weights available for Mistral Small 4 family'],
    contextWindowTokens: 256000,
    maxOutputTokens: null,
    inputPriceUsdPer1M: 0.15,
    cachedInputPriceUsdPer1M: 0.015,
    outputPriceUsdPer1M: 0.6,
    batchPrice: 'Mistral pricing page states batch processing is 50 percent discounted.',
    apiConstraints: ['model alias may resolve to latest compatible version', 'open-weight deployment has separate operational burden'],
    pricingBasis: 'USD per 1M API tokens'
  },
  openaiGpt56Luna: {
    sourceId: 'openai-gpt-5-6-luna-docs',
    provider: 'OpenAI',
    model: 'GPT-5.6 Luna',
    officialModelId: 'gpt-5.6-luna',
    documentationSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    pricingSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED_REFERENCE_ONLY',
    keyCapabilityClaims: ['cost-sensitive GPT-5.6 model', '1.05M context window', 'structured outputs supported'],
    contextWindowTokens: 1050000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 0.2,
    cachedInputPriceUsdPer1M: 0.02,
    outputPriceUsdPer1M: 1.2,
    batchPrice: 'Batch endpoint supported; MS-003 does not assume batch execution.',
    apiConstraints: ['prompts with more than 272K input tokens use long-context pricing multipliers', 'cache writes billed at 1.25x uncached input token rate'],
    pricingBasis: 'USD per 1M text tokens'
  },
  openaiGpt56Terra: {
    sourceId: 'openai-gpt-5-6-terra-docs',
    provider: 'OpenAI',
    model: 'GPT-5.6 Terra',
    officialModelId: 'gpt-5.6-terra',
    documentationSource: 'https://developers.openai.com/api/docs/models',
    pricingSource: 'https://developers.openai.com/api/docs/models',
    apiDocumentationSource: 'https://developers.openai.com/api/docs/models',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'CURRENT_SUPPORTED_REFERENCE_ONLY',
    keyCapabilityClaims: ['balanced GPT-5.6 model', '1.05M context window', 'function/tool support listed in model catalog'],
    contextWindowTokens: 1050000,
    maxOutputTokens: 128000,
    inputPriceUsdPer1M: 2,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: 12,
    batchPrice: 'Batch endpoint availability depends on account/model access; MS-003 does not assume batch execution.',
    apiConstraints: ['higher cost than current low-cost OpenAI candidates', 'not needed for bounded MS-003 candidate pool before MS-004'],
    pricingBasis: 'USD per 1M text tokens'
  },
  qwen332b: {
    sourceId: 'qwen3-32b-model-card',
    provider: 'Qwen',
    model: 'Qwen3-32B',
    officialModelId: 'Qwen/Qwen3-32B',
    documentationSource: 'https://huggingface.co/Qwen/Qwen3-32B',
    pricingSource: 'SELF_HOSTED_NO_API_LIST_PRICE',
    apiDocumentationSource: 'https://qwenlm.github.io/blog/qwen3/',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'OPEN_WEIGHT_REFERENCE',
    keyCapabilityClaims: ['Apache 2.0 license', '32B dense model', '128K context according to Qwen release notes'],
    contextWindowTokens: 128000,
    maxOutputTokens: null,
    inputPriceUsdPer1M: null,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: null,
    batchPrice: null,
    apiConstraints: ['self-hosted cost depends on hardware/serving stack', 'no TSR runtime integration exists'],
    pricingBasis: 'No API list price; TCO must include hardware and operations.'
  },
  llama4Scout: {
    sourceId: 'meta-llama-4-scout-model-card',
    provider: 'Meta',
    model: 'Llama 4 Scout',
    officialModelId: 'Llama-4-Scout-17B-16E',
    documentationSource: 'https://github.com/meta-llama/llama-models/blob/main/models/llama4/MODEL_CARD.md',
    pricingSource: 'SELF_HOSTED_NO_API_LIST_PRICE',
    apiDocumentationSource: 'https://ai.meta.com/llama/get-started/',
    dateVerified: verifiedDate,
    currentSupportedStatus: 'OPEN_WEIGHT_REFERENCE',
    keyCapabilityClaims: ['17B activated MoE', '10M context model card claim', 'single H100 efficiency with quantization according to Meta documentation'],
    contextWindowTokens: 10000000,
    maxOutputTokens: null,
    inputPriceUsdPer1M: null,
    cachedInputPriceUsdPer1M: null,
    outputPriceUsdPer1M: null,
    batchPrice: null,
    apiConstraints: ['custom Llama 4 Community License', 'self-hosted cost depends on GPU availability and serving stack'],
    pricingBasis: 'No API list price; TCO must include hardware and operations.'
  }
});

const SOURCE_DISCREPANCIES = Object.freeze([
  {
    provider: 'OpenAI',
    model: 'GPT-5.6 Luna/Terra',
    status: 'CURRENT_INFORMATION_VERIFIED_REFERENCE_ONLY',
    dateVerified: verifiedDate,
    issue: 'OpenAI API model documentation now verifies current API model IDs and standard pricing for GPT-5.6 Luna/Terra.',
    handling: 'Kept reference-only/screened-out for this MS-003 commit to avoid benchmark inflation; reconsider only through a separately approved candidate-substitution decision before MS-004 execution.'
  }
]);

function source(id) {
  return SOURCES[id];
}

function pricing(sourceId) {
  const s = source(sourceId);
  return {
    pricingVerified: Number.isFinite(s.inputPriceUsdPer1M) && Number.isFinite(s.outputPriceUsdPer1M),
    pricingVerifiedDate: s.dateVerified,
    pricingBasis: s.pricingBasis,
    inputPrice: s.inputPriceUsdPer1M,
    outputPrice: s.outputPriceUsdPer1M,
    cachedInputPrice: s.cachedInputPriceUsdPer1M,
    batchPrice: s.batchPrice,
    sourceReferences: [s.documentationSource, s.pricingSource, s.apiDocumentationSource]
  };
}

function costScenario(sourceId, inputTokens, outputTokens) {
  const s = source(sourceId);
  if (!Number.isFinite(s.inputPriceUsdPer1M) || !Number.isFinite(s.outputPriceUsdPer1M)) {
    return { name: 'ESTIMATED_SCENARIO_UNAVAILABLE', assumption: 'No verified API list price.', estimatedCostPerInvocationUsd: null, estimatedCostPer1000InvocationsUsd: null };
  }
  const perInvocation = (inputTokens / 1000000) * s.inputPriceUsdPer1M + (outputTokens / 1000000) * s.outputPriceUsdPer1M;
  return {
    name: inputTokens <= 1500 ? 'SMALL' : inputTokens <= 5000 ? 'MEDIUM' : 'LARGE',
    assumption: `${inputTokens} input tokens and ${outputTokens} output tokens; estimate only, not measured production usage.`,
    inputTokens,
    outputTokens,
    estimatedCostPerInvocationUsd: Number(perInvocation.toFixed(6)),
    estimatedCostPer1000InvocationsUsd: Number((perInvocation * 1000).toFixed(4))
  };
}

function candidate(capability, sourceId, options = {}) {
  const s = source(sourceId);
  const p = pricing(sourceId);
  return stable({
    capabilityId: capability.capabilityId,
    capabilityName: capability.capabilityName,
    executionClass: capability.executionClass,
    capabilityType: options.capabilityType || (capability.safetyRelevant ? 'safety_adjacent_grounded_presentation' : 'grounded_operational_presentation'),
    candidateId: `${capability.capabilityId}::${s.officialModelId}`,
    candidateType: 'HOSTED_MODEL',
    executionFamily: options.executionFamily || 'general_purpose_structured_generation',
    provider: s.provider,
    modelName: s.model,
    officialModelId: s.officialModelId,
    modelTier: options.modelTier || 'LOW_COST',
    hostedOrLocal: 'HOSTED',
    benchmarkEligible: true,
    inclusionReason: options.inclusionReason,
    exclusionReason: null,
    premiumEntryJustification: options.premiumEntryJustification || null,
    structuredOutputSupport: options.structuredOutputSupport || 'SUPPORTED_BY_OFFICIAL_DOCS',
    toolCallingSupport: options.toolCallingSupport || 'SUPPORTED_OR_NOT_REQUIRED_FOR_MS004',
    contextAdequacy: s.contextWindowTokens ? `ADEQUATE_FOR_MS002_DATASETS_${s.contextWindowTokens}_TOKENS` : 'LIKELY_ADEQUATE_CONTEXT_LIMIT_NOT_NUMERICALLY_RECORDED',
    expectedLatencyClass: options.expectedLatencyClass || 'INTERACTIVE_OR_BATCH_DEPENDING_ON_CAPABILITY',
    pricingVerified: p.pricingVerified,
    pricingVerifiedDate: p.pricingVerifiedDate,
    inputPrice: p.inputPrice,
    outputPrice: p.outputPrice,
    cachedInputPrice: p.cachedInputPrice,
    batchPrice: p.batchPrice,
    estimatedCostScenario: costScenario(sourceId, options.inputTokens || 3000, options.outputTokens || 600),
    integrationComplexity: options.integrationComplexity || (s.provider === 'OpenAI' ? 'LOW' : 'MEDIUM'),
    privacyNotes: options.privacyNotes || `${s.provider} hosted API facts recorded separately; TSR tenant isolation remains server responsibility.`,
    reliabilityNotes: options.reliabilityNotes || 'Must pass MS-002 reliability, grounding, schema, and fallback gates before any selection.',
    keyConstraints: s.apiConstraints,
    sourceReferences: p.sourceReferences,
    candidateStatus: 'SHORTLISTED',
    providerSelected: false,
    modelSelected: false,
    finalWinner: false,
    hostedBenchmarkExecuted: false,
    productionAssignment: false,
    multiCapabilityCandidate: true,
    potentialConsolidationValue: options.potentialConsolidationValue || 'Can be reused across multiple D2 presentation/explanation benchmarks if MS-004 evidence supports it.'
  });
}

function d1Candidate(capability, id, family, reason, options = {}) {
  return stable({
    capabilityId: capability.capabilityId,
    capabilityName: capability.capabilityName,
    executionClass: capability.executionClass,
    capabilityType: 'predictive_or_statistical_execution',
    candidateId: `${capability.capabilityId}::${id}`,
    candidateType: 'D1_METHOD',
    executionFamily: family,
    provider: 'REPOSITORY_OR_LOCAL_COMPUTE',
    modelName: options.modelName || null,
    officialModelId: options.officialModelId || null,
    modelTier: 'NON_HOSTED_D1',
    hostedOrLocal: options.hostedOrLocal || 'LOCAL_OR_DETERMINISTIC',
    benchmarkEligible: true,
    inclusionReason: reason,
    exclusionReason: null,
    premiumEntryJustification: null,
    structuredOutputSupport: 'NOT_APPLICABLE_STRUCTURED_RECORD_EMITTED_BY_TSR_CODE',
    toolCallingSupport: 'NOT_APPLICABLE',
    contextAdequacy: 'ADEQUATE_STRUCTURED_FEATURE_INPUTS',
    expectedLatencyClass: options.expectedLatencyClass || 'LOW_LATENCY_LOCAL',
    pricingVerified: true,
    pricingVerifiedDate: verifiedDate,
    inputPrice: 0,
    outputPrice: 0,
    cachedInputPrice: null,
    batchPrice: null,
    estimatedCostScenario: {
      name: 'D1_TOTAL_COST_QUALITATIVE',
      assumption: 'No per-token API cost; MS-004 must account for implementation, maintenance, retraining, monitoring, and local compute.',
      estimatedCostPerInvocationUsd: 0,
      estimatedCostPer1000InvocationsUsd: 0
    },
    integrationComplexity: options.integrationComplexity || 'LOW',
    privacyNotes: 'Runs on TSR-controlled deterministic/statistical inputs; no hosted provider data transfer.',
    reliabilityNotes: 'Must be reproducible and calibrated against MS-002 benchmark datasets.',
    keyConstraints: options.keyConstraints || ['quality depends on feature completeness', 'requires missing-data behavior', 'requires calibration/error analysis'],
    sourceReferences: capability.repositoryEvidence,
    candidateStatus: 'SHORTLISTED',
    providerSelected: false,
    modelSelected: false,
    finalWinner: false,
    hostedBenchmarkExecuted: false,
    productionAssignment: false,
    multiCapabilityCandidate: false,
    potentialConsolidationValue: 'D1 methods are capability-specific and should not force cross-capability model consolidation.'
  });
}

function buildCandidateSelection() {
  const ms001 = buildRegistry();
  const ms002 = buildFramework();
  const benchmarkCapabilities = ms001.capabilities.filter((capability) => capability.modelBenchmarkRequired);
  const byId = Object.fromEntries(benchmarkCapabilities.map((capability) => [capability.capabilityId, capability]));
  const d1 = benchmarkCapabilities.filter((capability) => capability.executionClass === 'D1');
  const d2 = benchmarkCapabilities.filter((capability) => capability.executionClass === 'D2');

  const d1Candidates = d1.flatMap((capability) => [
    d1Candidate(capability, 'existing-baseline', 'existing_deterministic_statistical_baseline', 'Keeps the current TSR deterministic/statistical implementation as the required cheapest baseline.'),
    d1Candidate(capability, 'regularized-linear-or-logistic', capability.futureAiRoles.includes('CLASSIFICATION') ? 'regularized_logistic_classification' : 'regularized_linear_regression', 'Low-complexity interpretable benchmark candidate with explicit coefficients and reproducible behavior.'),
    d1Candidate(capability, 'gradient-boosted-trees', 'tree_based_gradient_boosting', 'Compact tabular ML candidate suitable for nonlinear operational signals without hosted generative inference.')
  ]);

  const d2Candidates = [
    candidate(byId['route.risk_explanation.presentation'], 'openaiGpt5Nano', { inclusionReason: 'Lowest-cost structured explanation candidate for supplied route-risk facts.', inputTokens: 2500, outputTokens: 500, integrationComplexity: 'LOW' }),
    candidate(byId['route.risk_explanation.presentation'], 'anthropicHaiku45', { inclusionReason: 'Fast Claude candidate for grounded safety-adjacent explanation with structured-output support.', inputTokens: 2500, outputTokens: 500 }),
    candidate(byId['route.risk_explanation.presentation'], 'openaiGpt5', { modelTier: 'PREMIUM_UPPER_BOUND', inclusionReason: 'Upper-bound safety-adjacent grounding comparison for route-risk explanation.', premiumEntryJustification: 'Route-risk explanation is safety-adjacent; GPT-5 is included only as an upper-bound comparison to prove whether low-cost candidates are sufficient.', inputTokens: 2500, outputTokens: 500, integrationComplexity: 'LOW' }),

    candidate(byId['driver.copilot.contextual_response'], 'openaiGpt5Nano', { inclusionReason: 'Cheapest current GPT-5-family candidate for high-volume contextual driver response.', inputTokens: 3000, outputTokens: 500, integrationComplexity: 'LOW' }),
    candidate(byId['driver.copilot.contextual_response'], 'openaiGpt5Mini', { modelTier: 'LOW_MID', inclusionReason: 'Cost-controlled escalation candidate for interactive copilot prompts requiring stronger instruction following than nano.', inputTokens: 3000, outputTokens: 500, integrationComplexity: 'LOW' }),
    candidate(byId['driver.copilot.contextual_response'], 'anthropicHaiku45', { modelTier: 'LOW_MID', inclusionReason: 'Fast non-OpenAI comparison candidate with structured output support.', inputTokens: 3000, outputTokens: 500 }),
    candidate(byId['driver.copilot.contextual_response'], 'openaiGpt5', { modelTier: 'PREMIUM_UPPER_BOUND', inclusionReason: 'Upper-bound safety and grounding comparison for driver-facing response.', premiumEntryJustification: 'Driver copilot responses are safety-adjacent and interactive; GPT-5 is included only to determine whether cheaper candidates fail required grounding/uncertainty gates.', inputTokens: 3000, outputTokens: 500, integrationComplexity: 'LOW' }),

    candidate(byId['supervisor.daily_operations_report.narrative'], 'openaiGpt5Nano', { inclusionReason: 'Lowest-cost structured narrative candidate for batch supervisor reporting.', inputTokens: 5000, outputTokens: 900, integrationComplexity: 'LOW' }),
    candidate(byId['supervisor.daily_operations_report.narrative'], 'googleFlashLite35', { inclusionReason: 'Low-cost high-throughput hosted comparison candidate for batch narrative generation.', inputTokens: 5000, outputTokens: 900 }),
    candidate(byId['supervisor.daily_operations_report.narrative'], 'mistralSmall', { inclusionReason: 'Low-cost Mistral candidate with structured-output capability and favorable token pricing.', inputTokens: 5000, outputTokens: 900 }),

    candidate(byId['supervisor.freeform_question_answer'], 'openaiGpt5Mini', { inclusionReason: 'Cost-controlled OpenAI candidate for operational QA with structured output.', inputTokens: 4000, outputTokens: 700, integrationComplexity: 'LOW' }),
    candidate(byId['supervisor.freeform_question_answer'], 'anthropicHaiku45', { inclusionReason: 'Fast Claude comparison candidate for grounded operational QA.', inputTokens: 4000, outputTokens: 700 }),
    candidate(byId['supervisor.freeform_question_answer'], 'googleFlash35', { modelTier: 'MID', inclusionReason: 'Long-context Gemini candidate where supervisor questions may include broad operational context.', inputTokens: 4000, outputTokens: 700 }),

    candidate(byId['warehouse.exception_summary.presentation'], 'openaiGpt5Nano', { inclusionReason: 'Lowest-cost structured summary candidate for deterministic warehouse exceptions.', inputTokens: 2500, outputTokens: 450, integrationComplexity: 'LOW' }),
    candidate(byId['warehouse.exception_summary.presentation'], 'googleFlashLite35', { inclusionReason: 'Low-cost high-throughput comparison candidate for warehouse exception summaries.', inputTokens: 2500, outputTokens: 450 }),
    candidate(byId['warehouse.exception_summary.presentation'], 'mistralSmall', { inclusionReason: 'Low-cost Mistral comparison candidate for concise structured summaries.', inputTokens: 2500, outputTokens: 450 }),

    candidate(byId['customer.account_guidance.presentation'], 'openaiGpt5Nano', { inclusionReason: 'Lowest-cost customer guidance presentation candidate.', inputTokens: 3500, outputTokens: 650, integrationComplexity: 'LOW' }),
    candidate(byId['customer.account_guidance.presentation'], 'anthropicHaiku45', { inclusionReason: 'Fast Claude candidate for customer/account advisory tone with structured output.', inputTokens: 3500, outputTokens: 650 }),
    candidate(byId['customer.account_guidance.presentation'], 'mistralSmall', { inclusionReason: 'Low-cost Mistral comparison candidate for customer-account summaries.', inputTokens: 3500, outputTokens: 650 }),

    candidate(byId['operations.executive_dashboard_synthesis'], 'openaiGpt5Mini', { inclusionReason: 'Cost-controlled OpenAI synthesis candidate for cross-domain operational dashboard context.', inputTokens: 6000, outputTokens: 900, integrationComplexity: 'LOW' }),
    candidate(byId['operations.executive_dashboard_synthesis'], 'anthropicHaiku45', { inclusionReason: 'Fast Claude candidate for cross-domain synthesis with structured output.', inputTokens: 6000, outputTokens: 900 }),
    candidate(byId['operations.executive_dashboard_synthesis'], 'googleFlash35', { modelTier: 'MID', inclusionReason: 'Long-context Gemini candidate for broader cross-domain context.', inputTokens: 6000, outputTokens: 900 }),

    candidate(byId['safety.narrative_summary.presentation'], 'openaiGpt5Mini', { inclusionReason: 'Cost-controlled OpenAI candidate for safety narrative summarization.', inputTokens: 3500, outputTokens: 650, integrationComplexity: 'LOW' }),
    candidate(byId['safety.narrative_summary.presentation'], 'anthropicSonnet46', { modelTier: 'MID_UPPER', inclusionReason: 'Higher-capability Claude candidate for safety-adjacent structured narrative grounding.', inputTokens: 3500, outputTokens: 650 }),
    candidate(byId['safety.narrative_summary.presentation'], 'openaiGpt5', { modelTier: 'PREMIUM_UPPER_BOUND', inclusionReason: 'Upper-bound comparison for safety authority trace summarization.', premiumEntryJustification: 'Safety narrative presentation is safety-adjacent; GPT-5 is included only to test whether a premium upper bound materially improves hard-gate pass rate over cheaper candidates.', inputTokens: 3500, outputTokens: 650, integrationComplexity: 'LOW' }),

    candidate(byId['platform.legacy_structured_ai_response'], 'openaiGpt5Nano', { inclusionReason: 'Cheapest OpenAI structured-response compatibility candidate.', inputTokens: 2500, outputTokens: 500, integrationComplexity: 'LOW' }),
    candidate(byId['platform.legacy_structured_ai_response'], 'openaiGpt5Mini', { inclusionReason: 'Cost-controlled OpenAI escalation candidate for legacy structured-response compatibility.', inputTokens: 2500, outputTokens: 500, integrationComplexity: 'LOW' }),
    candidate(byId['platform.legacy_structured_ai_response'], 'googleFlashLite35', { inclusionReason: 'Low-cost non-OpenAI structured-output comparison candidate for future adapter evaluation.', inputTokens: 2500, outputTokens: 500 })
  ];

  const candidates = stable([...d1Candidates, ...d2Candidates].sort((a, b) => a.candidateId.localeCompare(b.candidateId)));
  const screenedOutCandidates = stable([
    screenedOut('ALL_D2', 'OpenAI GPT-5.6 Luna/Terra', 'Current OpenAI family is relevant and now has official API documentation/pricing.', 'Reference-only for this MS-003 baseline: adding Luna/Terra would inflate benchmark scope beyond the already bounded GPT-5 nano/mini/GPT-5 ladder without owner-approved candidate substitution.'),
    screenedOut('ALL_D2', 'OpenAI GPT-5.6 Sol', 'Current flagship upper-bound candidate.', 'Too expensive for current TSR candidate discipline except future owner-approved upper-bound tests; not needed while GPT-5 provides a cheaper upper-bound reference.'),
    screenedOut('ALL_D2', 'Anthropic Claude Opus 4.7', 'Current high-capability Claude candidate.', 'Premium cost and capability are disproportionate to MS-002 presentation/explanation contracts before cheaper candidates fail.'),
    screenedOut('ALL_D2', 'Mistral Medium 3.5', 'Mistral higher-capability candidate.', 'Substantially higher output cost than Mistral Small without a current capability-specific need.'),
    screenedOut('ALL_D2', 'Qwen3-32B self-hosted', 'Apache 2.0 open-weight reference.', 'Reference only; no TSR serving stack, hardware sizing, monitoring, or integration exists yet.'),
    screenedOut('ALL_D2', 'Llama 4 Scout self-hosted', 'Open-weight long-context reference.', 'Reference only; custom license and single-H100 serving burden are disproportionate before hosted candidates are tested.'),
    screenedOut('ALL_D1', 'General-purpose hosted LLM prediction', 'Could transform predictive facts into prose.', 'Prediction contracts require statistical accuracy/calibration first; generative output has no strong technical reason for D1 benchmark entry.')
  ]);

  const byCapability = Object.fromEntries(benchmarkCapabilities.map((capability) => [
    capability.capabilityId,
    candidates.filter((candidateRecord) => candidateRecord.capabilityId === capability.capabilityId)
  ]));
  const uniqueHostedModels = [...new Set(candidates.filter((c) => c.candidateType === 'HOSTED_MODEL').map((c) => c.officialModelId))].sort();
  const uniqueProviders = [...new Set(candidates.filter((c) => c.candidateType === 'HOSTED_MODEL').map((c) => c.provider))].sort();
  const d2Counts = d2.map((capability) => ({ capabilityId: capability.capabilityId, count: byCapability[capability.capabilityId].length }));
  const projectedCalls = candidates.length * 12 * 3;
  const estimatedCost = estimateBenchmarkCost(candidates);
  const summary = stable({
    totalBenchmarkCapabilities: benchmarkCapabilities.length,
    d1Count: d1.length,
    d2Count: d2.length,
    d3Count: benchmarkCapabilities.filter((capability) => capability.executionClass === 'D3').length,
    totalShortlistedD1Methods: d1Candidates.length,
    totalShortlistedD2ModelCapabilityPairs: d2Candidates.length,
    uniqueHostedModelsShortlisted: uniqueHostedModels.length,
    uniqueHostedModelIds: uniqueHostedModels,
    uniqueProvidersRepresented: uniqueProviders.length,
    uniqueProviders,
    uniqueOpenSelfHostedModelsShortlisted: 0,
    screenedOutCandidateCount: screenedOutCandidates.length,
    premiumCandidatesCount: candidates.filter((c) => c.modelTier === 'PREMIUM_UPPER_BOUND').length,
    previewCandidatesCount: 0,
    capabilitiesWith2Candidates: Object.values(byCapability).filter((records) => records.length === 2).length,
    capabilitiesWith3Candidates: Object.values(byCapability).filter((records) => records.length === 3).length,
    capabilitiesWith4Candidates: Object.values(byCapability).filter((records) => records.length === 4).length,
    candidatePairsLackingVerifiedPricing: candidates.filter((c) => c.pricingVerified !== true).length,
    candidatePairsLackingVerifiedTechnicalDocumentation: candidates.filter((c) => !Array.isArray(c.sourceReferences) || !c.sourceReferences.length).length,
    projectedMS004BenchmarkCalls: projectedCalls,
    projectedBenchmarkCostRangeUsd: estimatedCost,
    providerModelSelected: 0,
    hostedBenchmarkExecuted: 0,
    productionActivation: 0
  });

  return stable({
    packageId: 'MS-003',
    title: 'Candidate Model & Method Selection',
    generatedFrom: 'bridge-api/scripts/generate-ms003-candidate-selection-artifacts.cjs',
    generatedArtifact: true,
    sourcePackages: ['MS-001', 'MS-002'],
    sourceRegistryHash: ms001.registryHash,
    sourceFrameworkHash: ms002.frameworkHash,
    scope: {
      repositoryOnlyResearchAndDesign: true,
      currentPricingResearchPerformed: true,
      providerSelectionPerformed: false,
      modelSelectionPerformed: false,
      hostedBenchmarkingPerformed: false,
      productionActivationPerformed: false,
      deploymentPerformed: false,
      migrationPerformed: false,
      productionChangePerformed: false,
      noNinthDomain: true
    },
    gateState: {
      modelSelectionGateStatus: 'DEFERRED',
      modelSelectionGateComplete: false,
      modelSelectionGateActive: false,
      productionOrchestrationGateStatus: 'DEFERRED',
      productionOrchestrationGateComplete: false,
      productionOrchestrationGateActive: false,
      ms004Status: 'NOT_STARTED'
    },
    benchmarkCapabilities,
    d0Exclusions: ms001.capabilities.filter((capability) => !capability.modelBenchmarkRequired).map((capability) => capability.capabilityId).sort(),
    candidates,
    candidatesByCapability: byCapability,
    screenedOutCandidates,
    sourceRegister: Object.values(SOURCES),
    sourceDiscrepancies: SOURCE_DISCREPANCIES,
    openWeightSelfHostedAssessment: [
      {
        model: 'Qwen3-32B',
        status: 'REFERENCE_ONLY',
        reason: 'Potential privacy/provider-independence option but requires serving stack, hardware sizing, monitoring, security patching, and adapter work before shortlist eligibility.'
      },
      {
        model: 'Llama 4 Scout',
        status: 'REFERENCE_ONLY',
        reason: 'Long-context open-weight reference but custom license and GPU operations burden are disproportionate before hosted candidates are benchmarked.'
      }
    ],
    providerAdapterCompatibility: providerAdapterCompatibility(uniqueProviders),
    normalizedCostScenarios: normalizedCostScenarios(Object.values(SOURCES).filter((s) => Number.isFinite(s.inputPriceUsdPer1M))),
    benchmarkExecutionEstimate: {
      capabilities: benchmarkCapabilities.length,
      candidates: candidates.length,
      datasetCasesPerCapability: 12,
      repetitionsPerCandidateCase: 3,
      projectedBenchmarkCalls: projectedCalls,
      projectedTokenVolumeEstimate: {
        inputTokens: candidates.reduce((sum, c) => sum + (c.estimatedCostScenario.inputTokens || 0), 0) * 12 * 3,
        outputTokens: candidates.reduce((sum, c) => sum + (c.estimatedCostScenario.outputTokens || 0), 0) * 12 * 3
      },
      projectedBenchmarkCostRangeUsd: estimatedCost
    },
    summary,
    frameworkHash: sha({ candidates, screenedOutCandidates, summary })
  });
}

function screenedOut(capability, candidate, reasonConsidered, reasonExcluded) {
  return { capability, candidate, reasonConsidered, reasonExcluded, candidateStatus: 'SCREENED_OUT' };
}

function estimateBenchmarkCost(candidates) {
  const expected = candidates.reduce((sum, c) => sum + ((c.estimatedCostScenario.estimatedCostPerInvocationUsd || 0) * 12 * 3), 0);
  return {
    lowEstimateUsd: Number((expected * 0.7).toFixed(4)),
    expectedEstimateUsd: Number(expected.toFixed(4)),
    highEstimateUsd: Number((expected * 1.6).toFixed(4)),
    assumptions: '12 benchmark cases per capability-candidate pair, 3 repetitions, token scenarios embedded per candidate, no retries or batch discounts included.'
  };
}

function providerAdapterCompatibility(providers) {
  return providers.map((provider) => {
    const openai = provider === 'OpenAI';
    return {
      provider,
      alreadySupportedByAdapter: openai,
      adapterExistsButModelUnknown: openai,
      providerRequiresExtension: !openai,
      completelyUnsupported: !openai,
      integrationComplexity: openai ? 'LOW' : 'MEDIUM',
      notes: openai ? 'Existing providerAdapters.js wraps OpenAI structured response path; model allowlisting/config remains future work.' : 'No MS-003 implementation authorized; future adapter extension would be required before hosted benchmarking.'
    };
  });
}

function normalizedCostScenarios(sources) {
  return sources.map((s) => ({
    provider: s.provider,
    model: s.model,
    officialModelId: s.officialModelId,
    pricingVerifiedDate: s.dateVerified,
    inputPriceUsdPer1M: s.inputPriceUsdPer1M,
    cachedInputPriceUsdPer1M: s.cachedInputPriceUsdPer1M,
    outputPriceUsdPer1M: s.outputPriceUsdPer1M,
    small: costScenarioBySource(s, 1500, 300),
    medium: costScenarioBySource(s, 5000, 900),
    large: costScenarioBySource(s, 12000, 1800)
  }));
}

function costScenarioBySource(s, inputTokens, outputTokens) {
  const cost = (inputTokens / 1000000) * s.inputPriceUsdPer1M + (outputTokens / 1000000) * s.outputPriceUsdPer1M;
  return {
    inputTokens,
    outputTokens,
    estimatedCostPerInvocationUsd: Number(cost.toFixed(6)),
    estimatedCostPer1000InvocationsUsd: Number((cost * 1000).toFixed(4))
  };
}

function renderDocs(framework) {
  const candidates = framework.candidates;
  const d1Candidates = candidates.filter((c) => c.candidateType === 'D1_METHOD');
  const d2Candidates = candidates.filter((c) => c.candidateType === 'HOSTED_MODEL');
  const candidateRows = candidates.map((c) => [c.capabilityId, c.executionClass, c.candidateType, c.provider, c.officialModelId || c.executionFamily, c.modelTier, c.candidateStatus]);
  const byCapabilityRows = Object.entries(framework.candidatesByCapability).map(([capabilityId, records]) => [capabilityId, records.length, records.map((record) => record.officialModelId || record.executionFamily).join(', ')]);
  const docs = {
    'README.md': [
      '# MS-003 - Candidate Model & Method Selection',
      '',
      'MS-003 defines the bounded benchmark candidate set for the 13 MS-001 benchmark-required TSR capabilities. It uses MS-002 acceptance contracts, records current official pricing and technical constraints, and stops before hosted benchmark execution or final model selection.',
      '',
      'MS-003 does not execute hosted benchmarks, select winners, assign production providers/models, activate hosted AI, deploy, run migrations, change production systems, or create a ninth intelligence domain.',
      '',
      '## Summary',
      '',
      table(['Metric','Value'], Object.entries(framework.summary).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value]))
    ].join('\n'),
    'MS003_CANDIDATE_MATRIX.md': ['# MS-003 Candidate Matrix', '', table(['Capability ID','Class','Type','Provider','Model/Method','Tier','Status'], candidateRows)].join('\n'),
    'D1_CANDIDATE_METHODS.md': ['# D1 Candidate Methods', '', 'D1 capabilities begin with deterministic/statistical/local methods, not LLMs.', '', table(['Capability ID','Method','Family','Reason'], d1Candidates.map((c) => [c.capabilityId, c.candidateId.split('::')[1], c.executionFamily, c.inclusionReason]))].join('\n'),
    'D2_CANDIDATE_MODELS.md': ['# D2 Candidate Models', '', 'D2 candidates are deliberately bounded to two to four hosted models per capability.', '', table(['Capability ID','Provider','Model','Input $/1M','Output $/1M','Reason'], d2Candidates.map((c) => [c.capabilityId, c.provider, c.officialModelId, c.inputPrice, c.outputPrice, c.inclusionReason]))].join('\n'),
    'CAPABILITY_CANDIDATE_MAP.md': ['# Capability Candidate Map', '', table(['Capability ID','Candidate Count','Candidates'], byCapabilityRows)].join('\n'),
    'OFFICIAL_MODEL_SOURCE_REGISTER.md': ['# Official Model Source Register', '', table(['Provider','Model','Official ID','Docs','Pricing','API Docs','Verified'], framework.sourceRegister.map((s) => [s.provider, s.model, s.officialModelId, s.documentationSource, s.pricingSource, s.apiDocumentationSource, s.dateVerified]))].join('\n'),
    'CURRENT_PRICING_REGISTER.md': ['# Current Pricing Register', '', table(['Provider','Model','Input $/1M','Cached Input $/1M','Output $/1M','Basis','Verified'], framework.sourceRegister.map((s) => [s.provider, s.model, s.inputPriceUsdPer1M, s.cachedInputPriceUsdPer1M, s.outputPriceUsdPer1M, s.pricingBasis, s.dateVerified]))].join('\n'),
    'NORMALIZED_COST_COMPARISON.md': ['# Normalized Cost Comparison', '', 'Costs are estimates only and are not measured production costs.', '', table(['Provider','Model','Small $/1k','Medium $/1k','Large $/1k'], framework.normalizedCostScenarios.map((s) => [s.provider, s.model, s.small.estimatedCostPer1000InvocationsUsd, s.medium.estimatedCostPer1000InvocationsUsd, s.large.estimatedCostPer1000InvocationsUsd]))].join('\n'),
    'OPEN_WEIGHT_SELF_HOSTED_ASSESSMENT.md': ['# Open Weight And Self-Hosted Assessment', '', table(['Model','Status','Reason'], framework.openWeightSelfHostedAssessment.map((r) => [r.model, r.status, r.reason]))].join('\n'),
    'PROVIDER_ADAPTER_COMPATIBILITY.md': ['# Provider Adapter Compatibility', '', table(['Provider','Already Supported','Requires Extension','Complexity','Notes'], framework.providerAdapterCompatibility.map((r) => [r.provider, r.alreadySupportedByAdapter, r.providerRequiresExtension, r.integrationComplexity, r.notes]))].join('\n'),
    'SCREENED_OUT_CANDIDATES.md': ['# Screened-Out Candidates', '', table(['Capability','Candidate','Reason Considered','Reason Excluded'], framework.screenedOutCandidates.map((r) => [r.capability, r.candidate, r.reasonConsidered, r.reasonExcluded]))].join('\n'),
    'PREMIUM_MODEL_ENTRY_JUSTIFICATIONS.md': ['# Premium Model Entry Justifications', '', table(['Capability','Model','Justification'], candidates.filter((c) => c.premiumEntryJustification).map((c) => [c.capabilityId, c.officialModelId, c.premiumEntryJustification]))].join('\n'),
    'PRIVACY_SECURITY_PROVIDER_FACTS.md': ['# Privacy And Security Provider Facts', '', mdList([
      'OpenAI API documentation states API data is not used to train or improve models unless explicitly opted in; abuse monitoring logs may be retained by default.',
      'Anthropic API/data-retention documentation describes standard retention, ZDR availability, and structured-output schema caching caveats.',
      'Google Gemini paid-services terms state prompts/responses are not used to improve products on paid services; limited abuse-monitoring logging may apply.',
      'Mistral hosted API and open-weight options require separate enterprise/privacy review before production use.',
      'Tenant isolation remains TSR server-side responsibility for every hosted provider.'
    ])].join('\n'),
    'BENCHMARK_EXECUTION_SIZE_ESTIMATE.md': ['# Benchmark Execution Size Estimate', '', table(['Metric','Value'], Object.entries(framework.benchmarkExecutionEstimate).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value]))].join('\n'),
    'MS004_BENCHMARK_BUDGET_FORECAST.md': ['# MS-004 Benchmark Budget Forecast', '', table(['Estimate','USD'], [['Low', framework.benchmarkExecutionEstimate.projectedBenchmarkCostRangeUsd.lowEstimateUsd], ['Expected', framework.benchmarkExecutionEstimate.projectedBenchmarkCostRangeUsd.expectedEstimateUsd], ['High', framework.benchmarkExecutionEstimate.projectedBenchmarkCostRangeUsd.highEstimateUsd]]), '', framework.benchmarkExecutionEstimate.projectedBenchmarkCostRangeUsd.assumptions].join('\n'),
    'CROSS_CAPABILITY_CONSOLIDATION_CANDIDATES.md': ['# Cross-Capability Consolidation Candidates', '', table(['Model','Candidate Count','Potential Value'], framework.summary.uniqueHostedModelIds.map((id) => [id, d2Candidates.filter((c) => c.officialModelId === id).length, 'Potential reusable model if MS-004 shows sufficient pass rates across capabilities.']))].join('\n'),
    'PROVIDER_CONCENTRATION_NOTES.md': ['# Provider Concentration Notes', '', table(['Provider','Candidate Count','Risk Note'], framework.summary.uniqueProviders.map((provider) => [provider, d2Candidates.filter((c) => c.provider === provider).length, provider === 'OpenAI' ? 'Lowest integration complexity but potential provider concentration.' : 'Adds comparison value but future adapter complexity.']))].join('\n'),
    'UNVERIFIED_CURRENT_INFORMATION.md': ['# Unverified Current Information', '', table(['Provider','Model','Status','Issue','Handling'], framework.sourceDiscrepancies.map((r) => [r.provider, r.model, r.status, r.issue, r.handling]))].join('\n'),
    'MS003_COMPLETION_REPORT.md': [
      '# MS-003 Completion Report',
      '',
      `Benchmark capabilities: ${framework.summary.totalBenchmarkCapabilities}`,
      `D1 capabilities: ${framework.summary.d1Count}`,
      `D2 capabilities: ${framework.summary.d2Count}`,
      `D3 capabilities: ${framework.summary.d3Count}`,
      `D1 candidate methods: ${framework.summary.totalShortlistedD1Methods}`,
      `D2 model-capability pairs: ${framework.summary.totalShortlistedD2ModelCapabilityPairs}`,
      `Unique hosted models: ${framework.summary.uniqueHostedModelsShortlisted}`,
      `Unique providers: ${framework.summary.uniqueProvidersRepresented}`,
      `Screened-out candidates: ${framework.summary.screenedOutCandidateCount}`,
      `Premium candidates: ${framework.summary.premiumCandidatesCount}`,
      '',
      'MS-003 produced a bounded, current, evidence-sourced candidate method/model set. It did not select a provider, select a model, execute hosted benchmarks, activate production routing, deploy, run migrations, or change production systems.'
    ].join('\n')
  };
  return docs;
}

function currentPackageRecord() {
  return stable({
    packageId: 'MS-003',
    title: 'Candidate Model & Method Selection',
    category: 'MODEL_SELECTION_AND_BENCHMARKING',
    status: 'IMPLEMENTED_UNCOMMITTED',
    objective: 'Identify the bounded benchmark candidate method/model set for the 13 MS-001 benchmark-required TSR capabilities by using MS-002 acceptance contracts, current official model/provider documentation, current pricing, and cheapest-sufficient discipline without executing hosted benchmarks or selecting final providers/models.',
    approvedScope: [
      'repository-only candidate model and method selection',
      'current official model/provider documentation research',
      'current pricing research',
      'D1 non-LLM candidate method selection',
      'D2 bounded hosted model shortlist',
      'screened-out candidate register',
      'source register',
      'normalized cost estimates',
      'MS-004 benchmark size and budget forecast',
      'provider adapter compatibility assessment',
      'privacy/security provider facts',
      'validation and controlled negative tests'
    ],
    prohibitedScope: [
      'ninth intelligence domain',
      'final provider selection',
      'final model selection',
      'winning model assignment',
      'production provider assignment',
      'primary/fallback model routing',
      'hosted benchmark execution',
      'live model API calls',
      'provider activation',
      'hosted AI activation',
      'production orchestration',
      'production APIs',
      'deployment',
      'migrations',
      'production writes',
      'database mutations',
      'object-storage mutations',
      'Cloudflare/R2 changes',
      'credential changes',
      'runtime behavior changes',
      'provider adapter implementation'
    ],
    dependencies: ['MS-001', 'MS-002'],
    acceptanceCriteria: [
      'Exactly 13 benchmark-required capabilities are included',
      'D0 deterministic capabilities remain excluded from model/provider research for execution purposes',
      'D1 capabilities use low-complexity statistical/local methods before any hosted generative model',
      'D2 capabilities have deliberately bounded candidate model sets',
      'Current official documentation and pricing sources are recorded',
      'Pricing and workload cost estimates are separated',
      'Screened-out candidates and unverified current information are recorded',
      'No final provider, model, winner, production route, hosted benchmark result, deployment, migration, production write, or ninth domain is introduced'
    ],
    requiredTests: [
      'npm.cmd run ms003:generate',
      'npm.cmd run ms003:validate',
      'npm.cmd run ms003:check',
      'npm.cmd run test:ms003',
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
    sourceControlExpectation: 'MS-003 remains repository-local, unstaged, and uncommitted until validation passes and a separate controlled review/commit step is performed. Do not stage, commit, push, deploy, run migrations, activate providers, select models, execute hosted benchmarks, modify production systems, or begin any ninth intelligence domain in this package.',
    expectedCompletionReportFormat: 'Use the MS-003 work-package report sections A through AZ with candidate counts, pricing/source evidence, generated artifact paths, validation evidence, and scope-drift audit.',
    recommendedCommitMessage: 'Select MS-003 benchmark candidates',
    nextApprovedPackage: null,
    ownerDecisionPoints: [
      'review and approve MS-003 candidate set preservation',
      'approve any MS-004 hosted benchmark execution separately',
      'approve benchmark credentials/provider access separately if MS-004 proceeds',
      'keep production orchestration deferred, incomplete, and inactive until benchmark winners and governance controls are separately approved'
    ]
  });
}

function updateRoadmapArtifacts() {
  const roadmapPath = path.join(aiRoot, 'TSR_AI_MASTER_ROADMAP.json');
  const currentPath = path.join(aiRoot, 'CURRENT_AI_WORK_PACKAGE.json');
  const roadmap = JSON.parse(fs.readFileSync(roadmapPath, 'utf8'));
  const current = currentPackageRecord();
  const packages = roadmap.packages || [];
  const ms002 = packages.find((pkg) => pkg.packageId === 'MS-002');
  if (ms002) {
    ms002.status = 'PUSHED';
    ms002.implementationCommit = MS002_COMMIT;
    ms002.localCommitVerified = true;
    ms002.remoteCommitVerified = true;
    ms002.pushed = true;
    ms002.isCurrentPackage = false;
    ms002.notes = 'MS-002 Benchmark & Acceptance Framework is committed, validated, remote-preserved, and closed. It did not select providers, select models, execute hosted benchmarks, perform pricing research, activate hosted AI, deploy, run migrations, change production systems, or create a ninth intelligence domain.';
  }
  const ms003Package = {
    ...current,
    documentationPath: 'docs/ai-development/model-selection/ms-003-candidate-model-method-selection',
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
    notes: 'MS-003 is a repository-only research/implementation package that names benchmark candidates but does not select final providers/models or execute hosted benchmarks.',
    isCurrentPackage: true
  };
  const existingIndex = packages.findIndex((pkg) => pkg.packageId === 'MS-003');
  if (existingIndex >= 0) packages[existingIndex] = ms003Package;
  else packages.push(ms003Package);
  roadmap.packages = packages;
  roadmap.sourceControl.localHead = MS002_COMMIT;
  roadmap.sourceControl.remoteHead = MS002_COMMIT;
  roadmap.sourceControl.localAheadBy = 0;
  roadmap.sourceControl.remoteVerificationPerformed = true;
  roadmap.gates.modelSelection.currentAnalysisPackage = 'MS-003';
  roadmap.gates.modelSelection.benchmarkAcceptanceFrameworkPackageStatus = 'PUSHED';
  roadmap.gates.modelSelection.candidateSelectionPackageStatus = 'IMPLEMENTED_UNCOMMITTED';
  roadmap.gates.modelSelection.pricingResearchPerformed = true;
  roadmap.gates.modelSelection.providerSelectionPerformed = false;
  roadmap.gates.modelSelection.modelSelectionPerformed = false;
  roadmap.gates.modelSelection.commercialBenchmarkingPerformed = false;
  roadmap.gates.modelSelection.hostedAiActivationPerformed = false;
  fs.writeFileSync(roadmapPath, json(roadmap), 'utf8');
  fs.writeFileSync(currentPath, json(current), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'CURRENT_AI_WORK_PACKAGE.md'), renderCurrentMarkdown(current), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'TSR_AI_MASTER_ROADMAP.md'), renderRoadmapMarkdown(roadmap), 'utf8');
  fs.writeFileSync(path.join(aiRoot, 'AI_MODEL_SELECTION_GATE.md'), renderModelSelectionGateMarkdown(roadmap), 'utf8');
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
    'No next implementation package is approved by this record. MS-004 benchmark execution requires a separate owner-approved package.',
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
    `- Local HEAD after MS-002 preservation: \`${roadmap.sourceControl.localHead}\``,
    `- Remote HEAD after MS-002 preservation: \`${roadmap.sourceControl.remoteHead}\``,
    '- Milestone 1 Core Operational Intelligence Foundations are complete from the repository/source-control perspective across exactly eight domains.',
    '- No Maintenance, Inventory, Financial, or Enterprise Intelligence package is part of Milestone 1 in this roadmap.',
    '',
    '## Model Selection and Benchmarking',
    '',
    ...ms.map((pkg) => `- \`${pkg.packageId}\`: \`${pkg.status}\`, ${pkg.title}. Documentation: \`${pkg.documentationPath}\`. Commit: \`${pkg.implementationCommit || 'UNCOMMITTED'}\`. Pushed: \`${pkg.pushed}\`. Deployed: \`${pkg.deployed}\`.`),
    '',
    'Model Selection Gate prerequisites are satisfied from the repository/source-control perspective, and `MS-003` is the current candidate model/method selection package. The gate itself remains `DEFERRED`, incomplete, inactive, and owner-approval gated. No final provider, final model, premium tier approval, hosted benchmark result, model ranking, commercial benchmark result, or production recommendation is selected by this roadmap state.',
    '',
    'Production orchestration remains `DEFERRED`, incomplete, inactive, and owner-approval gated. No production orchestration, production API activation, deployment, migration, production write, object mutation, credential change, Cloudflare/R2 change, or runtime functionality change is authorized by this roadmap state.'
  ].join('\n')}\n`;
}

function renderModelSelectionGateMarkdown(roadmap) {
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
    '- MS-003 is `IMPLEMENTED_UNCOMMITTED` and is the current candidate model/method selection package.',
    '- Provider selection is not complete.',
    '- Model selection is not complete.',
    '- Hosted benchmarking has not been executed.',
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
    '## MS-003 Boundary',
    '',
    'MS-003 may name benchmark candidates, record current official pricing, document source evidence, and forecast benchmark cost. MS-003 may not select a final provider, select a final model, rank winners, execute hosted benchmarks, activate hosted AI, deploy, run migrations, change production systems, or create a ninth intelligence domain.',
    '',
    '## Next Gate',
    '',
    'MS-004 benchmark execution may begin only under a separately approved package with explicit authorization for any hosted model/API calls and benchmark spending.'
  ].join('\n')}\n`;
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
  if (!options.check) updateRoadmapArtifacts();
  const framework = buildCandidateSelection();
  const docs = renderDocs(framework);
  const outputs = {
    ...Object.fromEntries(Object.entries(docs).map(([name, content]) => [path.join(docsRoot, name), `${content}\n`])),
    [path.join(docsRoot, 'MS003_CANDIDATE_MATRIX.json')]: json(framework.candidates),
    [path.join(generatedRoot, 'ms003_candidate_selection_framework.json')]: json(framework),
    [path.join(generatedRoot, 'ms003_candidate_summary.json')]: json(framework.summary),
    [path.join(generatedRoot, 'ms003_source_register.json')]: json(framework.sourceRegister),
    [path.join(generatedRoot, 'ms003_pricing_register.json')]: json(framework.sourceRegister.map((s) => ({
      provider: s.provider,
      model: s.model,
      officialModelId: s.officialModelId,
      pricingSource: s.pricingSource,
      pricingBasis: s.pricingBasis,
      inputPriceUsdPer1M: s.inputPriceUsdPer1M,
      cachedInputPriceUsdPer1M: s.cachedInputPriceUsdPer1M,
      outputPriceUsdPer1M: s.outputPriceUsdPer1M,
      dateVerified: s.dateVerified
    }))),
    [path.join(generatedRoot, 'ms003_benchmark_budget_forecast.json')]: json(framework.benchmarkExecutionEstimate),
    [path.join(generatedRoot, 'ms003_hash.json')]: json({
      frameworkHash: framework.frameworkHash,
      sourceRegistryHash: framework.sourceRegistryHash,
      sourceFrameworkHash: framework.sourceFrameworkHash,
      totalBenchmarkCapabilities: framework.summary.totalBenchmarkCapabilities
    })
  };
  const changed = Object.entries(outputs)
    .filter(([file, content]) => writeIfChanged(file, content, options))
    .map(([file]) => path.relative(repoRoot, file).replace(/\\/g, '/'));
  if (options.check && changed.length) {
    console.error(`[ms003] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[ms003] generated ${Object.keys(outputs).length} artifacts in ${path.relative(repoRoot, docsRoot).replace(/\\/g, '/')}`);
  }
  return { changed, framework };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { buildCandidateSelection, generate, paths: { backendRoot, repoRoot, docsRoot, generatedRoot }, SOURCES };
