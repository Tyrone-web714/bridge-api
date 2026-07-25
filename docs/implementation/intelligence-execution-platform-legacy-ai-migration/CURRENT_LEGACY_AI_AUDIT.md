# Current Legacy AI Audit

Audited route: `bridge-api/routes/ai.js` mounted at `/api/ai`.

Legacy routes found:

- `GET /status`
- `GET /operations`
- `GET /predictions`
- `POST /account-summary`
- `POST /driver-copilot`
- `POST /delivery-notes-summary`
- `POST /account-guidance`
- `POST /delivery-failure-risk`
- `POST /deduction-risk`
- `POST /supervisor-question`
- `POST /account-forecast`
- `POST /product-demand-forecast`
- `POST /route-completion-prediction`
- `POST /operational-heatmap`
- `POST /driver-coaching`
- `POST /incident-reconstruction`
- `POST /what-if-simulation`
- `POST /knowledge-graph-insights`
- `POST /unified-intelligence-dashboard`
- `POST /redelivery-plan`
- `POST /route-risk-explanation`
- `POST /supervisor-brief`

Findings:

- Prompt construction remains in `routes/ai.js` and is source-data oriented.
- Existing request validation remains in each route handler.
- Authentication remains through admin and driver auth helpers plus tenant middleware.
- RBAC remains enforced by existing route middleware and the IEP policy engine.
- Organization context is taken from `req.authContext`, not from request bodies.
- Existing provider implementation remains in `services/aiProvider.js`.
- Existing provider implementation uses `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `OPENAI_INPUT_COST_PER_MILLION_USD`, and `OPENAI_OUTPUT_COST_PER_MILLION_USD`.
- Existing provider implementation calls `https://api.openai.com/v1/responses` with `store: false` and strict JSON schema output.
- Existing interaction logging remains through `repositories.saveAiInteractionLog` and account insight persistence.

Direct provider call inventory:

- Migrated in AI-IEP-002: active `/api/ai` structured-response calls now use `legacyAiAdapter.createStructuredResponse`.
- Permitted provider adapter use: `services/intelligenceExecution/providerAdapters.js` imports `services/aiProvider.js` and calls `aiProvider.createStructuredResponse`.
- Provider service implementation: `services/aiProvider.js` remains the OpenAI-specific implementation.
- Test-only use: `scripts/check-ai-contracts.cjs` imports and mocks `aiProvider`.
- Separate later migration: `services/supervisorIntelligence.js` still imports `aiProvider`; it is not part of the active `/api/ai` compatibility route migration.
- UI/status references: dashboard source still displays OpenAI/provider labels for legacy compatibility.

## AI-IEP-003 Reconciliation Note

The AI-IEP-002 audit classified `services/supervisorIntelligence.js` as a later direct-provider migration. AI-IEP-003 completed that migration; the service now uses `services/intelligenceExecution/supervisorAiAdapter.js` and no longer imports or invokes `aiProvider` directly.
