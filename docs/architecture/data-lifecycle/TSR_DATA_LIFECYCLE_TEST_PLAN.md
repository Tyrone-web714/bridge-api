# TSR Data Lifecycle Test Plan

**Status:** ARCHITECTURE DESIGNED

Acceptance tests SHALL verify:

- Deactivated users cannot authenticate.
- Deactivated users cannot sync stale offline mutations.
- User deletion does not cascade into route, stop, delivery, KPI, safety, warehouse, or audit history.
- Recovery window cancellation restores eligible soft-deleted accounts.
- Legal holds block purge.
- Organization termination does not expose or purge another Organization's data.
- Platform-global safety facts survive originating tenant deletion when approved.
- Object-storage lifecycle matches database lifecycle.
- Backup restore re-applies deletion tombstones where required.
- Destructive operations are tenant-scoped, permission-controlled, audited, and idempotent where practical.
