# Rollback Procedure

Production migration `007` must not be applied until this phase passes validation and is separately approved for deployment.

If code rollback is needed before production migration:

1. Revert the Logistics Intelligence commit or deploy the previous main commit.
2. Confirm `/health` and `/ready`.
3. Confirm existing route, Shared Safety, BI/KPI, and mobile tenant context tests still pass.

If migration `007` has been applied in a non-production database and must be removed:

1. Stop application traffic to the validation database.
2. Drop dependent Logistics Intelligence tables in reverse dependency order.
3. Remove `007_logistics_intelligence_foundation.sql` from `schema_migrations` only in that validation database.
4. Re-run migrations from a clean baseline.

Do not perform destructive production rollback without a separate approved production rollback plan.
