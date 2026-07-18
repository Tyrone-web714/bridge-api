# Public R2 Shutdown Prerequisites

Public R2 access cannot be disabled yet.

Before shutdown:

1. Dry-run returns exactly 3 candidates.
2. Owner approves production write.
3. Migration writes complete successfully.
4. Authenticated media access works for all 3 items.
5. Driver/mobile and supervisor/dashboard compatibility is verified.
6. No active workflow depends on public R2 URLs as primary access.
7. Rollback baseline is recorded.
8. R2 shutdown is separately approved.
