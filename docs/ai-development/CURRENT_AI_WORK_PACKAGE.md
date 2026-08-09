# Current AI Work Package

Package ID: FLEET_INTELLIGENCE

Title: Fleet Intelligence

Category: CORE_OPERATIONAL_INTELLIGENCE

Status: IMPLEMENTED_UNCOMMITTED

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

- Fleet Intelligence exists locally as an unstaged and uncommitted repository-only foundation.
- Scope is limited to fleet/vehicle operational state and route/vehicle readiness evidence.
- Generated Fleet Intelligence artifacts are deterministic and validate against prohibited-scope mutation checks.
- Predictive maintenance models, autonomous dispatch, autonomous purchasing, hardware, ELD, IoT, product expansion, production APIs, provider activation, deployment, migration, and Customer Intelligence remain prohibited unless separately approved.
- Model-selection and production-orchestration gates remain incomplete.

## Required Tests

- `npm.cmd run fleet-intelligence:validate`
- `npm.cmd run fleet-intelligence:check`
- `npm.cmd run fleet-intelligence:benchmarks`
- `npm.cmd run test:fleet-intelligence`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd test`

## Source-Control Expectation

Fleet Intelligence is implemented locally as unstaged and uncommitted repository-only work pending controlled review, validation, and source-control preservation. Do not stage, commit, push, deploy, run migrations, activate providers, select models, expose production APIs, or begin Customer Intelligence in this package.

## Completion Report

Use `CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN for the controlled review and preservation package.

## Recommended Commit Message

Build Fleet Intelligence foundation

## Next Approved Package

No subsequent business-domain package is approved by this record. Fleet Intelligence is the current implemented-uncommitted package.

## Owner Decision Points

- Approve a separate controlled review, validation, commit, and source-control preservation package before staging or committing Fleet Intelligence.
- Approve any future production runtime API, deployment, migration, provider expansion, model selection, production validation, predictive maintenance, autonomous dispatch, autonomous repair approval, autonomous purchasing, or Customer Intelligence package separately.
- Keep model-selection and production-orchestration gates incomplete until all required Milestone 1 domains are complete and separately approved.
