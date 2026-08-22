const aiProvider = require('../aiProvider');
const { MODEL_CLASSES } = require('./constants');
const { createError, normalizeProviderError } = require('./errors');

const HOSTED_STRUCTURED_CAPABILITIES = Object.freeze(new Set([
  'legacy.ai.structured_response',
  'supervisor.daily_operations_report'
]));
const OPENAI_LEGACY_MODEL_MAPPING_VERSION = 'openai.legacy-model-mapping.v1';
const BENCHMARK_MAPPING_VERSION = 'ms004.benchmark-provider-adapters.v1';
const ANTHROPIC_BENCHMARK_MODEL_INVOCATION_IDS = Object.freeze({
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-sonnet-5': 'claude-sonnet-5'
});
const MS004_BENCHMARK_PROVIDERS = Object.freeze({
  openai: Object.freeze({
    provider: 'openai',
    displayName: 'OpenAI',
    credentialEnvironmentVariable: 'OPENAI_API_KEY',
    supportedModelIds: Object.freeze(['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.6-luna']),
    supportedCapabilities: Object.freeze([
      'customer.account_guidance.presentation',
      'driver.copilot.contextual_response',
      'operations.executive_dashboard_synthesis',
      'platform.legacy_structured_ai_response',
      'route.risk_explanation.presentation',
      'safety.narrative_summary.presentation',
      'supervisor.daily_operations_report.narrative',
      'supervisor.freeform_question_answer',
      'warehouse.exception_summary.presentation'
    ])
  }),
  anthropic: Object.freeze({
    provider: 'anthropic',
    displayName: 'Anthropic',
    credentialEnvironmentVariable: 'ANTHROPIC_API_KEY',
    supportedModelIds: Object.freeze(['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-sonnet-5']),
    supportedCapabilities: Object.freeze([
      'customer.account_guidance.presentation',
      'driver.copilot.contextual_response',
      'operations.executive_dashboard_synthesis',
      'route.risk_explanation.presentation',
      'safety.narrative_summary.presentation',
      'supervisor.freeform_question_answer'
    ])
  }),
  google: Object.freeze({
    provider: 'google',
    displayName: 'Google Gemini',
    credentialEnvironmentVariable: 'GEMINI_API_KEY',
    supportedModelIds: Object.freeze(['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash']),
    supportedCapabilities: Object.freeze([
      'driver.copilot.contextual_response',
      'operations.executive_dashboard_synthesis',
      'platform.legacy_structured_ai_response',
      'route.risk_explanation.presentation',
      'safety.narrative_summary.presentation',
      'supervisor.daily_operations_report.narrative',
      'supervisor.freeform_question_answer',
      'warehouse.exception_summary.presentation'
    ])
  }),
  mistral: Object.freeze({
    provider: 'mistral',
    displayName: 'Mistral',
    credentialEnvironmentVariable: 'MISTRAL_API_KEY',
    supportedModelIds: Object.freeze(['mistral-small-latest', 'mistral-medium-3-5']),
    supportedCapabilities: Object.freeze([
      'customer.account_guidance.presentation',
      'route.risk_explanation.presentation',
      'supervisor.daily_operations_report.narrative',
      'warehouse.exception_summary.presentation'
    ])
  })
});

function hasCredential(env, name) {
  return Boolean(String(env?.[name] || '').trim());
}

function getOpenAiModelMapping() {
  const status = aiProvider.getStatus();
  return Object.freeze({
    provider: 'openai',
    modelIdentifier: aiProvider.getModel(),
    modelClass: MODEL_CLASSES.HOSTED_BALANCED,
    supportedCapabilities: Object.freeze([...HOSTED_STRUCTURED_CAPABILITIES]),
    pricingStatus: status.costTrackingConfigured ? 'configured' : 'unknown',
    contextLimit: null,
    availability: aiProvider.isConfigured() ? 'configured' : 'missing_credentials',
    mappingVersion: OPENAI_LEGACY_MODEL_MAPPING_VERSION
  });
}

