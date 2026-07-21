# R2 Shutdown Plan

## Current Shutdown Classification

BLOCKED FOR ACTUAL SHUTDOWN.

Public R2 should not be disabled until the remaining metadata/writer and lifecycle-reference blockers are closed or explicitly accepted.

## Exact Shutdown Action Proposed Later

After blockers are closed, the proposed action is to disable public `r2.dev` or equivalent public development URL access for the Truck-Safe Routing Cloudflare R2 media bucket. This action must not delete, move, copy, or rewrite any R2 object.

## Preconditions

1. Existing `legacyPublicUrl` / `r2.dev` metadata is removed, quarantined, or formally accepted as inert through an approved metadata plan.
2. The S3/R2 writer no longer creates new public URL metadata for Organization-private media.
3. `PHOTO_STORAGE_PUBLIC_BASE_URL` is no longer required for private S3/R2 media operation, or it is retained only as an inert non-access dependency with owner approval.
4. Read-only production metadata assessment reports no active public current URLs and no unapproved public URL compatibility references.
5. Lifecycle-object-reference reconciliation explains the 20 references and confirms no duplicate corruption requiring cleanup before shutdown.
6. Credentialed mobile and admin media walkthroughs pass.
7. Monitoring and rollback procedures are ready.

## Shutdown Window Steps

1. Record current deployed commit and Render environment inventory.
2. Confirm `/health` and `/ready` are 200.
3. Confirm object-storage smoke path succeeds through authenticated TSR media access.
4. Disable public R2 access in Cloudflare for the specific TSR media bucket only.
5. Do not delete objects.
6. Verify `/health` and `/ready` remain 200.
7. Verify authorized media reads succeed through `/api/media`.
8. Verify unauthenticated and cross-tenant media reads are denied.
9. Verify mobile delivery-note and Account Knowledge media still render.
10. Verify admin Delivery Notes media still renders.
11. Monitor logs for `/api/media` failures.

## Stop Conditions

Stop and rollback if:

- `/api/media` returns elevated 5xx responses;
- authorized media reads fail;
- mobile or admin cannot display private media;
- unexpected public object references are still required;
- production error rate increases beyond the accepted threshold.
