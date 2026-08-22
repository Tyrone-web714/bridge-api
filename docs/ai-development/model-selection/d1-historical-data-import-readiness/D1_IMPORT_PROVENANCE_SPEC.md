# D1 Import Provenance Spec

Status: PROVENANCE_SPEC_DEFINED

Every accepted historical record must be traceable from representative dataset back to source import.

## Required Provenance

- `organization_id`
- `source_system`
- `source_export_id`
- `source_record_id`
- `import_batch_id`
- `imported_at`
- `mapping_version`
- `schema_version`
- file checksum or export checksum
- operator/initiator
- dry-run flag
- validation status

## Idempotency

Primary import identity should be:

`organization_id + source_system + source_record_id`

If a source lacks stable record IDs, the adapter must define an approved compound key such as:

`organization_id + source_system + route_date + route_id + stop_id + outcome_sequence`

Rerunning the same export must not create duplicate history. Conflicting reruns must quarantine rather than overwrite silently.
