# Test Plan

Contract test script: `npm run test:intelligence-execution`.

Coverage includes request validation, missing Organization context, trusted Organization context overriding spoofed client Organization/user/role fields, capability lookup, disabled capability rejection, policy denial, deterministic-first planning, model class abstraction, malformed request cost ceiling rejection, micro-USD precision, premium denial, hosted inference denial, output validation, unknown cost not defaulting to zero, finite escalation/fallback, tenant-isolated cache keys, audit-event hook presence, provider-error normalization, unsupported strategy boundary, human-review requirement, no execution-record retrieval endpoint, and no direct caller provider/model selection.

The full repository contract suite is also expected to run with `npm test` before staging.
