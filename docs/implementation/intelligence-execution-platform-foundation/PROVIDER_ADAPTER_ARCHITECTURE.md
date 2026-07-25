# Provider Adapter Architecture

providerAdapters.js defines the provider-neutral hosted adapter boundary and reports existing OpenAI configuration as deferred adapter metadata.

Existing services/aiProvider.js remains unchanged and is not called by the new execution platform during AI-IEP-001. Future wrapping must preserve current behavior and add tests before migration.

Provider-specific errors are normalized through TSR-owned error shapes and do not expose API keys, raw headers, or sensitive diagnostics.

## AI-IEP-002 Hosted Adapter Activation

The provider-neutral hosted adapter boundary is now active for `legacy.ai.structured_response` only. `services/intelligenceExecution/providerAdapters.js` delegates to the existing `services/aiProvider.js` OpenAI Responses API implementation, preserves `store: false`, preserves existing environment-variable compatibility, and normalizes provider output, usage, request ID, model, model class, and cost metadata.
