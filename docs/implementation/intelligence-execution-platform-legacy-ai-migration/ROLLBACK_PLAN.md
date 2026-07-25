# Rollback Plan

Repository-only rollback for AI-IEP-002:

1. Revert changes to `routes/ai.js` and `server.js` to direct legacy `aiProvider` imports and calls.
2. Revert changes in `services/intelligenceExecution/capabilityRegistry.js`, `policyEngine.js`, `planner.js`, `providerAdapters.js`, `outputValidator.js`, `contracts.js`, and `index.js` made for `legacy.ai.structured_response`.
3. Remove `services/intelligenceExecution/legacyAiAdapter.js`.
4. Revert `scripts/check-ai-contracts.cjs` to pre-migration expectations.
5. Remove this documentation folder and foundation-doc activation notes.

Operational rollback if deployed later:

- Roll back to the previously deployed commit.
- No database rollback is required for AI-IEP-002 because no migration is executed by this work.
- No object storage or Cloudflare rollback is involved.
- Existing OpenAI env vars remain unchanged.
