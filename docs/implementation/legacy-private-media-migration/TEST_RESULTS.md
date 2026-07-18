# Test Results

## Focused Test

```powershell
npm.cmd run test:legacy-private-media
```

This test verifies:

- dry-run default;
- explicit apply and owner approval gate;
- read-only dry-run transaction;
- rollback-aware transaction handling;
- tenant-scoped execution support;
- candidate classification;
- blocked unsafe storage keys;
- authenticated primary URL behavior;
- legacy compatibility metadata;
- deterministic lifecycle reference registration;
- idempotent lifecycle upsert;
- safe redacted output.

## Full Regression

Completed successfully:

- `npm.cmd ci --dry-run`
- `npm.cmd test`
- `npm.cmd run verify:secrets`
- `npm.cmd run test:legacy-private-media`
- `npm.cmd run check:deployed -- https://truck-safe-routing-api.onrender.com`
- `git diff --check`

## Dry-Run Attempt

The migration tool was run without `--apply` in this shell. It refused to assess because the available database connection did not expose the expected `lifecycle_object_references` table.

Result: blocked, not production evidence.

## Verified Production Dry-Run

The owner manually reran the dry-run in a temporary PowerShell session with the actual verified Render production `DATABASE_URL`.

Result:

- total legacy candidates: 3
- ready to migrate: 3
- already migrated: 0
- blocked: 0
- ambiguous: 0
- missing required metadata: 0
- write mode executed: false

## Verified Production Apply

The owner manually executed the approved apply command in a temporary PowerShell session with the actual verified Render production `DATABASE_URL`.

Aggregate apply result:

- total legacy candidates: 3
- ready to migrate: 3
- already migrated: 0
- blocked: 0
- ambiguous: 0
- missing required metadata: 0
- write mode executed: true

Immediate post-migration dry-run:

- total legacy candidates: 3
- ready to migrate: 0
- already migrated: 3
- blocked: 0
- ambiguous: 0
- missing required metadata: 0
- write mode executed: false

This verifies idempotency at the production metadata level.

## Post-Migration Operational Smoke

The deployed backend remained healthy after the approved production metadata migration:

- `/health`: HTTP 200
- `/ready`: HTTP 200

The migration tool does not read, write, copy, or delete R2 objects. Existing media objects were therefore preserved by implementation design and by the approved migration boundary.

Credentialed media retrieval was not directly exercised from this Codex shell because approved production tenant media-test credentials were not available in the shell. Unauthorized and cross-tenant denial remain covered by automated private-media tests and should be rechecked during final merge-gate validation or a credentialed operational walkthrough before public R2 shutdown.
