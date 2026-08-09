# Current AI Work Package

Package ID: FLEET_INTELLIGENCE

Title: Fleet Intelligence

Category: CORE_OPERATIONAL_INTELLIGENCE

Status: APPROVED

## Objective

Prepare the approved repository-only Fleet Intelligence package for deterministic fleet/vehicle operational awareness and route/vehicle readiness analysis.

## Approved Scope

- Fleet operational state.
- Vehicle assignment awareness.
- Vehicle availability.
- Vehicle readiness.
- Route/vehicle compatibility evidence.
- Fleet utilization awareness.
- Vehicle exception detection.
- Unresolved vehicle-operational issues.
- Maintenance-status awareness where existing data already supports it.
- Route-impact awareness caused by vehicle state.
- Structured fleet alerts.
- Supervisor fleet visibility.
- Deterministic explanations.
- Evidence completeness/confidence.
- Human-review flags.
- Integration with Route, Driver, Supervisor, and Warehouse Intelligence.

## Prohibited Scope

- Driver scoring.
- Employee ranking.
- Productivity scoring.
- Discipline recommendations.
- Termination recommendations.
- Compensation decisions.
- Autonomous workforce decisions.
- Autonomous vehicle dispatch.
- Autonomous maintenance authorization.
- Autonomous parts purchasing.
- Predictive maintenance models in this foundation unless separately approved.
- New telematics hardware integration.
- New ELD integration.
- New vehicle IoT architecture.
- New fleet-management-system product scope.
- Model selection.
- Provider activation.
- Production APIs.
- Deployment.
- Migrations.
- New AI infrastructure.

## Dependencies

- AI-IEP-005B.1 Route Intelligence Foundation.
- AI-IEP-005B.2 Driver Intelligence Foundation.
- SUPERVISOR_INTELLIGENCE Supervisor Intelligence.
- WAREHOUSE_INTELLIGENCE Warehouse Intelligence.
- TSR-AI-WORKFLOW-001 repository workflow and handoff process.

## Acceptance Criteria

- Fleet Intelligence remains approved but unimplemented until a separate implementation package begins.
- Scope is limited to fleet/vehicle operational state and route/vehicle readiness evidence.
- Predictive maintenance models, autonomous dispatch, autonomous purchasing, hardware, ELD, IoT, and product expansion remain prohibited unless separately approved.
- Model-selection and production-orchestration gates remain incomplete.

## Required Tests

- `npm.cmd run test:ai-roadmap`

## Source-Control Expectation

Fleet Intelligence is approved as the next current package, but implementation must not begin in this reconciliation package. Do not stage product/runtime changes, deploy, run migrations, activate providers, select models, or push without a separately approved implementation and source-control package.

## Completion Report

Use `CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN for any future implementation package.

## Recommended Commit Message

Build Fleet Intelligence foundation

## Next Approved Package

No subsequent business-domain package is approved by this record. Fleet Intelligence is the current approved but unstarted package.

## Owner Decision Points

- Approve a separate Fleet Intelligence implementation package before any code or product behavior changes.
- Approve any future production runtime API, deployment, migration, provider expansion, model selection, or production validation separately.
- Keep model-selection and production-orchestration gates incomplete until all required Milestone 1 domains are complete and separately approved.
