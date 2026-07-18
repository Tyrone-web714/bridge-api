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
