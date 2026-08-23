# Pilot Wave 2 Integration Execution

Status: PASSED AGAINST DISPOSABLE LOCAL DATABASE

Wave 2 executed the mutating pilot integration validator only after the isolation
preflight returned safe. The target was the disposable local database documented in
`PILOT_WAVE2_DISPOSABLE_ENVIRONMENT.md`.

## Migration Result

Repository migrations were applied in order:

1. `001_audit_events.sql`
2. `002_driver_sessions.sql`
3. `003_multi_tenant_foundation.sql`
4. `004_authentication_rbac_foundation.sql`
5. `005_shared_safety_foundation.sql`
6. `006_bi_kpi_foundation.sql`
7. `007_logistics_intelligence_foundation.sql`
8. `008_fleet_intelligence_scoring_foundation.sql`
9. `009_data_lifecycle_foundation.sql`
10. `010_enterprise_identity_foundation.sql`
11. `011_driver_copilot_permission_repair.sql`
12. `012_intelligence_execution_foundation.sql`

`schema_migrations` contained 12 applied migrations after the run.

## Integration Command

Command:

`npm.cmd run validate:pilot-integration`

Result:

`ok: true`

First run evidence:

| Field | Value |
| --- | --- |
| Run ID | `pilot-1787455292078` |
| Organization | `demo-fleet-a` |
| Route manifest | `pilot-route-pilot-1787455292078` |
| Route status | `completed_with_exceptions` |
| Departure printed | `true` |
| Closeout printed | `true` |
| Route event count | `1` |

Second run evidence:

| Field | Value |
| --- | --- |
| Run ID | `pilot-1787455327609` |
| Organization | `demo-fleet-a` |
| Route manifest | `pilot-route-pilot-1787455327609` |
| Route status | `completed_with_exceptions` |
| Departure printed | `true` |
| Closeout printed | `true` |
| Route event count | `1` |

## Seeded Synthetic Entity Counts After First Run

| Entity | Count |
| --- | ---: |
| Organizations | 3 |
| Drivers | 2 |
| Daily route manifests | 1 |
| Daily route stops | 2 |
| Account orders | 2 |
| Delivery settlements | 2 |
| KPI snapshots | 1 |
| Logistics recommendations | 2 |
| Fleet score snapshots | 1 |
| Shared safety records | 1 |
| Route session events | 1 |

All records were synthetic validation records in a disposable local database.

## Scope Boundary

The successful integration run validates backend/data-flow mechanics only. It does not
approve live pilot configuration, production migrations, APK field testing, D1 activation,
D2 production routing, real Organization data onboarding, or production deployment.
