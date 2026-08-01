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
- Local HEAD before this workflow package: `43f8def86334e5cbe0b638b23f237797417e5383`
- Remote HEAD after fetch: `e383a326bb41513e3aa77c05660bdb74042e7f0d`
- Local branch ahead of remote by 2 commits.
- Route Intelligence and Driver Intelligence are validated local commits, not pushed.

## Roadmap

### AI Platform Foundation

AI-IEP-004A.1 through AI-IEP-005A.2 are pushed to the remote branch through `e383a32` and remain repository-only unless separate production evidence exists.

### Core Operational Intelligence - Milestone 1

- `AI-IEP-005B.1` Route Intelligence Foundation: `VALIDATED`, local commit `63a8491d1b7bb65f3fbaae7254ef0579cd57f532`, not pushed.
- `AI-IEP-005B.2` Driver Intelligence Foundation: `VALIDATED`, local commit `43f8def86334e5cbe0b638b23f237797417e5383`, not pushed.
- `SUPERVISOR_INTELLIGENCE`: `APPROVED` as the next business package only. Not started.
- `WAREHOUSE_INTELLIGENCE`: `PLANNED`.
- `FLEET_INTELLIGENCE`: `PLANNED`.
- `CUSTOMER_INTELLIGENCE`: `PLANNED`.
- `OPERATIONS_INTELLIGENCE`: `PLANNED`.
- `SAFETY_INTELLIGENCE`: `PLANNED`.

No Maintenance, Inventory, Financial, or Enterprise Intelligence package is part of Milestone 1 in this roadmap.

### Development Workflow

- `TSR-AI-WORKFLOW-001`: this package. Status is `IMPLEMENTED_UNCOMMITTED` after files are created and before controlled commit approval.

Model selection and production orchestration remain gated and deferred.
