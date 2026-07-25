class IntelligenceExecutionError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'IntelligenceExecutionError';
    this.code = options.code || 'INTELLIGENCE_EXECUTION_ERROR';
    this.status = options.status || 400;
    this.details = options.details || null;
    this.retryable = options.retryable === true;
  }
}

function createError(message, status, code, details) {
  return new IntelligenceExecutionError(message, { status, code, details });
}

function normalizeProviderError(error, provider = 'unknown') {
  return {
    provider,
    code: String(error?.code || 'PROVIDER_ERROR').slice(0, 120),
    message: String(error?.message || 'Provider request failed.').slice(0, 500),
    retryable: error?.retryable === true,
    providerStatus: error?.providerStatus || null,
    requestId: error?.requestId || null
  };
}

module.exports = {
  IntelligenceExecutionError,
  createError,
  normalizeProviderError
};
