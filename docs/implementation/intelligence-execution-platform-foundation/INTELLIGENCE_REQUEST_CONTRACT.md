# Intelligence Request Contract

The implemented contract is intelligence.request.v1 in services/intelligenceExecution/contracts.js.

Required normalized fields include request ID, schema version, trusted Organization context, trusted user context, feature, capability, task type, execution mode, input, input classification, data sensitivity, safety classification, output format, thresholds, latency target, request cost ceiling, inference permissions, human-review request, idempotency key, trace ID, metadata, and created timestamp.

Trusted server context overrides client-provided Organization/user/role values. Missing Organization context is rejected for tenant-scoped execution.
