# TSR AI Master Roadmap

The machine-readable source of truth is `TSR_AI_MASTER_ROADMAP.json`. This Markdown file summarizes the same approved roadmap.

## Status Values

- `PLANNED`: approved roadmap item exists, but implementation has not started.
- `APPROVED`: owner has approved the item as a future package, but implementation has not started.
- `IN_PROGRESS`: implementation is actively underway.
- `IMPLEMENTED_UNCOMMITTED`: files exist locally, but no package commit exists.
- `COMMITTED_LOCAL`: a local commit exists, but the remote branch has not been verified to contain it.
- `PUSHED`: the remote branch has been fetched and verified to contain the package commit.
- `VALIDATED`: required package tests passed against an identifiable tree. This does not imply pushed, deployed, production-ready, or owner-approved for runtime use.
- `BLOCKED`: work cannot proceed without a required decision or external condition.
- `DEFERRED`: intentionally postponed.
- `CANCELLED`: removed from the active roadmap by owner decision.

## Categories

- `AI_PLATFORM_FOUNDATION`
- `CORE_OPERATIONAL_INTELLIGENCE`
- `MODEL_SELECTION_AND_BENCHMARKING`
- `PRODUCTION_ORCHESTRATION`
- `PRODUCTION_OPTIMIZATION`
- `DEVELOPMENT_WORKFLOW`

## Current Verified Source-Control State

- Local branch: `legacy-public-url-final-cleanup`
- Remote branch: `origin/legacy-public-url-final-cleanup`
- Local HEAD after source-control preservation: `42851f0791d02623d6cbf9442d6c96f1ffeeb7ba`
- Remote HEAD after fetch: `42851f0791d02623d6cbf9442d6c96f1ffeeb7ba`
- Local branch matches remote.
- Route Intelligence, Driver Intelligence, and TSR-AI-WORKFLOW-001 are committed, validated, and pushed.

## Roadmap

### AI Platform Foundation

AI-IEP-004A.1 through AI-IEP-005A.2 are pushed to the remote branch through `e383a32` and remain repository-only unless separate production evidence exists.

### Core Operational Intelligence - Milestone 1

- `AI-IEP-005B.1` Route Intelligence Foundation: `PUSHED`, commit `63a8491d1b7bb65f3fbaae7254ef0579cd57f532`, required validation passed, not deployed, not migrated, and not production-certified.
- `AI-IEP-005B.2` Driver Intelligence Foundation: `PUSHED`, commit `43f8def86334e5cbe0b638b23f237797417e5383`, required validation passed, not deployed, not migrated, and not production-certified.
- `SUPERVISOR_INTELLIGENCE`: `IMPLEMENTED_UNCOMMITTED` as a repository-only foundation. Local files exist for deterministic supervisor context, route portfolio visibility, operational exceptions, alerts, lifecycle helpers, summaries, explanations, benchmarks, generated artifacts, and documentation. Not committed, not pushed, not deployed, not migrated, and not production-certified.
- `WAREHOUSE_INTELLIGENCE`: `PLANNED`.
- `FLEET_INTELLIGENCE`: `PLANNED`.
- `CUSTOMER_INTELLIGENCE`: `PLANNED`.
- `OPERATIONS_INTELLIGENCE`: `PLANNED`.
- `SAFETY_INTELLIGENCE`: `PLANNED`.

No Maintenance, Inventory, Financial, or Enterprise Intelligence package is part of Milestone 1 in this roadmap.

### Development Workflow

- `TSR-AI-WORKFLOW-001`: `PUSHED`, commit `983457ba6a6adceafbbc4423373e197cbd90fcf7`, required validation passed, not deployed, and not migrated.

Model selection and production orchestration remain gated and deferred.
