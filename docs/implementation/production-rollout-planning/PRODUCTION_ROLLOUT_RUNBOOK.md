# Production Rollout Runbook

## Pre-Deployment

1. Verify release commit on `main`.
2. Run full regression.
3. OWNER APPROVAL REQUIRED BEFORE EXECUTION: run production read-only database preflight.
4. OWNER APPROVAL REQUIRED BEFORE EXECUTION: capture production database backup.
5. OWNER APPROVAL REQUIRED BEFORE EXECUTION: verify restore target and restore procedure.
6. Confirm Render env vars.
7. Confirm object storage env vars.
8. Confirm mobile API base URL plan.

## Migration

1. OWNER APPROVAL REQUIRED BEFORE EXECUTION: apply approved migrations 001-008 or permit deployment startup migration.
2. Verify `schema_migrations`.
3. Verify PostGIS.
4. Run read-only schema checks.

## Deployment

1. OWNER APPROVAL REQUIRED BEFORE EXECUTION: deploy backend.
2. Watch Render logs.
3. Confirm service is stable.

## Validation

1. Check `/health`.
2. Check `/ready`.
3. Run deployed smoke checks.
4. Verify auth, RBAC, tenant isolation.
5. Verify admin, supervisor, driver, warehouse, Shared Safety, BI/KPI, Logistics, and FISS read paths.

## Monitoring

1. Monitor Render logs.
2. Monitor readiness failures.
3. Monitor auth failures, tenant denials, API errors, DB errors, and object storage errors.

## Rollback Decision

Rollback requires owner approval unless an emergency operator authority has been explicitly assigned.

## Rollback Execution

1. OWNER APPROVAL REQUIRED BEFORE EXECUTION: application rollback.
2. OWNER APPROVAL REQUIRED BEFORE EXECUTION: corrective forward migration or database restore if required.
3. Verify `/health` and `/ready`.
4. Record incident and evidence.

## Post-Rollout

1. Record release outcome.
2. Archive validation evidence.
3. Update `PROJECT_STATUS.md`.
4. Schedule follow-up on ODR-019 and ODR-020 only after rollout baseline is stable.
