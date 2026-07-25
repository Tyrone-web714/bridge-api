# IEP Compatibility

Compatibility approach: Option B.

The existing runtime registry interface is preserved: `getCapability(id)` and `listCapabilities()` still return the fields consumed by the planner, policy engine, validators, adapters, and tests.

Existing active and disabled capability statuses are preserved. No execution strategy, provider, model, or production behavior was changed.

## Benchmark Dataset Framework Compatibility

AI-IEP-004A.2 consumes this registry for dataset-capability validation. Dataset presence does not activate capabilities, change runtime execution, approve production benchmark use, or create a second capability registry.
