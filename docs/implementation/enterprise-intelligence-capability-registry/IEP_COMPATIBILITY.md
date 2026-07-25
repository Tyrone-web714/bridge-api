# IEP Compatibility

Compatibility approach: Option B.

The existing runtime registry interface is preserved: `getCapability(id)` and `listCapabilities()` still return the fields consumed by the planner, policy engine, validators, adapters, and tests.

Existing active and disabled capability statuses are preserved. No execution strategy, provider, model, or production behavior was changed.
