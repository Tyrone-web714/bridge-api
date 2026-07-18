# Target State

For each legacy delivery-note media item:

- Authenticated TSR media access is the primary `url`.
- Permanent public R2 URL is no longer the primary access mechanism.
- Original storage object remains in place.
- `storageKey` remains the internal object reference.
- Organization ownership remains explicit through the delivery note.
- `mediaClassification` is `ORGANIZATION_PRIVATE`.
- `accessPath` points to `/api/media/:mediaId`.
- Legacy public URL is retained as `legacyPublicUrl` during compatibility.
- A deterministic `lifecycle_object_references` row exists.
- Historical delivery-note references remain intact.

No media object is deleted, moved, re-uploaded, or duplicated by this migration.
