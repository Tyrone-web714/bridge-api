# Rollback Procedure

## Objects

Rollback must not delete, move, or re-upload R2 objects.

## Metadata Fields Changed

Approved write mode may change delivery-note photo metadata:

- `id`
- `url`
- `accessPath`
- `mediaClassification`
- `legacyPublicUrl`

It may also create or update `lifecycle_object_references`.

## Rollback Strategy

If a workflow breaks:

1. Stop further writes.
2. Use database backup/PITR or a narrowly reviewed corrective script to restore prior photo metadata.
3. Preserve lifecycle references and audit events unless owner/legal review approves cleanup.
4. Keep R2 public access enabled until compatibility is verified.

Audit evidence should remain retained.
