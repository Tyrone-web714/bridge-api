const { MODEL_CLASSES } = require('./constants');
const { createError, normalizeProviderError } = require('./errors');

function getHostedAdapterCatalog() {
  return Object.freeze([
    Object.freeze({
      provider: 'openai',
      configured: false,
      modelIdentifier: null,
      modelClass: MODEL_CLASSES.HOSTED_BALANCED,
      modalities: Object.freeze(['text']),
      supportsStructuredOutput: true,
      supportsToolUse: false,
      status: 'DEFERRED',
      supportedCapabilities: Object.freeze([]),
      pricingStatus: 'unknown',
      contextLimit: null,
      store: false,
      timeoutMs: null,
      mappingVersion: 'foundation.deferred.v1'
    })
  ]);
}

async function executeHostedModel() {
  throw createError('Hosted model execution is not enabled in the foundation implementation.', 503, 'HOSTED_MODEL_EXECUTOR_UNAVAILABLE');
}

module.exports = {
  executeHostedModel,
  getHostedAdapterCatalog,
  normalizeProviderError
};
