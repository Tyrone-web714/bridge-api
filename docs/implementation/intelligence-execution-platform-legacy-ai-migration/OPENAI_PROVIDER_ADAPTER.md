# OpenAI Provider Adapter

Implementation: `bridge-api/services/intelligenceExecution/providerAdapters.js`.

The provider adapter is the only AI-IEP-002 execution boundary that calls `aiProvider.createStructuredResponse`. It reuses the existing OpenAI implementation rather than duplicating provider SDK logic.

Adapter metadata:

- provider: `openai`
- model identifier: from existing `OPENAI_MODEL` fallback behavior
- model class: `HOSTED_BALANCED`
- supported capability: `legacy.ai.structured_response`
- modalities: `text`
- structured output: supported
- tool use: not supported
- provider storage: `store: false`
- pricing status: `configured` only when both OpenAI token-cost env vars are configured; otherwise `unknown`
- context limit: unknown unless separately configured in a future work package

The adapter normalizes hosted execution results into provider, model, model class, output, usage, provider request ID, estimated cost, actual cost, prompt version, and latency fields.
