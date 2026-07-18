# ODR-019 Media Lifecycle Alignment

## Alignment

Private media hardening aligns with ODR-019 by ensuring media references can be classified, controlled, retained, and eventually purged through lifecycle policy rather than uncontrolled public links.

## Lifecycle Considerations

- `legacyPublicUrl` is retained for audit and migration.
- `storageKey` remains an internal object reference.
- `mediaClassification` identifies Organization-private media.
- New S3/R2 delivery-note private media is registered in `lifecycle_object_references` with:
  - `owner_table = delivery_notes`
  - `owner_id = delivery note id`
  - `object_kind = delivery_note_photo`
  - `storage_provider`
  - `storage_key`
  - `contains_personal_data = true`
  - `legal_hold_eligible = true`
  - `lifecycle_status = ACTIVE`
- Future deletion/retention workflows should use lifecycle object references rather than direct client-provided URLs.

## Not Implemented Here

This phase does not create new lifecycle migrations, purge media, alter retention policies, backfill existing production legacy media, or perform production object mutations.
