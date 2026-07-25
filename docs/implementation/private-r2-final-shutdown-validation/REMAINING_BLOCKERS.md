# Remaining Blockers

## Blocking Final Public R2 Shutdown Approval

1. Final owner approval is required before disabling the Cloudflare R2 Public Development URL.
2. Final production smoke validation must run after the R2 public access setting is changed.
3. A final project completion report must record the shutdown result, smoke validation, and rollback status.

## Closed In This Phase

1. New Organization-private S3/R2 uploads no longer generate `legacyPublicUrl` in this branch.
2. Private S3/R2 media no longer requires `PHOTO_STORAGE_PUBLIC_BASE_URL` in this branch.
3. New private media keeps authenticated TSR `/api/media/:mediaId` primary access.
4. New private media keeps storage provider, storage key, media classification, and lifecycle compatibility.
5. Focused private R2 shutdown guardrail was added to the test chain.
6. Read-only lifecycle reconciliation tooling was created.
7. Owner-run production lifecycle reconciliation found no duplicate-reference defect.
8. Owner-run credentialed production Delivery Notes admin media walkthrough passed through `/api/media/:mediaId` and did not require direct `r2.dev` access.
9. The bounded production metadata cleanup removed the 5 obsolete `legacyPublicUrl` fields.
10. Post-cleanup production results reported `recordsFound = 5`, `recordsModified = 5`, `remainingLegacyPublicUrlCount = 0`, and zero storage key, storage provider, lifecycle, organization, or media ID changes.

## Historical Lifecycle References

The production reconciliation reported 20 total lifecycle references, 20 unique storage objects, 20 unique delivery-note/media identities, 5 references tied to current media, and 15 references not tied to current media.

The 15 references not tied to current delivery-note media records are historical-retention candidates under ODR-019 lifecycle-policy review. They are not an immediate public R2 shutdown blocker unless future evidence shows direct public R2 access is required to serve them.

Do not delete, purge, or modify those 15 references or their underlying R2 objects in this phase.

## Completed Bounded Cleanup

The bounded metadata cleanup has been executed and owner-verified. The production operation occurred outside repository source control and is recorded in `PRODUCTION_LEGACY_METADATA_CLEANUP_RESULTS.md`.

No media objects were moved. No storage providers changed. No lifecycle values changed. No organization ownership changed. No media identifiers changed. The cleanup removed only obsolete `legacyPublicUrl` metadata fields.

## Remaining Infrastructure Sequence

After explicit owner approval:

1. Disable the Cloudflare R2 Public Development URL for the intended TSR media bucket only.
2. Do not delete, move, copy, or rewrite R2 objects.
3. Confirm `/health` returns HTTP 200.
4. Confirm `/ready` returns HTTP 200.
5. Confirm authenticated media delivery through `/api/media/:mediaId`.
6. Confirm unauthenticated media requests return HTTP 401.
7. Confirm mobile and admin Delivery Notes media render through authenticated media paths.
8. Record the final project completion report.

Deployment failure notification is now closed as verified. Render ALL NOTIFICATIONS and database observability remain useful operational controls, but the expected remaining infrastructure work for this shutdown track is limited to owner-approved R2 Public Development URL shutdown, final production smoke validation, and final project completion reporting.
