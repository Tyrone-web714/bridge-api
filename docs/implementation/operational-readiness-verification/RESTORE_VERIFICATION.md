# Restore Verification

Status: PASSED.

## Result

Production Restore Verification passed through a controlled non-production Render PostgreSQL PITR restore rehearsal.

No production database, production `DATABASE_URL`, production service configuration, migrations, or production data were modified.

## Recovery Rehearsal Evidence

| Item | Result |
| --- | --- |
| Source database | `truck-safe-routing-db` |
| Source database ID | `dpg-d88mpah9rddc738jl2tg-a` |
| Recovery method | Render PostgreSQL Point-in-Time Recovery |
| Recovery point selected | `2026-07-18 10:56:29 UTC-05:00` |
| Restore start click timestamp | `2026-07-18T16:08:04Z` |
| Restored database name | `tsr-restore-rehearsal-20260718` |
| Restored database ID | `dpg-d9dq9qe1a83c73b85sq0-a` |
| Restored database plan | `Basic-1gb` |
| Restored database region | Oregon (US West) |
| Initial restored status | `Recovery In Progress` |
| Completion/available timestamp | `2026-07-18T16:10:53Z` |
| Production health after restore | `/health` HTTP 200 |
| Production readiness after restore | `/ready` HTTP 200 |
| Temporary restore cleanup | Not performed; owner review required |

## Read-Only Validation Results

The existing `npm.cmd run production:db:preflight` tooling was run against the restored database with `DATABASE_SSL=true` and a temporary connection-string handoff outside Git. Temporary files were deleted after validation and no connection string was written to repository documentation.

Preflight result:

- `ok: true`
- `readOnly: true`
- PostgreSQL `18.4 (Debian 18.4-1.pgdg12+1)`
- PostGIS enabled
- `schema_migrations` exists
- migrations `001` through `010` are all applied
- expected foundation tables exist
- Organization ownership checks passed
- driver identity checks passed

Ownership checks:

| Check | Count |
| --- | ---: |
| `drivers.organization_id NULL` | 0 |
| `daily_route_manifests.organization_id NULL` | 0 |
| `daily_route_stops.organization_id NULL` | 0 |
| `delivery_notes.organization_id NULL` | 0 |

Driver identity checks:

| Check | Count |
| --- | ---: |
| `drivers.internal_driver_id NULL` | 0 |
| duplicate Organization/company driver numbers | 0 |

Representative restored counts:

| Table | Count |
| --- | ---: |
| `organizations` | 1 |
| `admin_users` | 2 |
| `drivers` | 1 |
| `driver_sessions` | 6 |
| `warehouse_employees` | 1 |
| `warehouse_employee_sessions` | 0 |
| `daily_route_manifests` | 1 |
| `daily_route_stops` | 10 |
| `delivery_notes` | 2 |
| `retention_policies` | 14 |
| `organization_memberships` | 0 |

These counts are reasonably consistent with the owner-approved production preflight baseline.

## Service Attachment Check

The restored database dashboard Apps page showed only optional database admin app deployment options such as pgAdmin and PgHero. No production web service was intentionally pointed at or configured to use the restored database during this rehearsal.

Production `/health` and `/ready` remained HTTP 200 after the restore.

## Discrepancies

No restored schema, migration, ownership, driver identity, or representative count discrepancies were found.

One local validation attempt from the Node REPL was blocked by local sandbox network policy. The validation was rerun successfully through the approved elevated shell path using the same read-only preflight tooling.

## Cleanup Recommendation

The temporary restored database `tsr-restore-rehearsal-20260718` remains available in Render for owner review.

Recommended owner decision:

1. Keep it temporarily if more non-production verification is needed.
2. Suspend or delete it after review to avoid unnecessary cost.
3. Do not connect production services to it unless executing a separately approved production recovery/cutover plan.
