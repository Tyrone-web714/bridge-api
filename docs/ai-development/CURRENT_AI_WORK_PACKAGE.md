# Current AI Work Package

Package ID: CUSTOMER_INTELLIGENCE

Title: Customer Intelligence

Category: CORE_OPERATIONAL_INTELLIGENCE

Status: APPROVED

## Objective

Prepare the approved repository-only Customer Intelligence package for deterministic customer/account operational awareness and customer-specific route/stop context.

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

- Customer Intelligence remains approved as the next package but unimplemented until a separate implementation session begins.
- Scope is limited to customer/account operational context, delivery/account/product/invoice history awareness, service-pattern evidence, customer-specific route/stop context, operational exceptions, deterministic explanations, evidence completeness/confidence, and human-review flags.
- Credit scoring, protected-class inference, autonomous pricing/discounting/contract/customer/sales decisions, marketing automation, CRM/payment/accounting platform expansion, model selection, provider activation, production APIs, deployment, migrations, and new AI infrastructure remain prohibited.
- Model-selection and production-orchestration gates remain incomplete.

## Required Tests

- `npm.cmd run test:ai-roadmap`

## Source-Control Expectation

Customer Intelligence is approved as the next repository-only Milestone 1 package but implementation has not started. Do not stage runtime behavior, create production APIs, deploy, run migrations, activate providers, select models, modify production systems, fabricate an AI-IEP package number, or begin implementation outside a separately approved Customer Intelligence work package.

## Completion Report

Use `CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN for the future controlled Customer Intelligence implementation package.

## Recommended Commit Message

Build Customer Intelligence foundation

## Next Approved Package

No subsequent business-domain package is approved by this record. Customer Intelligence is the current approved, unimplemented package.

## Owner Decision Points

- Approve a separate controlled Customer Intelligence implementation work package before creating runtime or documentation implementation artifacts.
- Approve any future production runtime API, deployment, migration, provider expansion, model selection, production validation, credit decisioning, pricing/discounting, sales outreach, CRM expansion, payment-processing, or financial-accounting scope separately.
- Keep model-selection and production-orchestration gates incomplete until all required Milestone 1 domains are complete and separately approved.
