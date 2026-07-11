# Rollback Procedure

Rollback is source-only for this phase.

1. Revert the Mobile Tenant Context commit.
2. Rebuild/redeploy the previous mobile/backend source state as needed.
3. No production database migration rollback is required.
4. Existing v1 local mobile keys were not deleted by this phase.
5. If a pilot device must recover legacy queued work, inspect v1 keys and quarantine records before reinstalling or clearing app data.

Do not clear a driver's app data until queued work has been reviewed.