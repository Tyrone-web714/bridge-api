# Migration Architecture

The migration keeps the legacy client contract and changes the execution path.

Before:

`/api/ai` route -> `services/aiProvider.js` -> OpenAI Responses API

After:

`/api/ai` route -> `legacyAiAdapter` -> `intelligenceExecution.execute` -> policy -> planner -> provider-neutral hosted executor -> OpenAI provider adapter -> existing `aiProvider`

Boundary rules:

- Business routes do not call provider services directly.
- Provider-specific request shape remains in `services/aiProvider.js` and `providerAdapters.js`.
- The legacy adapter owns compatibility translation in both directions.
- The planner selects `HOSTED_BALANCED_MODEL` only for `legacy.ai.structured_response`.
- OpenAI remains the only provider because adding providers is not authorized.
- The existing production model configuration is preserved through `OPENAI_MODEL`.
