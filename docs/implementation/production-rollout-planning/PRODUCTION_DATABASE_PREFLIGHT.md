# Production Database Preflight

Script: `npm.cmd run production:db:preflight`

Default behavior: read-only transaction.

Checks:

- Database connectivity.
- PostgreSQL version.
- PostGIS extension availability.
- `schema_migrations` state.
- Expected tables for migrations 001-008.
- Table counts.
- NULL Organization ownership indicators.
- Driver internal identity and Organization-scoped company driver number duplicate indicators.

Production rule:

- OWNER APPROVAL REQUIRED BEFORE EXECUTION against production.
- Do not print credentials.
- Do not repair data.
- Any failure becomes a pre-migration blocker until reviewed.

Starting production state is currently NOT VERIFIED. No production migration may be approved until this preflight or an equivalent read-only inspection establishes actual schema state.

Non-production validation result:

- Passed against `tsr_rollout_source_1784342000`.
- Passed against restored database `tsr_rollout_restore_1784342000`.
- Verified migrations 001-008, expected tables, PostGIS, ownership indicators, driver identity indicators, and table counts.
