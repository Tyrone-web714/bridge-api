# Enterprise Intelligence Capability Registry

AI-IEP-004A.1 establishes `bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js` as the single authoritative, provider-neutral registry for intelligence capability metadata.

The existing runtime `capabilityRegistry.js` remains as a compatibility adapter, so current IEP callers keep receiving the same lightweight fields and current execution behavior remains unchanged.

Generated artifacts live under `generated/` and must be regenerated with `npm run capability-registry:generate` instead of hand-edited.