function getHostedAdapterCatalog() {
  const mapping = getOpenAiModelMapping();
  return Object.freeze([
    Object.freeze({
      provider: mapping.provider,
      configured: aiProvider.isConfigured(),
      modelIdentifier: mapping.modelIdentifier,
      modelClass: mapping.modelClass,
      modalities: Object.freeze(['text']),
      supportsStructuredOutput: true,
      supportsToolUse: false,
      status: aiProvider.isConfigured() ? 'AVAILABLE_FOR_LEGACY_AI' : 'MISSING_CREDENTIALS',
      supportedCapabilities: mapping.supportedCapabilities,
      pricingStatus: mapping.pricingStatus,
      contextLimit: mapping.contextLimit,
      store: false,
      timeoutMs: aiProvider.getTimeoutMs(),
      mappingVersion: mapping.mappingVersion
    })
  ]);
}

function getBenchmarkAdapterCatalog(env = process.env) {
  return Object.freeze(Object.values(MS004_BENCHMARK_PROVIDERS).map((definition) => {
    const configured = hasCredential(env, definition.credentialEnvironmentVariable);
    return Object.freeze({
      provider: definition.provider,
      displayName: definition.displayName,
      adapterScope: 'BENCHMARK_ONLY',
      configured,
      credentialEnvironmentVariable: definition.credentialEnvironmentVariable,
      credentialPresent: configured,
      secretValuesLogged: false,
      modelClass: MODEL_CLASSES.HOSTED_BALANCED,
      modalities: Object.freeze(['text']),
      supportsStructuredOutput: true,
      supportsToolUse: false,
      status: configured ? 'BENCHMARK_ADAPTER_READY' : 'MISSING_CREDENTIALS',
      supportedCapabilities: definition.supportedCapabilities,
      supportedModelIds: definition.supportedModelIds,
      pricingStatus: 'candidate_catalog',
      contextLimit: null,
      store: false,
      timeoutMs: 60000,
      mappingVersion: BENCHMARK_MAPPING_VERSION,
      productionRoutingEnabled: false
    });
  }));
}

function getBenchmarkAdapter(provider, env = process.env) {
  const normalized = String(provider || '').toLowerCase();
  return getBenchmarkAdapterCatalog(env).find((adapter) => adapter.provider === normalized) || null;
}

function assertBenchmarkCandidateSupported(candidate, capability, env = process.env) {
  const adapter = getBenchmarkAdapter(candidate?.provider, env);
  if (!adapter) {
    throw createError('Benchmark provider adapter is not implemented.', 503, 'BENCHMARK_PROVIDER_ADAPTER_NOT_FOUND', {
      provider: candidate?.provider || null
    });
  }
  if (!adapter.configured) {
    throw createError('Benchmark provider credential is not configured in the process environment.', 503, 'BENCHMARK_PROVIDER_CREDENTIAL_MISSING', {
      provider: adapter.provider,
      credentialEnvironmentVariable: adapter.credentialEnvironmentVariable
    });
  }
  if (!adapter.supportedModelIds.includes(candidate?.officialModelId)) {
    throw createError('Benchmark candidate model is not enabled for this provider.', 400, 'BENCHMARK_MODEL_NOT_ENABLED', {
      provider: adapter.provider,
      modelId: candidate?.officialModelId || null
    });
  }
  if (!adapter.supportedCapabilities.includes(capability?.capabilityId || capability?.id)) {
    throw createError('Benchmark capability is not enabled for this provider adapter.', 400, 'BENCHMARK_CAPABILITY_NOT_ENABLED', {
      provider: adapter.provider,
      capabilityId: capability?.capabilityId || capability?.id || null
    });
  }
  return adapter;
}

function getBenchmarkProviderModelId(provider, modelId) {
  const normalizedProvider = String(provider || '').toLowerCase();
  if (normalizedProvider === 'anthropic') return ANTHROPIC_BENCHMARK_MODEL_INVOCATION_IDS[modelId] || modelId;
  return modelId;
}

