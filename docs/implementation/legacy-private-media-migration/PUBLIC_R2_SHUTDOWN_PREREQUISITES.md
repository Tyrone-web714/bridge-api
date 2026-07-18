# Public R2 Shutdown Prerequisites

Public R2 access cannot be disabled yet.

Before shutdown:

1. Dry-run returns exactly 3 candidates. Completed.
2. Owner approves production write. Completed.
3. Migration writes complete successfully. Completed by owner-run approved apply.
4. Post-migration dry-run reports `alreadyMigrated = 3`. Completed.
5. Authenticated media paths are primary for all 3 items. Completed by post-migration metadata dry-run.
6. Credentialed authenticated media retrieval works for all 3 items. Still requires approved tenant media-test credentials or an operational walkthrough.
7. Driver/mobile and supervisor/dashboard compatibility is verified. Pending.
8. No active workflow depends on public R2 URLs as primary access. Pending field/workflow verification.
9. Rollback baseline is recorded. Pending final merge-gate/release planning.
10. R2 shutdown is separately approved. Pending.

Public R2 access remains enabled until all remaining prerequisites are complete and shutdown is separately approved.
