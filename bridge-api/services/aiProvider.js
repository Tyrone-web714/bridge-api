function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function getApiKey() {
  return cleanText(process.env.OPENAI_API_KEY, 2000);
}

function getModel() {
  return cleanText(process.env.OPENAI_MODEL, 120) || 'gpt-5.5';
}

function isConfigured() {
  return Boolean(getApiKey());
}

function getStatus() {
  return {
    provider: 'openai',
    configured: isConfigured(),
    model: getModel(),
    store: false
  };
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
  const timeoutMs = Number.parseInt(process.env.OPENAI_TIMEOUT_MS, 10) || 30000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    if (!response.ok) {
      const message = body?.error?.message || `OpenAI request failed with HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.providerResponse = body;
      throw error;
    }

    const outputText = extractOutputText(body);
    if (!outputText) {
      const error = new Error('OpenAI response did not include output text.');
      error.status = 502;
      error.providerResponse = body;
      throw error;
    }

    try {
      return {
        model,
        parsed: JSON.parse(outputText),
        rawText: outputText
      };
    } catch (parseError) {
      parseError.status = 502;
      parseError.message = `OpenAI response was not valid JSON: ${parseError.message}`;
      parseError.rawText = outputText;
      throw parseError;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI request timed out after ${timeoutMs}ms.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  createStructuredResponse,
  getModel,
  getStatus,
  isConfigured
};