function buildBenchmarkRequest(candidate, capability, datasetCase, env = process.env) {
  const adapter = assertBenchmarkCandidateSupported(candidate, capability, env);
  const providerModelId = getBenchmarkProviderModelId(adapter.provider, candidate.officialModelId);
  const requiredProperties = capability.expectedOutputContract?.requiredProperties || [];
  return Object.freeze({
    provider: adapter.provider,
    model: candidate.officialModelId,
    providerModelId,
    adapterScope: adapter.adapterScope,
    store: false,
    responseFormat: 'json_schema',
    capabilityId: capability.capabilityId || capability.id,
    input: Object.freeze({
      system: 'Use only the supplied benchmark evidence. Preserve uncertainty and do not invent facts.',
      capabilityId: capability.capabilityId || capability.id,
      outputContract: capability.expectedOutputContract || null,
      responseInstructions: buildBenchmarkResponseInstructions(capability.expectedOutputContract || null),
      requiredProperties,
      benchmarkCase: datasetCase
    }),
    metadata: Object.freeze({
      candidateId: candidate.candidateId,
      provider: adapter.provider,
      modelId: candidate.officialModelId,
      providerModelId,
      mappingVersion: adapter.mappingVersion
    })
  });
}

function valueHintForRequiredProperty(field) {
  if (field === 'source_evidence_references') return [];
  if (field === 'limitations_or_unknowns') return [];
  if (field === 'tenant_context') return 'string';
  if (field === 'uncertainty_or_refusal_when_needed') return 'string';
  return 'string';
}

function buildBenchmarkResponseInstructions(outputContract) {
  const required = outputContract?.requiredProperties || [];
  const prohibited = outputContract?.prohibitedProperties || [];
  const responseShape = required.reduce((acc, field) => {
    acc[field] = valueHintForRequiredProperty(field);
    return acc;
  }, {});
  return Object.freeze({
    responseType: 'json_object',
    requiredProperties: required,
    prohibitedProperties: prohibited,
    instructions: [
      'Return only a JSON object.',
      'Include every required property exactly as named.',
      'Do not wrap the JSON in markdown.',
      'Use source_evidence_references to cite supplied benchmark evidence identifiers.',
      'Use limitations_or_unknowns or uncertainty_or_refusal_when_needed when evidence is incomplete.',
      'Preserve tenant_context from the supplied benchmark case when present; otherwise state the synthetic benchmark tenant.',
      'Do not claim provider selection, model selection, production readiness, or deterministic authority.'
    ],
    responseShape
  });
}

function normalizeBenchmarkUsage(provider, usage) {
  if (!usage || typeof usage !== 'object') return null;
  return Object.freeze({
    provider,
    inputTokens: Number(usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? 0),
    outputTokens: Number(usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? 0),
    totalTokens: Number(usage.totalTokens ?? usage.total_tokens ?? usage.totalTokenCount ?? 0),
    fabricated: false
  });
}

function normalizeBenchmarkResponse({ provider, candidate, response, startedAtMs, endedAtMs }) {
  const output = response?.output ?? response?.parsed ?? response?.content ?? response?.text ?? null;
  return Object.freeze({
    status: 'SUCCEEDED',
    provider: String(provider || candidate?.provider || '').toLowerCase(),
    model: response?.model || candidate?.officialModelId || null,
    output,
    rawText: typeof output === 'string' ? output : null,
    usage: normalizeBenchmarkUsage(String(provider || candidate?.provider || '').toLowerCase(), response?.usage),
    providerRequestId: response?.requestId || response?.id || null,
    latencyMs: Math.max(0, Number(endedAtMs || Date.now()) - Number(startedAtMs || Date.now())),
    retryCount: Number(response?.retryCount || 0),
    estimatedCostUsd: response?.estimatedCostUsd ?? null,
    actualCostUsd: null,
    simulatedHostedOutputPresentedAsReal: false,
    productionActivation: false
  });
}

function normalizeBenchmarkFailure(provider, error, retryCount = 0) {
  return Object.freeze({
    status: 'FAILED',
    provider: String(provider || 'unknown').toLowerCase(),
    error: normalizeProviderError(error, provider),
    retryCount,
    usage: null,
    latencyMs: error?.latencyMs ?? null,
    simulatedHostedOutputPresentedAsReal: false,
    productionActivation: false
  });
}

function extractTextFromAnthropic(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content.map((item) => item?.text || '').filter(Boolean).join('\n').trim();
}

function extractTextFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((item) => item?.text || '').filter(Boolean).join('\n').trim();
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { text };
  }
}

function ensureFetchTransport(transport) {
  const resolved = transport || globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw createError('Fetch transport is unavailable for benchmark provider execution.', 500, 'BENCHMARK_FETCH_UNAVAILABLE');
  }
  return resolved;
}

function buildBenchmarkPrompt(request) {
  return [
    request.input.system,
    '',
    'Capability ID:',
    request.input.capabilityId,
    '',
    'Return JSON matching this benchmark output contract:',
    JSON.stringify(request.input.outputContract || {}),
    '',
    'Required response instructions:',
    JSON.stringify(request.input.responseInstructions || {}),
    '',
    'Benchmark case:',
    JSON.stringify(request.input.benchmarkCase || {})
  ].join('\n');
}

async function executeBenchmarkProviderRequest(request, options = {}) {
  const env = options.env || process.env;
  const transport = ensureFetchTransport(options.fetch);
  const adapter = assertBenchmarkCandidateSupported({
    provider: request?.provider,
    officialModelId: request?.model
  }, { capabilityId: request?.capabilityId }, env);
  const apiKey = env[adapter.credentialEnvironmentVariable];
  const startedAtMs = Date.now();
  let response;
  let data;
  const headers = { 'content-type': 'application/json' };
  const prompt = buildBenchmarkPrompt(request);

  if (adapter.provider === 'openai') {
    response = await transport('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: request.model,
        input: prompt,
        store: false,
        text: { format: { type: 'json_object' } }
      })
    });
    data = await parseJsonResponse(response);
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'OpenAI benchmark request failed.'), {
      code: data?.error?.code || 'OPENAI_BENCHMARK_ERROR',
      providerStatus: response.status,
      requestId: response.headers?.get?.('x-request-id') || data?.id || null,
      retryable: response.status === 429 || response.status >= 500
    });
    return normalizeBenchmarkResponse({
      provider: adapter.provider,
      candidate: { provider: adapter.provider, officialModelId: request.model },
      startedAtMs,
      endedAtMs: Date.now(),
      response: {
        id: data.id,
        model: data.model || request.model,
        output: data.output_parsed || data.output_text || data.output || data,
        usage: data.usage
      }
    });
  }

  if (adapter.provider === 'anthropic') {
    response = await transport('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { ...headers, 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: request.providerModelId || getBenchmarkProviderModelId(adapter.provider, request.model),
        max_tokens: 1200,
        system: request.input.system,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    data = await parseJsonResponse(response);
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Anthropic benchmark request failed.'), {
      code: data?.error?.type || 'ANTHROPIC_BENCHMARK_ERROR',
      providerStatus: response.status,
      requestId: response.headers?.get?.('request-id') || data?.id || null,
      retryable: response.status === 429 || response.status >= 500
    });
    return normalizeBenchmarkResponse({
      provider: adapter.provider,
      candidate: { provider: adapter.provider, officialModelId: request.model },
      startedAtMs,
      endedAtMs: Date.now(),
      response: {
        id: data.id,
        model: data.model || request.providerModelId || request.model,
        output: extractTextFromAnthropic(data) || data,
        usage: data.usage
      }
    });
  }

  if (adapter.provider === 'google') {
    response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    data = await parseJsonResponse(response);
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Gemini benchmark request failed.'), {
      code: data?.error?.status || 'GEMINI_BENCHMARK_ERROR',
      providerStatus: response.status,
      requestId: response.headers?.get?.('x-request-id') || null,
      retryable: response.status === 429 || response.status >= 500
    });
    return normalizeBenchmarkResponse({
      provider: adapter.provider,
      candidate: { provider: adapter.provider, officialModelId: request.model },
      startedAtMs,
      endedAtMs: Date.now(),
      response: {
        id: data.responseId || null,
        model: request.model,
        output: extractTextFromGemini(data) || data,
        usage: data.usageMetadata
      }
    });
  }

  if (adapter.provider === 'mistral') {
    response = await transport('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: request.model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });
    data = await parseJsonResponse(response);
    if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Mistral benchmark request failed.'), {
      code: data?.error?.code || 'MISTRAL_BENCHMARK_ERROR',
      providerStatus: response.status,
      requestId: response.id || null,
      retryable: response.status === 429 || response.status >= 500
    });
    return normalizeBenchmarkResponse({
      provider: adapter.provider,
      candidate: { provider: adapter.provider, officialModelId: request.model },
      startedAtMs,
      endedAtMs: Date.now(),
      response: {
        id: data.id,
        model: data.model || request.model,
        output: data.choices?.[0]?.message?.content || data,
        usage: data.usage
      }
    });
  }

  throw createError('Benchmark provider adapter execution is not implemented.', 503, 'BENCHMARK_PROVIDER_EXECUTOR_NOT_IMPLEMENTED', {
    provider: adapter.provider
  });
}

