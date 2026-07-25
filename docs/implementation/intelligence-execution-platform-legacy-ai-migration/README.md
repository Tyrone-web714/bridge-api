# AI-IEP-002 Legacy AI Migration

Status: Implemented locally; not deployed.

AI-IEP-002 migrates the active legacy `/api/ai` structured-response execution path behind the Intelligence Execution Platform (IEP) while preserving the externally observable API contract. The compatibility route remains available, but route handlers now call `services/intelligenceExecution/legacyAiAdapter.js` instead of directly invoking `services/aiProvider.js`.

Scope completed:

- Registered `legacy.ai.structured_response` as the compatibility capability.
- Added a legacy request adapter that builds an `IntelligenceRequest` from trusted server auth context.
- Activated hosted execution only for the legacy capability through `HOSTED_BALANCED_MODEL`.
- Kept OpenAI execution isolated behind `services/intelligenceExecution/providerAdapters.js`.
- Added mocked regression coverage in `npm run test:ai`.
- Preserved existing `/api/ai` route list, response shape, provider label, model field, `store: false`, readiness shape, and legacy interaction logging.

Not performed:

- No deployment.
- No production migration.
- No production database write.
- No provider/model change.
- No new AI features, agents, retrieval, embeddings, or billing.
