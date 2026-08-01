# Current AI Work Package

Package ID: TSR-AI-WORKFLOW-001

Title: TSR AI Development Roadmap and Architect-Builder Handoff Protocol

Category: DEVELOPMENT_WORKFLOW

Status: IMPLEMENTED_UNCOMMITTED

## Objective

Create repository-based workflow records that coordinate owner, ChatGPT, Codex, and GitHub without changing TSR application behavior.

## Approved Scope

- Roadmap documentation.
- Machine-readable roadmap records.
- Current work package records.
- Standardized completion report template.
- ChatGPT/Codex handoff rules.
- Scope-control policy.
- Scope-change proposal template.
- Source-control policy.
- Model-selection gate.
- Production-orchestration gate.
- Validation scripts.
- Deterministic generated summaries.
- Package scripts.
- Documentation.
- Tests.

## Prohibited Scope

- Supervisor Intelligence implementation.
- New product features.
- New intelligence domains.
- Predictive logic.
- LLM prompts.
- Model selection.
- Provider calls.
- Runtime API exposure.
- Runtime behavior change.
- Deployment.
- Push.
- Migration.

## Dependencies

- AI-IEP-005B.2 Driver Intelligence Foundation.

## Acceptance Criteria

- Approved roadmap exists in Markdown and JSON.
- Exactly one current package exists.
- Scope-control rules are explicit.
- Completion reports are standardized.
- GitHub workflow distinguishes local commit, push, and deployment state.
- Model-selection and production-orchestration gates are explicit.
- Validation tooling passes.
- Generated summaries are deterministic.
- Existing route, driver, security, and full npm tests pass.
- Nothing is staged, committed, pushed, deployed, or migrated.

## Required Tests

- `node --check scripts/check-ai-development-roadmap.cjs`
- `node --check scripts/generate-ai-development-roadmap-artifacts.cjs`
- `npm.cmd run ai-roadmap:generate`
- `npm.cmd run ai-roadmap:validate`
- `npm.cmd run ai-roadmap:check`
- `npm.cmd run test:ai-roadmap`
- `npm.cmd run test:route-intelligence`
- `npm.cmd run test:driver-intelligence`
- `npm.cmd run test:security`
- `npm.cmd test`

## Source-Control Expectation

Leave this workflow package unstaged and uncommitted. Do not push.

## Completion Report

Use `CODEX_COMPLETION_REPORT_TEMPLATE.md` sections A through AN.

## Recommended Commit Message

Add TSR AI roadmap and architect-builder workflow

## Next Approved Package

Supervisor Intelligence is the next approved roadmap item only. Do not begin it in this package and do not fabricate a package number.

## Owner Decision Points

- Approve controlled review and commit of this workflow package.
- Approve any future push.
- Approve any future Supervisor Intelligence package prompt.
