# Current AI Work Package

Package ID: MS-004

Title: Comparative Benchmark Execution

Category: MODEL_SELECTION_AND_BENCHMARKING

Status: BLOCKED

## Objective

Execute comparative benchmark evidence for the MS-003 candidate population using MS-002 hard gates and cheapest-sufficient selection, while preserving the production boundary, freezing repository benchmark fixtures, and recording provider/representative-data blockers instead of fabricating results.

## Approved Scope

- MS-004 dry-run and benchmark execution evidence
- credential presence audit without secret disclosure
- benchmark dataset readiness and frozen fixture audit
- candidate execution manifest
- blocked provider/candidate accounting
- measured spend accounting
- proposed model matrix when evidence exists
- validation and controlled negative tests

## Prohibited Scope

- ninth intelligence domain
- candidate expansion without owner approval
- simulated hosted output presented as real
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

## Dependencies

- MS-001
- MS-002
- MS-003

## Acceptance Criteria

- Exactly 13 benchmark-required capabilities are represented
- D0 capabilities remain excluded
- MS-003 candidate population is preserved
- Provider credentials and adapter availability are audited without logging secrets
- Benchmark-ready D2 fixture datasets and D1 representative-data requirements are audited
- No hosted benchmark result is fabricated
- Measured spend remains at or below the authorized budget ceiling
- No production activation, deployment, migration, or production write occurs

## Required Tests

- `npm.cmd run ms004:prepare`
- `npm.cmd run ms004:generate`
- `npm.cmd run ms004:validate`
- `npm.cmd run ms004:check`
- `npm.cmd run test:ms004`
- `npm.cmd run ms003:validate`
- `npm.cmd run ms003:check`
- `npm.cmd run ms002:validate`
- `npm.cmd run ms002:check`
- `npm.cmd run ms001:validate`
- `npm.cmd run ms001:check`
- `npm.cmd run ai-roadmap:generate`
- `npm.cmd run ai-roadmap:validate`
- `npm.cmd run ai-roadmap:check`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd run test:benchmark-datasets`
- `npm.cmd run test:evaluation-engine`
- `npm.cmd run test:scoring-engine`
- `npm.cmd run test:cost-governance`
- `npm.cmd run test:execution-decisions`
- `npm.cmd run test:decision-governance`
- `npm.cmd run test:knowledge-graph`
- `npm.cmd run test:framework-validation`
- `npm.cmd run test:ai-architecture`
- `npm.cmd run test:security`

## Source-Control Expectation

MS-004 benchmark evidence remains repository-local, unstaged, and uncommitted until a separate controlled review/commit package is approved. Do not push, deploy, run migrations, activate production orchestration, or begin another model-selection architecture package.

## Recommended Commit Message

Record MS-004 benchmark execution evidence

## Next Approved Package

No next implementation package is approved by this record.

## Owner Decision Points

- provide representative historical data for D1 performance selection
- provide provider credentials if live hosted benchmarking should continue
- review any NO_CANDIDATE_PASSED state before candidate expansion
- keep production orchestration deferred until benchmark evidence and owner approval exist
