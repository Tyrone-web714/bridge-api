# Readiness Compatibility

`/api/ai/status`, `/health`, and `/ready` keep the legacy `ai` status fields:

- `provider`
- `configured`
- `model`
- `store`
- `timeoutMs`
- `costTrackingConfigured`

AI-IEP-002 adds compatible nested metadata under `ai.intelligenceExecution`:

- `configured`
- `legacyCapability`
- `hostedProviderConfigured`
- `hostedCapabilityEnabled`
- `policy`
- `pricingConfigured`
- `persistenceMigrationApplied`
- `telemetryDurability`

This avoids claiming the entire Intelligence Execution Platform is fully production-complete. It reports only the legacy hosted capability activation and preserves existing readiness consumers.
