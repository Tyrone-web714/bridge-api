# Existing AI Provider Usage Audit

| Capability ID | Provider Dependency | Current Type | Evidence |
| --- | --- | --- | --- |
| customer.account_guidance.presentation | legacy.ai.structured_response when used through /api/ai | legacy /api/ai prompt surface plus deterministic summaries | bridge-api/routes/ai.js; docs/implementation/customer-intelligence-foundation/DETERMINISTIC_EXPLANATIONS.md |
| driver.copilot.contextual_response | legacy.ai.structured_response | legacy /api/ai hosted structured response surface | bridge-api/routes/ai.js; bridge-api/scripts/check-driver-copilot-auth.cjs |
| operations.executive_dashboard_synthesis | legacy.ai.structured_response when used through /api/ai | legacy /api/ai unified dashboard prompt surface | bridge-api/routes/ai.js; docs/implementation/operations-intelligence-foundation/generated/operations_summary_report.json |
| platform.legacy_structured_ai_response | OpenAI through providerAdapters for legacy.ai.structured_response | implemented hosted compatibility adapter through IEP | bridge-api/services/intelligenceExecution/legacyAiAdapter.js; bridge-api/services/intelligenceExecution/providerAdapters.js; bridge-api/routes/ai.js |
| route.risk_explanation.presentation | legacy.ai.structured_response path when invoked through /api/ai | disabled/future registry placeholder plus legacy route-risk prompt | docs/implementation/enterprise-intelligence-capability-registry/generated/capability_registry.json; bridge-api/routes/ai.js |
| supervisor.daily_operations_report.narrative | OpenAI through providerAdapters for supervisor.daily_operations_report | implemented hosted advisory narrative through IEP | bridge-api/services/intelligenceExecution/supervisorAiAdapter.js; bridge-api/services/supervisorIntelligence.js |
| supervisor.freeform_question_answer | legacy.ai.structured_response | legacy /api/ai structured response surface | bridge-api/routes/ai.js; docs/implementation/intelligence-execution-platform-legacy-ai-migration/CURRENT_LEGACY_AI_AUDIT.md |

Potential unnecessary model dependency candidates are the legacy prompt surfaces whose deterministic facts already exist and whose future benchmark may show D0/D1 presentation is adequate.
