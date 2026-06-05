function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function getApiKey() {
  return cleanText(process.env.OPENAI_API_KEY, 2000);
}

function getModel() {
  return cleanText(process.env.OPENAI_MODEL, 120) || 'gpt-5.5';
}

function getTimeoutMs() {
  const configured = Number.parseInt(process.env.OPENAI_TIMEOUT_MS, 10);
  if (!Number.isFinite(configured)) return 30000;
  return Math.min(Math.max(configured, 5000), 120000);
}

function isConfigured() {
  return Boolean(getApiKey());
}

function getStatus() {
  return {
    provider: 'openai',
    configured: isConfigured(),
    model: getModel(),
    store: false,
    timeoutMs: getTimeoutMs()
  };
}

function createProviderError(message, options = {}) {
  const error = new Error(message);
  error.status = options.status || 502;
  error.code = options.code || 'ai_provider_error';
  error.retryable = options.retryable === true;
  error.providerStatus = options.providerStatus || null;
  error.requestId = options.requestId || null;
  error.providerResponse = options.providerResponse || null;
  return error;
}

function classifyProviderFailure(status, body, requestId) {
  const providerCode = cleanText(body?.error?.code || body?.error?.type, 120);
  if (status === 401 || status === 403) {
    return createProviderError('AI provider authentication failed. Verify the backend OpenAI key.', {
      status: 503,
      code: 'ai_authentication_failed',
      providerStatus: status,
      requestId,
      providerResponse: body
    });
  }
  if (status === 429) {
    const quotaExceeded = ['insufficient_quota', 'billing_hard_limit_reached'].includes(providerCode);
    return createProviderError(
      quotaExceeded
        ? 'AI quota is unavailable. Check OpenAI billing and usage limits.'
        : 'AI request capacity is temporarily limited. Try again shortly.',
      {
        status: quotaExceeded ? 503 : 429,
        code: quotaExceeded ? 'ai_quota_exceeded' : 'ai_rate_limited',
        retryable: !quotaExceeded,
        providerStatus: status,
        requestId,
        providerResponse: body
      }
    );
  }
  if (status >= 500) {
    return createProviderError('The AI provider is temporarily unavailable. Try again shortly.', {
      status: 503,
      code: 'ai_provider_unavailable',
      retryable: true,
      providerStatus: status,
      requestId,
      providerResponse: body
    });
  }

  const providerMessage = cleanText(body?.error?.message, 500);
  return createProviderError(providerMessage || `AI request failed with HTTP ${status}.`, {
    status,
    code: providerCode || 'ai_request_rejected',
    providerStatus: status,
    requestId,
    providerResponse: body
  });
}

function extractOutputText(responseBody) {
  if (responseBody?.output_text) return String(responseBody.output_text);

  const output = Array.isArray(responseBody?.output) ? responseBody.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.value === 'string') return part.value;
    }
  }

  return '';
}

async function createStructuredResponse({ endpoint, instructions, input, schemaName, schema }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const model = getModel();
  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        store: false,
        metadata: {
          app: 'truck-safe-routing',
          endpoint: cleanText(endpoint, 80)
        },
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: instructions }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(input) }]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: schemaName,
            schema,
            strict: true
          }
        }
      })
    });

    const body = await response.json().catch(() => ({}));
    const requestId = cleanText(response.headers.get('x-request-id'), 200) || null;
    if (!response.ok) {
      throw classifyProviderFailure(response.status, body, requestId);
    }

    const outputText = extractOutputText(body);
    if (!outputText) {
      throw createProviderError('AI response did not include structured output text.', {
        status: 502,
        code: 'ai_empty_response',
        requestId,
        providerResponse: body
      });
    }

    try {
      return {
        model,
        parsed: JSON.parse(outputText),
        rawText: outputText,
        requestId,
        usage: body?.usage || null,
        latencyMs: Date.now() - startedAt
      };
    } catch (parseError) {
      const error = createProviderError('AI response did not match the required structured format.', {
        status: 502,
        code: 'ai_invalid_structured_output',
        requestId,
        providerResponse: body
      });
      error.rawText = outputText;
      throw error;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createProviderError(`AI request timed out after ${timeoutMs}ms.`, {
        status: 504,
        code: 'ai_timeout',
        retryable: true
      });
    }
    if (error?.code) throw error;
    if (error instanceof TypeError) {
      throw createProviderError('The backend could not reach the AI provider.', {
        status: 503,
        code: 'ai_network_error',
        retryable: true
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  classifyProviderFailure,
  createStructuredResponse,
  getModel,
  getStatus,
  getTimeoutMs,
  isConfigured
};
