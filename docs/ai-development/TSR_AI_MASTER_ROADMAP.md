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
- Local HEAD after Safety Intelligence preservation: `be99623e6964ed4af00d46ebeabc1b0c89f7d122`
- Remote HEAD after Safety Intelligence preservation: `be99623e6964ed4af00d46ebeabc1b0c89f7d122`
- Customer Intelligence is committed, validated, and pushed as repository-only work.
- Operations Intelligence is committed, validated, and pushed as repository-only work.
- Safety Intelligence is committed, validated, and pushed as repository-only work.
- Route Intelligence, Driver Intelligence, Supervisor Intelligence, Warehouse Intelligence, Fleet Intelligence, Customer Intelligence, Operations Intelligence, Safety Intelligence, and TSR-AI-WORKFLOW-001 are committed, validated, and pushed.

## Roadmap

### AI Platform Foundation

AI-IEP-004A.1 through AI-IEP-005A.2 are pushed to the remote branch through `e383a32` and remain repository-only unless separate production evidence exists.

### Core Operational Intelligence - Milestone 1

- `AI-IEP-005B.1` Route Intelligence Foundation: `PUSHED`, commit `63a8491d1b7bb65f3fbaae7254ef0579cd57f532`, required validation passed, not deployed, not migrated, and not production-certified.
- `AI-IEP-005B.2` Driver Intelligence Foundation: `PUSHED`, commit `43f8def86334e5cbe0b638b23f237797417e5383`, required validation passed, not deployed, not migrated, and not production-certified.
- `SUPERVISOR_INTELLIGENCE`: `PUSHED`, commit `e0a9502c9d6134c66c6a9e46926956282fa5d7ff`, required validation passed, not deployed, not migrated, and not production-certified.
- `WAREHOUSE_INTELLIGENCE`: `PUSHED`, commit `4a2b2dc7e4a5c2d8bd9a4a0c9f0e407cdc8fd1bb`, required validation passed, not deployed, not migrated, and not production-certified. Scope is limited to route loading/staging awareness, warehouse route-readiness, route/load assignment verification, delivery load completeness, discrepancy and missing-load evidence, warehouse operational exceptions, structured alerts, supervisor/warehouse coordination evidence, route departure readiness, deterministic explanations, human-review flags, and integration with TSR route and operational data.
- `FLEET_INTELLIGENCE`: `PUSHED`, commit `9dfed02df38dc67240b089f4582926f14bbaae7d`, required validation passed, not deployed, not migrated, and not production-certified. Scope is limited to fleet operational state, vehicle assignment awareness, vehicle availability/readiness, route/vehicle compatibility evidence, fleet utilization awareness, vehicle exception detection, unresolved vehicle-operational issues, maintenance-status awareness where existing data already supports it, route-impact awareness caused by vehicle state, structured fleet alerts, supervisor fleet visibility, deterministic explanations, evidence completeness/confidence, human-review flags, and integration with Route, Driver, Supervisor, and Warehouse Intelligence.
- `CUSTOMER_INTELLIGENCE`: `PUSHED`, commit `c975a65e977469629cbce1d8d1136a039cd1f549`, required validation passed, not deployed, not migrated, and not production-certified. Scope is limited to customer/account context, delivery-account history awareness, product purchase history awareness, invoice/spend history awareness, delivery pattern awareness, deduction/exception awareness where existing data supports it, stop/account service-pattern awareness, customer-specific route/stop operational context, structured customer operational exceptions, deterministic summaries/explanations, evidence completeness/confidence, human-review flags, generated artifacts, and integration references with Route, Driver, Supervisor, Warehouse, and Fleet Intelligence where relevant.
- `OPERATIONS_INTELLIGENCE`: `PUSHED`, commit `eb6975a9b59f769311cf9073c9df0abd0fdb90f7`, required validation passed, not deployed, not migrated, and not production-certified. Repository-only work adds deterministic organization operational context, cross-domain operational snapshots, route/driver/supervisor/warehouse/fleet/customer aggregation, cross-domain correlation without causation, operations exceptions, severity, priority, structured alerts, alert lifecycle, summaries, explanations, evidence freshness/completeness/confidence, authority traceability, generated artifacts, and validation scripts.
- `SAFETY_INTELLIGENCE`: `PUSHED`, commit `be99623e6964ed4af00d46ebeabc1b0c89f7d122`, required validation passed, not deployed, not migrated, and not production-certified. Repository-only work adds deterministic organization-level safety context, route safety portfolio aggregation, low-clearance/truck restriction/road closure/residential restriction awareness, driver advisory and speed warning aggregation, route/vehicle safety compatibility awareness, warehouse and operations safety-impact references, Shared Safety integration, safety exceptions, severity, priority, structured alerts, alert lifecycle, summaries, explanations, freshness/completeness/confidence, authority traceability, generated artifacts, and validation scripts.

