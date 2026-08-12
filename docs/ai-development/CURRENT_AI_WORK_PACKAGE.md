# Current AI Work Package

Package ID: SAFETY_INTELLIGENCE

Title: Safety Intelligence

Category: CORE_OPERATIONAL_INTELLIGENCE

Status: APPROVED

## Objective

Provide deterministic organization-level safety awareness by aggregating and preserving existing TSR safety evidence without overriding authoritative Route, Driver, Supervisor, Warehouse, Fleet, Customer, or Operations Intelligence determinations.

## Approved Scope

- Low-clearance hazards.
- Route safety blockers.
- Truck restrictions.
- No-through-truck restrictions.
- Road closures.
- Residential restriction evidence.
- Driver safety advisories.
- Speed warnings.
- Route safety exceptions.
- Warehouse blockers with safety implications.
- Route/vehicle incompatibility.
- Safety-related Operations exceptions.
- Existing Shared Safety Intelligence.
- Evidence completeness.
- Evidence confidence.
- Evidence freshness.
- Human review.

## Prohibited Scope

- Driver safety scoring.
- Employee safety ranking.
- Employee risk scoring.
- Negligence determination.
- Misconduct determination.
- Discipline recommendation.
- Termination recommendation.
- Compensation decision.
- Insurance eligibility.
- Legal-liability determination.
- Autonomous route shutdown.
- Autonomous driver lockout.
- Autonomous vehicle lockout.
- Autonomous dispatch.
- Autonomous workforce action.
- Crash prediction.
- Accident prediction.
- Fatigue prediction.
- Driver-behavior prediction.
- Injury prediction.
- Insurance-risk prediction.
- Criminal-risk prediction.
- New telematics hardware.
- New ELD functionality.
- Camera/computer-vision monitoring.
- Biometric monitoring.
- Generalized OSHA platform scope.
- Generalized DOT-compliance platform scope.
- Insurance platform scope.
- Model selection.
- Provider activation.
- Hosted AI activation.
- Production orchestration.
- Production APIs.
- Deployment.
- Migrations.
- New AI infrastructure.

## Dependencies

- OPERATIONS_INTELLIGENCE.

## Acceptance Criteria

- Safety Intelligence is approved as the single current package but remains not started.
- Scope is limited to deterministic organization-level safety awareness that aggregates and preserves existing TSR safety evidence.
- Authoritative Route, Driver, Supervisor, Warehouse, Fleet, Customer, and Operations Intelligence determinations are not overridden.
- Driver safety scoring, employee safety ranking, negligence or misconduct determination, autonomous safety action, crash/fatigue/behavior prediction, monitoring hardware, computer vision, biometrics, OSHA/DOT/insurance product expansion, provider/model activation, deployment, migrations, and production APIs remain prohibited.
- Model-selection and production-orchestration gates remain incomplete.

## Required Tests

- `npm.cmd run test:shared-safety`
- `npm.cmd run test:route-intelligence`
- `npm.cmd run test:driver-intelligence`
- `npm.cmd run test:operations-intelligence`
- `npm.cmd run test:security`
- `npm.cmd run test:ai-roadmap`

## Source-Control Expectation

Safety Intelligence is approved as the single current package but remains not started. Do not implement, stage, commit, push, deploy, run migrations, activate providers, select models, modify production systems, fabricate an AI-IEP package number, or expand safety scope without a separate owner-approved implementation package.

## Completion Report

Use docs/ai-development/CODEX_COMPLETION_REPORT_TEMPLATE.md sections A through AN for the controlled Safety Intelligence completion report when implementation is separately approved.

## Recommended Commit Message

Build Safety Intelligence foundation

## Next Approved Package

No subsequent business-domain package is approved by this record. Safety Intelligence is the current approved package and remains not started.

## Owner Decision Points

- Approve a separate controlled implementation package before beginning Safety Intelligence.
- Approve any future production runtime API, deployment, migration, provider expansion, model selection, production validation, autonomous safety action, predictive safety model, safety scoring, monitoring hardware, computer vision, biometric monitoring, OSHA/DOT/insurance product scope, or new AI infrastructure separately.
- Keep model-selection and production-orchestration gates incomplete until Safety Intelligence is implemented, reviewed, committed, validated, pushed, and roadmap-reconciled.
