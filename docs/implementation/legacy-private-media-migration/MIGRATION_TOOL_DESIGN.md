# Migration Tool Design

## Tool

`bridge-api/scripts/migrate-legacy-private-media.cjs`

## Default Behavior

Dry-run is the default. Dry-run uses `BEGIN READ ONLY` and rolls back.

## Production Write Gate

Writes require both:

```powershell
--apply
$env:OWNER_APPROVED_LEGACY_MEDIA_MIGRATION='true'
```

Without both, the tool refuses write mode.

## Classification

Each candidate is classified as:

- `READY_TO_MIGRATE`
- `ALREADY_MIGRATED`
- `MISSING_REQUIRED_METADATA`
- `AMBIGUOUS`
- `BLOCKED`

## Safe Output

The tool reports only counts and safe status fields. It does not print media URLs or object keys.

## Write Behavior

For approved future writes, the tool:

- normalizes media metadata;
- sets authenticated TSR access as primary;
- preserves legacy public URL as compatibility metadata;
- creates deterministic lifecycle references;
- records an audit event with safe aggregate metadata;
- avoids duplicate lifecycle references on rerun.