Milestone 1 Core Operational Intelligence Foundations are complete from the repository/source-control perspective across exactly eight domains: Route, Driver, Supervisor, Warehouse, Fleet, Customer, Operations, and Safety Intelligence. No active intelligence-domain implementation package remains after Safety Intelligence preservation. `MS-001` is the current repository-local Model Selection Gate analysis package and does not add a ninth intelligence domain.

Warehouse Intelligence explicitly excludes employee scoring, warehouse employee ranking, productivity ratings, discipline or termination recommendations, compensation decisions, autonomous workforce decisions, new AI infrastructure, model selection, provider activation, production APIs, deployment, migrations, speculative warehouse automation, robotics, autonomous inventory purchasing, new hardware integrations, and unrelated warehouse-management-system expansion.

Fleet Intelligence explicitly excludes driver scoring, employee ranking, productivity scoring, discipline or termination recommendations, compensation decisions, autonomous workforce decisions, autonomous vehicle dispatch, autonomous maintenance authorization, autonomous parts purchasing, predictive maintenance models unless separately approved, new telematics hardware integration, new ELD integration, new vehicle IoT architecture, new fleet-management-system product scope, model selection, provider activation, production APIs, deployment, migrations, new AI infrastructure, and Customer Intelligence implementation.

Customer Intelligence explicitly excludes customer credit scoring, automated lending or credit decisions, discriminatory profiling, protected-class inference, personality inference, emotional-state inference, employee scoring, driver scoring, sales-rep scoring, autonomous pricing, autonomous discounting, autonomous contract decisions, autonomous customer prioritization, autonomous customer termination, autonomous sales outreach, marketing automation, new CRM platform scope, new payment-processing scope, new financial-accounting system scope, model selection, provider activation, production APIs, deployment, migrations, new AI infrastructure, Operations Intelligence implementation, and Safety Intelligence implementation.

Operations Intelligence approved scope is limited to operational context, cross-domain operational awareness, deterministic operational exceptions, deterministic summaries/explanations, evidence completeness/confidence, and human review. Operations Intelligence explicitly excludes employee scoring, driver ranking, warehouse employee ranking, productivity scoring, discipline, compensation, termination, autonomous dispatch, route reassignment, workforce scheduling, purchasing, customer decisions, pricing, predictive operational models, demand forecasting, ERP/TMS/WMS/CRM product scope, fleet-management product scope, hardware integrations, model selection, provider activation, model activation, production orchestration, production APIs, deployment, migrations, new AI infrastructure, and Safety Intelligence implementation.

Safety Intelligence approved scope is limited to low-clearance hazards, route safety blockers, truck restrictions, no-through-truck restrictions, road closures, residential restriction evidence, driver safety advisories, speed warnings, route safety exceptions, warehouse blockers with safety implications, route/vehicle incompatibility, safety-related Operations exceptions, existing Shared Safety Intelligence, evidence completeness, evidence confidence, evidence freshness, and human review. Safety Intelligence explicitly excludes driver safety scoring, employee safety ranking, employee risk scoring, negligence determination, misconduct determination, discipline recommendation, termination recommendation, compensation decision, insurance eligibility, legal-liability determination, autonomous route shutdown, autonomous driver lockout, autonomous vehicle lockout, autonomous dispatch, autonomous workforce action, crash prediction, accident prediction, fatigue prediction, driver-behavior prediction, injury prediction, insurance-risk prediction, criminal-risk prediction, new telematics hardware, new ELD functionality, camera/computer-vision monitoring, biometric monitoring, generalized OSHA platform scope, generalized DOT-compliance platform scope, insurance platform scope, model selection, provider activation, hosted AI activation, production orchestration, production APIs, deployment, migrations, and new AI infrastructure.

No Maintenance, Inventory, Financial, or Enterprise Intelligence package is part of Milestone 1 in this roadmap.

### Development Workflow

- `TSR-AI-WORKFLOW-001`: `PUSHED`, commit `983457ba6a6adceafbbc4423373e197cbd90fcf7`, required validation passed, not deployed, and not migrated.

### Model Selection and Benchmarking

- `MS-001`: `IMPLEMENTED_UNCOMMITTED`, repository-local AI capability and execution classification. It inventories existing TSR intelligence capabilities, classifies D0/D1/D2/D3 execution requirements, documents deterministic no-AI exclusions, provider usage, predictive boundaries, voice decomposition, safety authority, future benchmark requirements, and cost sensitivity. It is not staged, not committed, not pushed, not deployed, and not production-certified.

Model Selection Gate prerequisites are satisfied from the repository/source-control perspective, and `MS-001` is the current classification analysis package. The gate itself remains `DEFERRED`, incomplete, inactive, and owner-approval gated. No provider, model, premium tier, hosted AI execution, model ranking, commercial benchmark, pricing research, or benchmark recommendation is selected by this roadmap state.

Production orchestration remains `DEFERRED`, incomplete, inactive, and owner-approval gated. No production orchestration, production API activation, deployment, migration, production write, object mutation, credential change, Cloudflare/R2 change, or runtime functionality change is authorized by this roadmap state.
