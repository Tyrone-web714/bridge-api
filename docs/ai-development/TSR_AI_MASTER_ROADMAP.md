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
- Local HEAD after source-control preservation: `1626aff46f7d8434186bac08293c4d4f83b2a387`
- Remote HEAD after fetch: `1626aff46f7d8434186bac08293c4d4f83b2a387`
- Local branch matches remote.
- Route Intelligence, Driver Intelligence, Supervisor Intelligence, Warehouse Intelligence, and TSR-AI-WORKFLOW-001 are committed, validated, and pushed.

## Roadmap

### AI Platform Foundation

AI-IEP-004A.1 through AI-IEP-005A.2 are pushed to the remote branch through `e383a32` and remain repository-only unless separate production evidence exists.

### Core Operational Intelligence - Milestone 1

- `AI-IEP-005B.1` Route Intelligence Foundation: `PUSHED`, commit `63a8491d1b7bb65f3fbaae7254ef0579cd57f532`, required validation passed, not deployed, not migrated, and not production-certified.
- `AI-IEP-005B.2` Driver Intelligence Foundation: `PUSHED`, commit `43f8def86334e5cbe0b638b23f237797417e5383`, required validation passed, not deployed, not migrated, and not production-certified.
- `SUPERVISOR_INTELLIGENCE`: `PUSHED`, commit `e0a9502c9d6134c66c6a9e46926956282fa5d7ff`, required validation passed, not deployed, not migrated, and not production-certified.
- `WAREHOUSE_INTELLIGENCE`: `PUSHED`, commit `4a2b2dc7e4a5c2d8bd9a4a0c9f0e407cdc8fd1bb`, required validation passed, not deployed, not migrated, and not production-certified. Scope is limited to route loading/staging awareness, warehouse route-readiness, route/load assignment verification, delivery load completeness, discrepancy and missing-load evidence, warehouse operational exceptions, structured alerts, supervisor/warehouse coordination evidence, route departure readiness, deterministic explanations, human-review flags, and integration with TSR route and operational data.
- `FLEET_INTELLIGENCE`: `IMPLEMENTED_UNCOMMITTED` as the single current package. The repository-only foundation exists locally under `bridge-api/services/intelligenceExecution/fleetIntelligence.js`, Fleet validation/generation scripts, and `docs/implementation/fleet-intelligence-foundation`; it is not staged, committed, pushed, deployed, migrated, production-certified, or exposed through a production API. Approved scope is limited to fleet operational state, vehicle assignment awareness, vehicle availability/readiness, route/vehicle compatibility evidence, fleet utilization awareness, vehicle exception detection, unresolved vehicle-operational issues, maintenance-status awareness where existing data already supports it, route-impact awareness caused by vehicle state, structured fleet alerts, supervisor fleet visibility, deterministic explanations, evidence completeness/confidence, human-review flags, and integration with Route, Driver, Supervisor, and Warehouse Intelligence.
- `CUSTOMER_INTELLIGENCE`: `PLANNED`.
- `OPERATIONS_INTELLIGENCE`: `PLANNED`.
- `SAFETY_INTELLIGENCE`: `PLANNED`.

Warehouse Intelligence explicitly excludes employee scoring, warehouse employee ranking, productivity ratings, discipline or termination recommendations, compensation decisions, autonomous workforce decisions, new AI infrastructure, model selection, provider activation, production APIs, deployment, migrations, speculative warehouse automation, robotics, autonomous inventory purchasing, new hardware integrations, and unrelated warehouse-management-system expansion.

Fleet Intelligence explicitly excludes driver scoring, employee ranking, productivity scoring, discipline or termination recommendations, compensation decisions, autonomous workforce decisions, autonomous vehicle dispatch, autonomous maintenance authorization, autonomous parts purchasing, predictive maintenance models unless separately approved, new telematics hardware integration, new ELD integration, new vehicle IoT architecture, new fleet-management-system product scope, model selection, provider activation, production APIs, deployment, migrations, new AI infrastructure, and Customer Intelligence.

No Maintenance, Inventory, Financial, or Enterprise Intelligence package is part of Milestone 1 in this roadmap.

### Development Workflow

- `TSR-AI-WORKFLOW-001`: `PUSHED`, commit `983457ba6a6adceafbbc4423373e197cbd90fcf7`, required validation passed, not deployed, and not migrated.

Model selection and production orchestration remain gated and deferred.
