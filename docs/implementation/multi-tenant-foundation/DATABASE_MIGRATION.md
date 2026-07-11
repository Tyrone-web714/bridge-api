# Database Migration

Migration file:

- `bridge-api/migrations/003_multi_tenant_foundation.sql`

The migration is additive:

1. Enables `pgcrypto` where required for UUID generation.
2. Creates `organizations`.
3. Creates `tenant_backfill_exceptions`.
4. Inserts or updates the bootstrap Development Organization.
5. Adds nullable `organization_id` to classified Organization-private tables.
6. Adds `internal_driver_id` and `company_driver_number` to drivers.
7. Backfills clearly classified development data to the bootstrap Organization.
8. Adds Organization-scoped indexes.
9. Adds unique driver indexes for internal driver ID and Organization-scoped company driver number.

The migration must be validated on a non-production database before production use. Do not apply it to production until backup, restore, and rollback procedures are approved and verified.

## Known Follow-Up

`daily_route_manifests` still has the existing global `(route_date, route_number)` conflict behavior. A later migration should move this toward Organization-scoped uniqueness after production compatibility is validated.
