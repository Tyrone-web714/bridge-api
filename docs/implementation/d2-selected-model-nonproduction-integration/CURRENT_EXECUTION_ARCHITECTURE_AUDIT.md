# Current D2 Execution Architecture Audit

## Existing Production Paths

- `/api/ai` remains the legacy authenticated AI route surface.
- `services/intelligenceExecution/index.js` coordinates legacy intelligence execution through request normalization, policy evaluation, planning, strategy execution, validation, telemetry, and audit events.
- Existing hosted production execution remains limited to previously approved legacy/supervisor paths.

## Existing Non-Production Paths

- MS-004 benchmark utilities provide provider adapter normalization for Google, Mistral, OpenAI, and Anthropic.
- Google and Mistral adapter code is reusable for non-production D2 selected-model smoke execution.
- Benchmark evidence remains historical selection evidence, not production routing configuration.

## Reusable Abstractions

- `services/rbac.js` for `intelligence.view` authorization.
- `services/tenantContext.js` for organization-boundary normalization and same-organization assertions.
- `services/intelligenceExecution/providerAdapters.js` for Google/Mistral request execution and usage/error normalization.
- `services/intelligenceExecution/errors.js` for structured failures.

## Missing Boundary Filled By This Package

This package adds a selected-D2 registry and a non-production executor. The boundary is explicit: `NON_PRODUCTION_SELECTED_D2`.

No public API expansion was required.

## Security, Tenant, And Cost Implications

- Tenant context is server-derived and evidence-bound.
- Unknown, D0, D1, OpenAI, Anthropic, and tenth-capability attempts fail closed.
- Credentials are read only from process environment by provider adapters; no secret is stored in registry, docs, or generated evidence.
- Cost/usage fields are normalized where provider responses expose them.
