# Capability Registry

The registry lives in `bridge-api/services/intelligenceExecution/capabilityRegistry.js`.

Active foundation capability:

- `text.cleanup`: deterministic text normalization, no hosted inference, no model call, cost `0.000000`.

Seeded but disabled foundation capabilities:

- `delivery_note.summarize`
- `policy.answer`
- `route.risk_explanation`

Disabled capabilities document future intent without exposing unsafe or undefined execution paths.
