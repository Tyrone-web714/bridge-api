# Rollback Procedure

Production migration `008` must not be applied until this phase passes validation and receives separate release approval.

If code rollback is needed before production migration:

1. Revert the FISS commit or deploy the previous main commit.
2. Confirm `/health` and `/ready`.
3. Confirm Logistics Intelligence, BI/KPI, Shared Safety, tenant, and auth tests still pass.

If migration `008` has been applied in a non-production database and must be removed:

1. Stop application traffic to the validation database.
2. Drop FISS tables in reverse dependency order.
3. Remove `008_fleet_intelligence_scoring_foundation.sql` from `schema_migrations` only in that validation database.
4. Re-run migrations from a clean baseline.

Do not perform destructive production rollback without a separate approved production rollback plan.
