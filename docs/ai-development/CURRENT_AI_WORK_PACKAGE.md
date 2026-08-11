# Current AI Work Package

Package ID: CUSTOMER_INTELLIGENCE

Title: Customer Intelligence

Category: CORE_OPERATIONAL_INTELLIGENCE

Status: IMPLEMENTED_UNCOMMITTED

## Objective

Record the locally implemented repository-only Customer Intelligence package for deterministic customer/account operational awareness and customer-specific route/stop context.

## Approved Scope

- Customer/account operational context.
- Delivery-account history awareness.
- Product purchase history awareness.
- Invoice/spend history awareness.
- Delivery pattern awareness.
- Deduction/exception awareness where existing data supports it.
- Stop/account service-pattern awareness.
- Customer-specific route/stop operational context.
- Structured customer operational exceptions.
- Deterministic summaries/explanations.
- Evidence completeness/confidence.
- Human-review flags.
- Integration with Route, Driver, Supervisor, Warehouse, and Fleet Intelligence where relevant.

## Prohibited Scope

- Customer credit scoring.
- Automated lending/credit decisions.
- Discriminatory profiling.
- Protected-class inference.
- Personality inference.
- Emotional-state inference.
- Employee scoring.
- Driver scoring.
- Sales-rep scoring.
- Autonomous pricing decisions.
- Autonomous discounting decisions.
- Autonomous contract decisions.
- Autonomous customer prioritization.
- Autonomous customer termination.
- Autonomous sales outreach.
- Marketing automation.
- New CRM platform scope.
- New payment-processing scope.
- New financial-accounting system scope.
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
- FLEET_INTELLIGENCE Fleet Intelligence.
- TSR-AI-WORKFLOW-001 repository workflow and handoff process.

## Acceptance Criteria

- Customer Intelligence foundation is implemented locally as repository-only work and remains unstaged, uncommitted, unpushed, undeployed, and unmigrated pending controlled review.
- Scope is limited to customer/account operational context, delivery/account/product/invoice history awareness, service-pattern evidence, customer-specific route/stop context, operational exceptions, deterministic explanations, evidence completeness/confidence, and human-review flags.
- Credit scoring, protected-class inference, autonomous pricing/discounting/contract/customer/sales decisions, marketing automation, CRM/payment/accounting platform expansion, model selection, provider activation, production APIs, deployment, migrations, and new AI infrastructure remain prohibited.
- Operations Intelligence and Safety Intelligence remain planned and have not begun.
- Model-selection and production-orchestration gates remain incomplete.

## Required Tests

- `npm.cmd run customer-intelligence:generate`
- `npm.cmd run customer-intelligence:validate`
- `npm.cmd run customer-intelligence:check`
- `npm.cmd run customer-intelligence:benchmarks`
- `npm.cmd run test:customer-intelligence`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd run test:knowledge-graph`
- `npm.cmd run test:dashboard-data`
- `npm.cmd run test:framework-validation`
- `npm.cmd run test:intelligence-orchestration`
- `npm.cmd run test:intelligence-lifecycle`
- `npm.cmd run test:route-intelligence`
- `npm.cmd run test:driver-intelligence`
- `npm.cmd run test:supervisor-operational-intelligence`
- `npm.cmd run test:supervisor-intelligence`
- `npm.cmd run test:warehouse-intelligence`
- `npm.cmd run test:fleet-intelligence`
- `npm.cmd run test:logistics-intelligence`
- `npm.cmd run test:predictions`
- `npm.cmd run test:imports`
- `npm.cmd run test:delivery-settlement`
- `npm.cmd run test:security`
- `npm.cmd test`

## Source-Control Expectation

Customer Intelligence has been implemented locally as repository-only work. Leave the working tree dirty and unstaged for a separate controlled review/validation/commit session. Do not stage, commit, push, deploy, run migrations, activate providers, select models, modify production systems, fabricate an AI-IEP package number, or begin Operations/Safety Intelligence in this implementation session.

## Completion Report

Use `CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN for the controlled Customer Intelligence completion report.

## Recommended Commit Message

Build Customer Intelligence foundation

## Next Approved Package

No subsequent business-domain package is approved by this record. Customer Intelligence is the current locally implemented, uncommitted package pending controlled review.

## Owner Decision Points

- Approve a separate controlled review, validation, and commit session before staging or committing Customer Intelligence.
- Approve any future production runtime API, deployment, migration, provider expansion, model selection, production validation, credit decisioning, pricing/discounting, sales outreach, CRM expansion, payment-processing, or financial-accounting scope separately.
- Keep model-selection and production-orchestration gates incomplete until all required Milestone 1 domains are complete and separately approved.
