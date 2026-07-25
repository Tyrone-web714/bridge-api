# Intelligence Response Contract

The implemented contract is intelligence.response.v1 in services/intelligenceExecution/contracts.js.

Responses include request ID, trace ID, Organization ID, capability, status, execution strategy, provider, model, model class, output, confidence, evidence, validation results, human-review flag, cache status, latency, estimated cost, actual cost, escalation path, fallback path, prompt version, policy version, timestamps, and errors.

Provider and model fields are null for deterministic execution. Confidence is unavailable unless produced by a defined method.
