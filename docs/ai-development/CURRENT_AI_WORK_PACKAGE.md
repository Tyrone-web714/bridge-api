# Current AI Work Package

Package ID: D2-SELECTED-MODEL-NONPRODUCTION-INTEGRATION

Title: D2 Selected-Model Non-Production Integration

Category: MODEL_SELECTION_AND_BENCHMARKING

Status: IMPLEMENTED_UNCOMMITTED

## Objective

Make the nine MS-004-selected D2 model assignments executable through TSR controlled non-production architecture while preserving deterministic authority, tenant isolation, runtime hard gates, cost governance, and fail-closed behavior.

## Approved Scope

- selected D2 model registry
- non-production selected-D2 execution mode
- deterministic capability-to-model routing
- Google and Mistral provider adapter reuse through non-production boundary
- structured input and output contracts
- runtime hard gates
- tenant isolation and RBAC checks
- fail-closed fallback behavior
- cost and usage observability
- offline deterministic validation harness
- roadmap and implementation documentation

## Prohibited Scope

- model reselection
- benchmark rerun
- provider consolidation
- D1 activation
- ninth intelligence domain
- production provider routing
- production model assignment
- production orchestration
- production APIs
- deployment
- migrations
- production writes
- database mutations
- object-storage mutations
- Cloudflare/R2 changes
- credential changes
- provider activation
- production traffic
- customer traffic
- hosted calls executed by Codex

## Dependencies

- MS-001
- MS-002
- MS-003
- MS-004

## Acceptance Criteria

- Exactly nine D2 selected capabilities are represented
- MS-004 selected provider/model assignments are locked and unchanged
- Selected-D2 execution requires explicit NON_PRODUCTION_SELECTED_D2 mode
- Unknown, D0, D1, OpenAI, Anthropic, and tenth-capability routing attempts fail closed
- Runtime hard gates validate tenant, schema, evidence grounding, authority boundary, safety boundary, and prohibited output conditions
- Provider failures return controlled degraded/unavailable responses without unselected fallback
- No hosted calls are executed by Codex
- No production activation, deployment, migration, credential change, or production write occurs

## Required Tests

- `node --check services/intelligenceExecution/selectedD2ModelRegistry.js`
- `node --check services/intelligenceExecution/selectedD2NonProductionExecution.js`
- `node --check scripts/check-d2-selected-model-nonproduction.cjs`
- `node --check scripts/run-d2-selected-nonproduction-smoke.cjs`
- `npm.cmd run d2-selected:validate`
- `npm.cmd run d2-selected:check`
- `npm.cmd run test:d2-selected-nonproduction`
- `npm.cmd run ms004:validate`
- `npm.cmd run ms004:check`
- `npm.cmd run test:ms004`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd run test:ai-architecture`
- `npm.cmd run test:security`
- `npm.cmd run test:api-tenant`

## Source-Control Expectation

D2 selected-model non-production integration remains repository-local, unstaged, uncommitted, and unpushed until a separate controlled review/commit package is approved. Do not deploy, run migrations, activate production orchestration, execute hosted calls from Codex, or begin D1 production selection.

## Recommended Commit Message

Integrate selected D2 models for non-production execution

## Next Approved Package

No next implementation package is approved by this record.

## Owner Decision Points

- approve any external non-production live smoke test separately
- provide representative historical data before D1 final method selection
- keep production orchestration deferred until a separate owner-approved package
- review production activation boundary before any provider/model production routing
