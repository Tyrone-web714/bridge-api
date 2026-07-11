# Codex Instructions

You are working on Truck-Safe Routing, an enterprise Logistics Intelligence Platform.

## Non-negotiable rules

- Do not begin coding before auditing the current codebase.
- Do not delete files without explicit justification.
- Do not weaken authentication, authorization, RBAC, or tenant isolation.
- Do not implement an architectural change unless it is reflected in the architecture documentation or an approved Architecture Decision Record (ADR).
- Do not expose one Organization's data to another Organization.
- Do not hardcode Coca-Cola, Sysco, Sigma, or any customer as permanent logic.
- Do not make destructive database changes without rollback guidance.
- Do not bypass audit logging.
- Do not remove tests without replacing them.
- Do not commit secrets.

## Required first deliverable

Before implementation, produce:

1. Current architecture audit
2. Existing database/data model review
3. Existing API endpoint review
4. Existing frontend/mobile component review
5. Security and tenant-isolation risk report
6. Migration plan
7. Rollback plan
8. Test plan
9. Files to modify
10. Implementation sequence

## Implementation rule

Build in phases. Finish one phase, run tests, document changes, then proceed.

Significant design changes must keep implementation and architecture aligned. Examples include adding a new service, changing the tenant model, changing authentication or authorization boundaries, changing database ownership boundaries, or introducing a new AI capability. Small fixes that do not alter the architecture do not require a documentation change.
