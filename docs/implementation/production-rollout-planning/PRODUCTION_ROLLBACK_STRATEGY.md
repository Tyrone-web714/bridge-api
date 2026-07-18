# Production Rollback Strategy

Rollback should not be treated as running down migrations.

## Options

A. Application rollback only.

B. Previous application version runs forward-compatible against the migrated schema.

C. Corrective forward migration.

D. Database restore.

## Preferred Strategy

- 001-002: application rollback usually sufficient if additive.
- 003-004: backup/restore or corrective forward migration for failed tenant/auth migration; avoid destructive down-migration.
- 005-008: application rollback for code failures; corrective forward migration for schema defects; preserve safety, KPI, intelligence, and score history.

## Rollback Triggers

- `/ready` fails after migration/deploy.
- Authentication or RBAC regression.
- Tenant isolation denial test fails.
- Driver assigned-route read fails.
- Warehouse departure/return workflow fails.
- Shared Safety private data leak.
- BI/KPI, Logistics, or FISS causes Critical/High data or security defect.

Rollback decision owner: OWNER APPROVAL REQUIRED before production execution.
