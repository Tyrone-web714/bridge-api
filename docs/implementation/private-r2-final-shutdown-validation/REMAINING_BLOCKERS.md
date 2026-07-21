# Remaining Blockers

## Blocking Final Public R2 Shutdown Approval

1. Existing production `legacyPublicUrl` / `r2.dev` metadata remains on 5 delivery-note media items.
2. Production lifecycle reference reconciliation has not yet been run with the new read-only aggregate tool.
3. Credentialed production admin/browser media walkthrough remains owner-executed or owner-approved.
4. Monitoring alert delivery to an actual owner/operator remains unverified.
5. A separate approved metadata cleanup is still required before public R2 shutdown.

## Closed In This Phase

1. New Organization-private S3/R2 uploads no longer generate `legacyPublicUrl`.
2. Private S3/R2 media no longer requires `PHOTO_STORAGE_PUBLIC_BASE_URL`.
3. New private media keeps authenticated TSR `/api/media/:mediaId` primary access.
4. New private media keeps storage provider, storage key, media classification, and lifecycle compatibility.
5. Focused private R2 shutdown guardrail was added to the test chain.
6. Read-only lifecycle reconciliation tooling was created.

## Proposed Next Bounded Cleanup Plan

After owner approval:

1. Deploy this branch or merge/deploy through the normal release process.
2. Run the read-only lifecycle reconciliation against production and record aggregate counts only.
3. Perform credentialed admin/browser media walkthrough.
4. Verify monitoring alert delivery.
5. Run a production dry-run for metadata cleanup limited to the 5 verified `legacyPublicUrl` fields.
6. Request explicit approval for the metadata cleanup write.
7. Remove only those stale `legacyPublicUrl` fields.
8. Rerun the production metadata assessment expecting `legacyPublicUrl` fields = 0 and authenticated paths = 5.
9. Request separate final owner approval before disabling public R2.
