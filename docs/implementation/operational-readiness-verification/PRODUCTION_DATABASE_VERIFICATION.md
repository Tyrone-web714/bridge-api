# Production Database Verification

Status: OWNER APPROVAL REQUIRED.

No production database preflight was executed in this phase.

## Reason

The production rollout plan requires explicit owner approval before connecting to the production `DATABASE_URL`, even for read-only inspection. That approval was not included with this phase request.

Required owner approval language:

> I approve running the non-destructive read-only production database preflight against the actual TSR production PostgreSQL/PostGIS database. Do not modify or repair any production data.

## Tooling

Script: `npm.cmd run production:db:preflight`

The script is read-only and uses `BEGIN READ ONLY`. During this phase it was updated to include migrations and tables through:

- `009_data_lifecycle_foundation.sql`
- `010_enterprise_identity_foundation.sql`

Source review confirms the preflight script:

- requires `DATABASE_URL`
- opens a PostgreSQL connection
- starts `BEGIN READ ONLY`
- performs schema, migration, count, ownership, and identity checks
- rolls back the transaction
- does not run repair statements
- does not apply migrations

## Required Verification

- Confirm the `DATABASE_URL` target.
- Confirm the target is production.
- Obtain explicit owner approval.
- Run read-only preflight only.
- Verify PostgreSQL version, PostGIS, schema state, migration records, safe row counts, Organization ownership integrity, driver identity integrity, and blockers.

## Current Result

Production DB state remains not verified. No production data was read or modified.

## Production `DATABASE_URL` Source

`DATABASE_URL` is configured as a secret Render environment variable in `render.yaml` with `sync: false`. The actual value and database provider were not visible from the repository or public endpoints and must be confirmed from Render/provider access before preflight.
