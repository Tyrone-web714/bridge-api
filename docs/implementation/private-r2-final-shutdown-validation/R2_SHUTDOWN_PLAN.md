# R2 Shutdown Plan

## Current Shutdown Classification

READY FOR OWNER-APPROVED SHUTDOWN WINDOW.

Public R2 must not be disabled until the owner gives final explicit approval for the Cloudflare R2 Public Development URL shutdown. Legacy metadata cleanup, writer remediation, lifecycle reconciliation, authenticated media validation, and unauthenticated denial validation are complete for this shutdown track.

## Exact Shutdown Action

Disable public `r2.dev` or equivalent Public Development URL access for the Truck-Safe Routing Cloudflare R2 media bucket. This action must not delete, move, copy, rewrite, rename, reclassify, or otherwise mutate any R2 object.

## Preconditions

1. Owner gives final explicit approval for the shutdown window.
2. Existing obsolete `legacyPublicUrl` / `r2.dev` compatibility metadata has been removed by the bounded production cleanup.
3. The S3/R2 writer no longer creates new public URL metadata for Organization-private media.
4. `PHOTO_STORAGE_PUBLIC_BASE_URL` is no longer required for private S3/R2 media operation; if present, it is inert legacy or separately governed sanitized-public configuration for this code path.
5. Lifecycle-object-reference reconciliation explains the 20 references and confirms no duplicate corruption requiring cleanup before shutdown.
6. Credentialed admin media walkthrough has passed for Delivery Notes.
7. Authenticated private media delivery through `/api/media/:mediaId` is verified.
8. Unauthenticated media requests return HTTP 401.
9. Rollback owner/operator has Cloudflare access and is available during the shutdown window.
10. Baseline `/health`, `/ready`, authenticated media, unauthenticated media denial, mobile media, and admin media checks are ready to run.

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
12. Record shutdown timestamp, validation results, and rollback readiness in the final completion report.

## Stop Conditions

Stop and rollback if:

- `/health` or `/ready` fails;
- `/api/media` returns elevated 5xx responses;
- authorized media reads fail;
- unauthenticated media requests do not return HTTP 401;
- mobile or admin cannot display private media;
- unexpected public object references are still required;
- production error rate increases beyond the accepted threshold.

## Success Criteria

The shutdown is successful when public R2 development URL access is disabled, authenticated TSR media delivery still works, unauthenticated access remains denied, no object or database mutation occurs, and the final production smoke validation is documented.
