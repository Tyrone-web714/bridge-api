# Remaining Blockers

## Blocking Public R2 Shutdown

1. Production still contains 5 `legacyPublicUrl` / `r2.dev` compatibility references.
2. `bridge-api/services/photoStorage.js` still writes `legacyPublicUrl` for new S3/R2 delivery-note media.
3. S3 configuration still requires `PHOTO_STORAGE_PUBLIC_BASE_URL`.
4. `lifecycle_object_references` contains 20 `delivery_note_photo` / `s3` references for 5 current delivery-note media items; this may be historical retention data, but it requires read-only reconciliation.
5. Credentialed admin/browser media walkthrough remains required before final shutdown.
6. Monitoring alert delivery remains to be verified for the shutdown window.

## Bounded Cleanup Plan Required

If the owner approves, prepare a separate cleanup/remediation phase that:

1. Stops writing `legacyPublicUrl` for new Organization-private S3/R2 media.
2. Makes `PHOTO_STORAGE_PUBLIC_BASE_URL` optional or inert for private S3/R2 media reads and writes.
3. Removes or quarantines existing `legacyPublicUrl` values for the 5 migrated delivery-note media items after confirming no active workflow reads them.
4. Runs a read-only production metadata assessment expecting direct public current URLs = 0, `legacyPublicUrl` fields = 0, authenticated access paths = 5.
5. Runs a read-only lifecycle reconciliation report for the 20 object references.
6. Does not delete R2 objects.
7. Does not disable public R2 until a separate shutdown approval is given.

## Lifecycle Reconciliation Needed

Run a read-only aggregate report that returns only counts:

- total lifecycle references;
- distinct lifecycle reference IDs;
- duplicate reference ID count;
- distinct storage-key count;
- duplicate storage-key group count;
- references matching current `delivery_notes.photos` storage keys;
- references not matching current `delivery_notes.photos` storage keys;
- references with missing owner delivery notes;
- references with mismatched Organization ownership.

No lifecycle cleanup is approved in this phase.
