# Implementation Order

## Phase 0 — Audit

- Inventory apps, services, APIs, database tables, environment variables, and deployments.
- Identify single-tenant assumptions.
- Identify security risks.
- Identify code paths touching private data.

## Phase 1 — Multi-Tenant Foundation

- Add Organization model.
- Add immutable `organization_id` to private records.
- Seed initial organizations for testing only:
  - Arca Continental Southwest Beverages
  - Sysco
  - Sigma
- Create migration and rollback scripts.

## Phase 2 — Authentication & Authorization

- Resolve authenticated user to `user_id`, `organization_id`, role, permissions, and status.
- Enforce server-side authorization.
- Add deny-by-default permission logic.

## Phase 3 — Tenant Isolation

- Protect all private API endpoints.
- Add tests proving cross-tenant access fails.
- Ensure cache keys include Organization context.

## Phase 4 — Shared Safety Intelligence

- Create private safety submissions.
- Add Platform Admin review workflow.
- Publish only approved sanitized hazards globally.

## Phase 5 — Audit Logging

- Log sensitive actions immutably.
- Log failed authorization attempts.

## Phase 6 — Fleet Operations

- Align drivers, vehicles, routes, stops, notes, photos, and customer intelligence with Organization boundaries.

## Phase 7 — KPI & BI Foundation

- Add configurable KPIs, formula versioning, dashboards, reports, and organization-scoped analytics.

## Phase 8 — AI Decision Intelligence

- Add explainable AI recommendations.
- Require human approval before operational changes.

## Phase 9 — Production Readiness

- Security testing.
- Load testing.
- Monitoring.
- Backup and disaster recovery validation.
- Documentation update.
