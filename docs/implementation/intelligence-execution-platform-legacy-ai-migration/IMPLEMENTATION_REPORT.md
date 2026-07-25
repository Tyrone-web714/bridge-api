# Implementation Report

AI-IEP-002 implementation summary:

- Added active capability `legacy.ai.structured_response`.
- Added `services/intelligenceExecution/legacyAiAdapter.js`.
- Activated hosted execution in `services/intelligenceExecution/providerAdapters.js` for the legacy capability only.
- Added model mapping metadata with pricing status preserved as unknown unless env rates are configured.
- Added capability-specific policy in `policyEngine.js` while leaving default hosted inference denied.
- Added planner selected provider/model-class metadata for the legacy hosted strategy.
- Added generic legacy structured output validation.
- Added safe usage/provider metadata to IEP responses.
- Updated `/api/ai` route calls to use the legacy adapter.
- Updated `/health` and `/ready` AI status to use the legacy IEP status adapter.
- Expanded `scripts/check-ai-contracts.cjs` with migration, spoofing, policy, mocked provider, usage, and unknown-cost regression checks.

No application deployment, production write, production migration, or provider/model change was performed.
