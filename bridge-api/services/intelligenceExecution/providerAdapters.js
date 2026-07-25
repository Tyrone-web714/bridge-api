const aiProvider = require('../aiProvider');
const { MODEL_CLASSES } = require('./constants');
const { createError, normalizeProviderError } = require('./errors');

const HOSTED_STRUCTURED_CAPABILITIES = Object.freeze(new Set([
  'legacy.ai.structured_response'
]));
const OPENAI_LEGACY_MODEL_MAPPING_VERSION = 'openai.legacy-model-mapping.v1';

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
  executeHostedModel,
  getHostedAdapterCatalog,
  getLegacyProviderModel,
  getLegacyProviderStatus,
  getLegacyProviderTimeoutMs,
  getOpenAiModelMapping,
  isLegacyProviderConfigured,
  normalizeProviderError
};
