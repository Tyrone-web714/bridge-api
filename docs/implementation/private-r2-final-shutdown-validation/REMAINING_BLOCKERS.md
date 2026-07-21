# Remaining Blockers

## Blocking Final Public R2 Shutdown Approval

1. Existing production `legacyPublicUrl` / `r2.dev` metadata remains on 5 delivery-note media items.
2. Credentialed production admin/browser media walkthrough remains owner-executed or owner-approved.
3. Monitoring alert delivery to an actual owner/operator remains unverified.
4. A separate approved metadata cleanup is still required before public R2 shutdown.
5. Final owner approval is required before disabling public R2.

## Closed In This Phase

1. New Organization-private S3/R2 uploads no longer generate `legacyPublicUrl`.
2. Private S3/R2 media no longer requires `PHOTO_STORAGE_PUBLIC_BASE_URL`.
3. New private media keeps authenticated TSR `/api/media/:mediaId` primary access.
4. New private media keeps storage provider, storage key, media classification, and lifecycle compatibility.
5. Focused private R2 shutdown guardrail was added to the test chain.
6. Read-only lifecycle reconciliation tooling was created.
7. Owner-run production lifecycle reconciliation found no duplicate-reference defect.

## Historical Lifecycle References

The production reconciliation reported 20 total lifecycle references, 20 unique storage objects, 20 unique delivery-note/media identities, 5 references tied to current media, and 15 references not tied to current media.

The 15 references not tied to current delivery-note media records are historical-retention candidates under ODR-019 lifecycle-policy review. They are not an immediate public R2 shutdown blocker unless future evidence shows direct public R2 access is required to serve them.

Do not delete, purge, or modify those 15 references or their underlying R2 objects in this phase.

## Proposed Next Bounded Cleanup Plan

After owner approval:

1. Perform credentialed admin/browser media walkthrough.
2. Verify monitoring alert delivery.
3. Run a production dry-run for metadata cleanup limited to the 5 verified `legacyPublicUrl` fields.
4. Request explicit approval for the metadata cleanup write.
5. Remove only those stale `legacyPublicUrl` fields.
6. Rerun the production metadata assessment expecting `legacyPublicUrl` fields = 0 and authenticated paths = 5.
7. Request separate final owner approval before disabling public R2.
