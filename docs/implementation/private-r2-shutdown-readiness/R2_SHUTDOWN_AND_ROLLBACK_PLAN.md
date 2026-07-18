# R2 Shutdown And Rollback Plan

Status: PREPARED ONLY. DO NOT EXECUTE.

## Exact Cloudflare Setting

Disable public `r2.dev` access for the Cloudflare R2 bucket currently used for Truck-Safe Routing delivery-note and hazard media.

The exact Cloudflare dashboard label must be confirmed in the active Cloudflare account before execution. It is expected to be the bucket-level public development URL or public access setting for `r2.dev`.

## Expected Effect

- Direct unauthenticated `https://*.r2.dev/...` object URLs stop serving object contents.
- Existing R2 objects are not deleted.
- TSR authenticated `/api/media/:mediaId` should continue working if the backend can read objects using configured R2 credentials.
- Any client workflow relying on direct public R2 URLs will fail.

## Pre-Shutdown Gates

1. Production dry-run confirms 0 private media records with direct public current URL as primary.
2. Mobile authenticated media retrieval is fixed or physically validated.
3. Supervisor dashboard delivery-note media display is credentialed-verified.
4. Hazard/static verification media display is credentialed-verified.
5. Shared Safety public media architecture is explicitly classified.
6. External consumer inventory confirms no direct public R2 dependency.
7. `/health` and `/ready` are HTTP 200.
8. Object-storage application-mediated read succeeds through `/api/media`.
9. Rollback owner is identified and available during shutdown window.
10. Owner gives explicit approval to disable public R2 access.

## Immediate Post-Shutdown Smoke Tests

1. `/health` returns HTTP 200.
2. `/ready` returns HTTP 200.
3. Direct public R2 URL to a disposable or known safe test object is denied.
4. Authorized supervisor can view delivery-note private media through dashboard.
5. Authorized driver can view delivery-note private media on physical Android device.
6. Unauthenticated `/api/media/:mediaId` access is denied.
7. Cross-Organization media access is denied where a second Organization test account exists.
8. New delivery-note photo upload succeeds.
9. New delivery-note photo retrieval succeeds through TSR.
10. Existing migrated media retrieval succeeds through TSR.

## Rollback Trigger Conditions

- Mobile route workflow cannot display required delivery-note media.
- Supervisor dashboard cannot display delivery-note or hazard media.
- `/api/media` returns elevated 5xx responses.
- `/ready` fails because storage is not configured or object reads fail.
- Any private media access bypass is discovered.
- An approved operational workflow unexpectedly depends on direct R2 URLs.

## Rollback Procedure

1. Re-enable the same Cloudflare R2 `r2.dev` public access setting that was disabled.
2. Do not delete, move, copy, or rewrite R2 objects.
3. Confirm direct public test URL behavior returns to prior state.
4. Confirm `/health` and `/ready` remain HTTP 200.
5. Recheck dashboard and mobile media workflows.
6. Record the rollback timestamp, actor, reason, and observed failure.
7. Leave public R2 enabled until the defect is fixed and a new shutdown window is approved.

## Execution Approval

Public R2 shutdown requires this exact owner approval before execution:

`I explicitly approve disabling public Cloudflare R2 r2.dev access for the Truck-Safe Routing media bucket during a controlled shutdown window. I understand this is a production infrastructure/security configuration change. Do not delete, move, copy, or modify R2 objects. Stop and roll back if mobile, dashboard, authenticated media, /health, or /ready smoke tests fail.`
