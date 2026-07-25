# Capability Registry

The registry lives in `bridge-api/services/intelligenceExecution/capabilityRegistry.js`.

Active foundation capability:

- `text.cleanup`: deterministic text normalization, no hosted inference, no model call, cost `0.000000`.

Seeded but disabled foundation capabilities:

- `delivery_note.summarize`
- `policy.answer`
- `route.risk_explanation`

Disabled capabilities document future intent without exposing unsafe or undefined execution paths.

## AI-IEP-002 Capability Addition

The registry now includes active capability `legacy.ai.structured_response` for compatibility migration of existing `/api/ai` structured logistics responses. It permits `HOSTED_BALANCED_MODEL` only and does not authorize premium escalation, new providers, retrieval, agents, embeddings, or arbitrary expansion beyond the existing legacy route behavior.

## AI-IEP-003 Capability Addition

The registry now includes active capability `supervisor.daily_operations_report` for scheduled supervisor daily operations report narrative generation. It permits `HOSTED_BALANCED_MODEL` only, is advisory-only, requires supervisor/operator interpretation before material action, and does not authorize autonomous employment, compensation, safety, routing, or financial decisions.
