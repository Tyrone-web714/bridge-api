# Current AI Work Package

Package ID: MS-003

Title: Candidate Model & Method Selection

Category: MODEL_SELECTION_AND_BENCHMARKING

Status: IMPLEMENTED_UNCOMMITTED

## Objective

Identify the bounded benchmark candidate method/model set for the 13 MS-001 benchmark-required TSR capabilities by using MS-002 acceptance contracts, current official model/provider documentation, current pricing, and cheapest-sufficient discipline without executing hosted benchmarks or selecting final providers/models.

## Approved Scope

- repository-only candidate model and method selection
- current official model/provider documentation research
- current pricing research
- D1 non-LLM candidate method selection
- D2 bounded hosted model shortlist
- screened-out candidate register
- source register
- normalized cost estimates
- MS-004 benchmark size and budget forecast
- provider adapter compatibility assessment
- privacy/security provider facts
- validation and controlled negative tests

## Prohibited Scope

- ninth intelligence domain
- final provider selection
- final model selection
- winning model assignment
- production provider assignment
- primary/fallback model routing
- hosted benchmark execution
- live model API calls
- provider activation
- hosted AI activation
- production orchestration
- production APIs
- deployment
- migrations
- production writes
- database mutations
- object-storage mutations
- Cloudflare/R2 changes
- credential changes
- runtime behavior changes
- provider adapter implementation

## Dependencies

- MS-001
- MS-002

## Acceptance Criteria

- Exactly 13 benchmark-required capabilities are included
- D0 deterministic capabilities remain excluded from model/provider research for execution purposes
- D1 capabilities use low-complexity statistical/local methods before any hosted generative model
- D2 capabilities have deliberately bounded candidate model sets
- Current official documentation and pricing sources are recorded
- Pricing and workload cost estimates are separated
- Screened-out candidates and unverified current information are recorded
- No final provider, model, winner, production route, hosted benchmark result, deployment, migration, production write, or ninth domain is introduced

## Required Tests

- `npm.cmd run ms003:generate`
- `npm.cmd run ms003:validate`
- `npm.cmd run ms003:check`
- `npm.cmd run test:ms003`
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

MS-003 remains repository-local, unstaged, and uncommitted until validation passes and a separate controlled review/commit step is performed. Do not stage, commit, push, deploy, run migrations, activate providers, select models, execute hosted benchmarks, modify production systems, or begin any ninth intelligence domain in this package.

## Recommended Commit Message

Select MS-003 benchmark candidates

## Next Approved Package

No next implementation package is approved by this record. MS-004 benchmark execution requires a separate owner-approved package.

## Owner Decision Points

- review and approve MS-003 candidate set preservation
- approve any MS-004 hosted benchmark execution separately
- approve benchmark credentials/provider access separately if MS-004 proceeds
- keep production orchestration deferred, incomplete, and inactive until benchmark winners and governance controls are separately approved
