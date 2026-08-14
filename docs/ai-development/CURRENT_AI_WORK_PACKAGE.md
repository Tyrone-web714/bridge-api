# Current AI Work Package

Package ID: MS-001

Title: TSR AI Capability & Execution Classification

Category: MODEL_SELECTION_AND_BENCHMARKING

Status: IMPLEMENTED_UNCOMMITTED

## Objective

Classify existing TSR intelligence capabilities by execution class so the Model Selection Gate can later benchmark only capabilities that actually require computational or hosted AI execution, without selecting providers, selecting models, activating hosted AI, deploying, migrating, or changing production systems.

## Milestone 1 Completion State

Milestone 1 is complete from the repository/source-control perspective for exactly eight core operational intelligence domains:

- Route Intelligence.
- Driver Intelligence.
- Supervisor Intelligence.
- Warehouse Intelligence.
- Fleet Intelligence.
- Customer Intelligence.
- Operations Intelligence.
- Safety Intelligence.

All eight domains are committed, validated, and pushed as repository-only foundations. They are not deployed, not migrated, not production-certified, not provider-enabled, and not model-enabled by this roadmap state. MS-001 does not add a ninth intelligence domain.

## Approved Scope

- Repository-only AI capability inventory.
- Execution class classification.
- D0 deterministic no-AI exclusion register.
- D1 lightweight computational intelligence register.
- D2 standard AI/generative candidate register.
- D3 advanced reasoning candidate register.
- Hybrid deterministic/AI boundary documentation.
- Safety authority documentation.
- Existing AI provider usage audit.
- Predictive capability classification.
- Voice pipeline decomposition.
- Future benchmark requirement classification.
- Cost sensitivity classification.
- Deterministic generated evidence.
- Validation and controlled negative tests.

## Prohibited Scope

- Ninth intelligence domain.
- Provider selection.
- Model selection.
- Model ranking.
- Commercial model benchmarking.
- Pricing research.
- Premium tier approval.
- Hosted AI activation.
- Provider activation.
- Production orchestration.
- Production APIs.
- Deployment.
- Migrations.
- Production writes.
- Database mutations.
- Object-storage mutations.
- Cloudflare/R2 changes.
- Credential changes.
- Runtime behavior changes.
- New product capability implementation.

## Dependencies

- AI-IEP-005B.1.
- AI-IEP-005B.2.
- SUPERVISOR_INTELLIGENCE.
- WAREHOUSE_INTELLIGENCE.
- FLEET_INTELLIGENCE.
- CUSTOMER_INTELLIGENCE.
- OPERATIONS_INTELLIGENCE.
- SAFETY_INTELLIGENCE.

## Acceptance Criteria

- Exactly eight Milestone 1 intelligence domains remain the source domains for classification.
- Every existing TSR intelligence capability identified by repository evidence has exactly one primary execution class.
- D0 deterministic capabilities are excluded from model benchmarking.
- D1/D2/D3 candidates identify future benchmark requirements without selecting a provider or model.
- Existing provider/model execution paths are audited but not expanded.
- Predictive capabilities are identified separately from generative AI.
- Voice-related decomposition states that no approved backend voice intelligence pipeline exists.
- Safety authority remains deterministic and cannot be overridden by model output or cost.
- No production orchestration, deployment, migration, production write, provider activation, model selection, commercial benchmark, or ninth domain is introduced.

## Required Tests

- `npm.cmd run ms001:generate`
- `npm.cmd run ms001:validate`
- `npm.cmd run ms001:check`
- `npm.cmd run test:ms001`
- `npm.cmd run ai-roadmap:generate`
- `npm.cmd run ai-roadmap:validate`
- `npm.cmd run ai-roadmap:check`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd run test:intelligence-execution`
- `npm.cmd run test:ai`
- `npm.cmd run test:ai-architecture`
- `npm.cmd run test:route-intelligence`
- `npm.cmd run test:driver-intelligence`
- `npm.cmd run test:supervisor-operational-intelligence`
- `npm.cmd run test:supervisor-intelligence`
- `npm.cmd run test:warehouse-intelligence`
- `npm.cmd run test:fleet-intelligence`
- `npm.cmd run test:customer-intelligence`
- `npm.cmd run test:operations-intelligence`
- `npm.cmd run test:safety-intelligence`
- `npm.cmd run test:security`
- `npm.cmd run test:api-tenant`

## Source-Control Expectation

MS-001 is repository-local, unstaged, and uncommitted until validation passes and a separate controlled commit step is performed. Do not stage, commit, push, deploy, run migrations, activate providers, select models, modify production systems, or begin any ninth intelligence domain in this package.

## Completion Report

Use `docs/ai-development/CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN plus MS-001 capability-classification counts and validation evidence.

## Recommended Commit Message

Classify TSR AI capabilities for model selection gate

## Next Approved Package

No next implementation package is approved by this record. The likely next model-selection package is owner review of MS-001 followed, if approved, by MS-002 Benchmark & Acceptance Framework.

## Owner Decision Points

- Review and approve the MS-001 classification before any MS-002 benchmark and acceptance framework package.
- Approve any future provider comparison, model ranking, premium-tier analysis, pricing research, or hosted AI activation separately.
- Keep production orchestration deferred, incomplete, and inactive until model-selection evidence, governance controls, and owner approval exist.
