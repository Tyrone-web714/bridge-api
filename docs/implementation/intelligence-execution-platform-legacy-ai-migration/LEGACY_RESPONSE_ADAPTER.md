# Legacy Response Adapter

Implementation: `bridge-api/services/intelligenceExecution/legacyAiAdapter.js`.

The adapter converts normalized IntelligenceResponse back into the legacy internal result expected by `/api/ai` handlers:

- `model`
- `parsed`
- `rawText`
- `requestId`
- `usage`
- `estimatedCostUsd`
- `latencyMs`

Existing route responses continue to return `ai.provider = openai`, `ai.model`, `ai.store = false`, and the parsed structured output fields. Internal `__aiMetadata` remains non-enumerable and carries safe request, usage, and cost metadata.

Internal execution details not exposed to clients:

- full execution plan
- policy denial internals
- rejected strategies
- provider headers
- provider credentials
- raw provider errors
