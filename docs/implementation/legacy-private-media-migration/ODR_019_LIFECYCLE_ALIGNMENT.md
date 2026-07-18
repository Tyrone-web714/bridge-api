# ODR-019 Lifecycle Alignment

The migration target includes deterministic `lifecycle_object_references` rows for each migrated delivery-note photo.

Lifecycle references use:

- `owner_table = delivery_notes`
- `owner_id = delivery note id`
- `object_kind = delivery_note_photo`
- `storage_provider`
- `storage_key`
- `contains_personal_data = true`
- `legal_hold_eligible = true`
- `lifecycle_status = ACTIVE`

This allows future retention, legal hold, deletion eligibility, object-storage purge, tombstone, and Organization termination workflows to reason about the media objects.