function ensureLegacyStructuredPayload(request) {
  const payload = request?.input;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError('Legacy AI request input must be an object.', 400, 'LEGACY_AI_INPUT_REQUIRED');
  }
  for (const field of ['endpoint', 'instructions', 'input', 'schemaName', 'schema']) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      throw createError(`Legacy AI request input.${field} is required.`, 400, 'LEGACY_AI_INPUT_REQUIRED', { field });
    }
  }
  return payload;
}

function getLegacyProviderStatus() {
  return aiProvider.getStatus();
}

function isLegacyProviderConfigured() {
  return aiProvider.isConfigured();
}

function getLegacyProviderModel() {
  return aiProvider.getModel();
}

function getLegacyProviderTimeoutMs() {
  return aiProvider.getTimeoutMs();
}
async function executeHostedModel(capability, request) {
  if (!HOSTED_STRUCTURED_CAPABILITIES.has(capability?.id)) {
    throw createError('Hosted model execution is not enabled for this capability.', 503, 'HOSTED_MODEL_EXECUTOR_UNAVAILABLE');
  }
  if (!aiProvider.isConfigured()) {
    throw createError('AI provider is not configured. Set OPENAI_API_KEY on the backend.', 503, 'HOSTED_PROVIDER_NOT_CONFIGURED');
  }

  const payload = ensureLegacyStructuredPayload(request);
  try {
    const result = await aiProvider.createStructuredResponse({
      endpoint: payload.endpoint,
      instructions: payload.instructions,
      input: payload.input,
      schemaName: payload.schemaName,
      schema: payload.schema
    });

    return Object.freeze({
      status: 'SUCCEEDED',
      provider: 'openai',
      model: result.model,
      modelClass: MODEL_CLASSES.HOSTED_BALANCED,
      output: result.parsed,
      confidence: 'unavailable',
      evidence: [],
      usage: result.usage || null,
      providerRequestId: result.requestId || null,
      estimatedCostUsd: result.estimatedCostUsd === undefined ? null : result.estimatedCostUsd,
      actualCostUsd: null,
      promptVersion: `${payload.schemaName}.legacy.v1`,
      latencyMs: result.latencyMs ?? null,
      rawText: result.rawText
    });
  } catch (error) {
    const providerError = normalizeProviderError(error, 'openai');
    const wrapped = createError(error.message || 'Hosted AI provider request failed.', error.status || 502, error.code || 'HOSTED_PROVIDER_ERROR', providerError);
    wrapped.retryable = error.retryable === true;
    throw wrapped;
  }
}

module.exports = {
  assertBenchmarkCandidateSupported,
  buildBenchmarkRequest,
  buildBenchmarkPrompt,
  buildBenchmarkResponseInstructions,
  executeHostedModel,
  executeBenchmarkProviderRequest,
  getBenchmarkProviderModelId,
  getBenchmarkAdapter,
  getBenchmarkAdapterCatalog,
  getHostedAdapterCatalog,
  getLegacyProviderModel,
  getLegacyProviderStatus,
  getLegacyProviderTimeoutMs,
  getOpenAiModelMapping,
  isLegacyProviderConfigured,
  normalizeBenchmarkFailure,
  normalizeBenchmarkResponse,
  normalizeBenchmarkUsage,
  normalizeProviderError
};
