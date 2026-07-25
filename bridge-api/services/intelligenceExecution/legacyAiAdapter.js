const crypto = require('crypto');
const intelligenceExecution = require('./index');
const { EXECUTION_PROFILES } = require('./constants');
const providerAdapters = require('./providerAdapters');

const LEGACY_AI_CAPABILITY = 'legacy.ai.structured_response';
const ALLOWED_FIELDS = Object.freeze(new Set([
  'endpoint',
  'instructions',
  'input',
  'schemaName',
  'schema'
]));

function getStatus() {
  const provider = providerAdapters.getLegacyProviderStatus();
  return {
    ...provider,
    intelligenceExecution: {
      configured: true,
      legacyCapability: LEGACY_AI_CAPABILITY,
      hostedProviderConfigured: provider.configured,
      hostedCapabilityEnabled: true,
      policy: 'capability-specific',
      pricingConfigured: provider.costTrackingConfigured,
      persistenceMigrationApplied: 'not_verified',
      telemetryDurability: 'audit-log-best-effort'
    }
  };
}

function isConfigured() {
  return providerAdapters.isLegacyProviderConfigured();
}

function getModel() {
  return providerAdapters.getLegacyProviderModel();
}

function sanitizeEndpoint(value) {
  return String(value ?? '').trim().slice(0, 80);
}

function validateLegacyOptions(options = {}) {
  const unsupported = Object.keys(options).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unsupported.length) {
    const error = new Error(`Unsupported legacy AI execution fields: ${unsupported.join(', ')}.`);
    error.status = 400;
    error.code = 'LEGACY_AI_UNSUPPORTED_FIELD';
    throw error;
  }
  if (!options.endpoint || !options.instructions || !options.schemaName || !options.schema) {
    const error = new Error('Legacy AI execution requires endpoint, instructions, schemaName, and schema.');
    error.status = 400;
    error.code = 'LEGACY_AI_REQUEST_INVALID';
    throw error;
  }
}

function buildIntelligenceRequest(authContext, options) {
  return {
    requestId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
    capability: LEGACY_AI_CAPABILITY,
    feature: `legacy.ai.${sanitizeEndpoint(options.endpoint) || 'structured-response'}`,
    taskType: 'ANSWER',
    executionMode: 'SYNCHRONOUS',
    input: {
      endpoint: sanitizeEndpoint(options.endpoint),
      instructions: options.instructions,
      input: options.input,
      schemaName: String(options.schemaName || '').trim().slice(0, 120),
      schema: options.schema
    },
    inputClassification: 'ORGANIZATION_PRIVATE',
    dataSensitivity: 'ORGANIZATION_PRIVATE',
    safetyClassification: 'MEDIUM',
    desiredOutputFormat: 'json',
    outputSchema: options.schema,
    executionProfile: EXECUTION_PROFILES.BALANCED,
    latencyTargetMs: providerAdapters.getLegacyProviderTimeoutMs(),
    maximumCostUsd: null,
    allowHostedInference: true,
    allowLocalInference: false,
    allowPremiumEscalation: false,
    requireHumanReview: false,
    metadata: {
      legacyEndpoint: sanitizeEndpoint(options.endpoint),
      legacySchemaName: String(options.schemaName || '').trim().slice(0, 120),
      requesterRole: authContext?.approvedRole || authContext?.role || null
    }
  };
}

function attachLegacyMetadata(parsed, response) {
  if (parsed && typeof parsed === 'object') {
    Object.defineProperty(parsed, '__aiMetadata', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: {
        requestId: response.providerRequestId || response.requestId || null,
        intelligenceRequestId: response.requestId || null,
        traceId: response.traceId || null,
        usage: response.usage || null,
        estimatedCostUsd: response.estimatedCostUsd === undefined ? null : response.estimatedCostUsd
      }
    });
  }
  return parsed;
}

async function createStructuredResponse(authContext, options, executionOptions = {}) {
  validateLegacyOptions(options);
  const response = await intelligenceExecution.execute(
    authContext,
    buildIntelligenceRequest(authContext, options),
    executionOptions
  );
  return {
    model: response.model,
    parsed: attachLegacyMetadata(response.output, response),
    rawText: response.rawText || JSON.stringify(response.output),
    requestId: response.providerRequestId || response.requestId,
    usage: response.usage || null,
    estimatedCostUsd: response.estimatedCostUsd === undefined ? null : response.estimatedCostUsd,
    latencyMs: response.latencyMs
  };
}

module.exports = {
  LEGACY_AI_CAPABILITY,
  buildIntelligenceRequest,
  createStructuredResponse,
  getModel,
  getStatus,
  isConfigured
};
