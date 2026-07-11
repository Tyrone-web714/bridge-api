# Database Audit

## Technology

PostgreSQL is used through `pg`; PostGIS is required by readiness checks. Schema initialization is mainly in `bridge-api/db/postgres.js`; SQL migrations exist in `bridge-api/migrations`.

## Entity Inventory

See `database-entities.csv`.

## Tenant Classification Matrix

| Classification | Examples | Required Action |
| --- | --- | --- |
| Organization-private | drivers, manifests, stops, customers, notes, settlements, documents, AI insights, reports | Add immutable `organization_id`, indexes, constraints, and repository filters. |
| Shared-approved safety | verified low bridges, truck restrictions, approved hazards | Separate private submissions from sanitized global records. |
| Reference data | products, barcodes, census/place data | Decide global vs Organization catalog. |
| Audit/security data | audit_events, admin_users, driver_sessions | Add Organization claims/context. |
| Temporary/derived | route_sessions, route events, queues, reports | Add tenant context and retention policy. |

## Findings

- TSR-AUD-001 Critical: domain tables lack Organization tenant keys. Evidence: generated `database-entities.csv` and `bridge-api/db/postgres.js` CREATE TABLE blocks. Impact: cross-tenant leakage risk. Recommendation: additive Organization migration and backfill before API tenant enforcement.
- High: route manifests preserve driver ID assignment, which must remain, but future uniqueness and lookup must include Organization context.
- High: rollback/backfill order is complex because routes, stops, documents, settlements, inventory, photos, and notes are linked.
- Medium: indexes are currently operationally useful but not Organization-scoped.

## Data Integrity Notes

Use current database unless audit proves it unsuitable. Additive migration is safest. Do not drop old keys during first tenant rollout.
