# Rollback Procedure

This task did not apply migrations to production data.

Before applying this migration in any environment with persistent data:

1. Confirm a recent database backup exists.
2. Confirm restore target and credentials.
3. Capture table counts for affected tables.
4. Apply migration in a non-production database first.
5. Verify bootstrap Organization.
6. Verify foreign keys and indexes.
7. Verify platform-global reference tables were not tenant-owned.
8. Verify driver identity compatibility.

## Logical Rollback

Preferred rollback is database restore from the pre-migration backup.

If restore is not possible, a manual rollback plan must be approved before production migration. Manual rollback would remove added indexes, added tenant columns, the bootstrap Organization, and the exception table only after confirming no dependent code is running.

Do not perform production rollback without an approved maintenance window.
