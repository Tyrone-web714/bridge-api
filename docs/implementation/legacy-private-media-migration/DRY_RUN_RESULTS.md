# Dry-Run Results

## Status

PASSED by owner-run read-only production dry-run.

The dry-run was manually executed in a temporary PowerShell session using the actual verified Render production `DATABASE_URL`.

Dry-run controls:

- `ok`: true
- `dryRun`: true
- `readOnly`: true
- URLs and object keys redacted: true
- write mode executed: false

## Expected Reconciliation

The candidate count must reconcile to the verified production count:

- Expected total legacy candidates: 3.
- Expected affected record type: `delivery_notes.photos`.

The verified dry-run reconciled exactly to the expected 3 candidates.

## Verified Aggregate Result

| Metric | Count |
| --- | ---: |
| Total legacy candidates | 3 |
| Ready to migrate | 3 |
| Already migrated | 0 |
| Blocked | 0 |
| Ambiguous | 0 |
| Missing required metadata | 0 |
| Missing metadata count | 0 |

Known production reference count matches: true.

## Post-Migration Dry-Run

After the approved production write, the owner immediately reran the tool in read-only dry-run mode against the verified Render production database.

| Metric | Count |
| --- | ---: |
| Total legacy candidates | 3 |
| Ready to migrate | 0 |
| Already migrated | 3 |
| Blocked | 0 |
| Ambiguous | 0 |
| Missing required metadata | 0 |
| Missing metadata count | 0 |

Known production reference count matches: true.

Write mode executed: false.

This verifies that direct public R2 URLs are no longer the primary current metadata path for the 3 migrated records and that authenticated TSR media access metadata is present for all 3.

## Production Write Command

The production write was approved and manually executed by the owner in a temporary PowerShell session where `DATABASE_URL` pointed to the verified Render production database:

```powershell
$env:OWNER_APPROVED_LEGACY_MEDIA_MIGRATION='true'
node scripts\migrate-legacy-private-media.cjs --apply
```

Do not run this write command again unless a separate owner approval is granted.
