# Rollback Procedure

## Application Rollback

If private media access causes a field workflow regression:

1. Roll back the application release to the prior deployed commit.
2. Keep R2 public access unchanged.
3. Verify delivery-note photo viewing, hazard media viewing, and mobile upload flows.
4. Preserve `legacyPublicUrl` metadata for compatibility.

## Data Rollback

No data rollback is required for this phase because no schema, migration, production data, or production objects are modified.

## CORS Rollback

If a legitimate web origin is blocked, add the exact origin to `CORS_ORIGIN`. Do not use wildcard CORS in production.
