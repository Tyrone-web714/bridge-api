# R2 Rollback Plan

## Status

READY / NOT USED.

Rollback readiness was confirmed before the owner-approved Cloudflare R2 Public Development URL shutdown. Rollback was not executed because final production smoke validation passed.

## Rollback Trigger

Rollback would have been triggered by any of the following after shutdown:

- `/health` failed.
- `/ready` failed.
- Authenticated Delivery Notes media failed to render through `/api/media/:mediaId`.
- Unauthenticated media access did not return HTTP 401.
- The Cloudflare setting change affected any resource beyond the approved Public Development URL setting.

## Rollback Action

Re-enable the same Cloudflare R2 Public Development URL setting for bucket `truck-safe-routing-delivery-photos`, then repeat the production smoke validation.

## Final Outcome

Rollback was not needed. The former public R2 development endpoint returned HTTP 401 `This bucket cannot be viewed`, while authenticated TSR media delivery continued to work.
