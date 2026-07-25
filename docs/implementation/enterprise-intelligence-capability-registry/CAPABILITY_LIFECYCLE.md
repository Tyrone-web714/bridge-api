# Capability Lifecycle

Supported lifecycle states are `DRAFT`, `EXPERIMENTAL`, `BENCHMARKING`, `PILOT`, `PRODUCTION`, `DEPRECATED`, and `RETIRED`.

Lifecycle state is distinct from enabled/disabled status, provider availability, policy approval, Organization entitlement, and benchmark readiness.

No separate `SUSPENDED` lifecycle state was added because the existing operational status enum already supports `SUSPENDED` without overloading lifecycle semantics.
