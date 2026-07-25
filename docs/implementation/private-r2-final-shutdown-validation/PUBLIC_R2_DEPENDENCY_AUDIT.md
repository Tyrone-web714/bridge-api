# Public R2 Dependency Audit

## Summary

Current active media display paths no longer require direct public R2 URLs for the verified delivery-note media. The writer remediation removed new `legacyPublicUrl` generation for Organization-private S3/R2 media, and the bounded production cleanup removed the 5 obsolete production `legacyPublicUrl` fields.

## Code Paths Referencing Public R2 or Legacy Public URLs

| Path | Classification | Finding |
| --- | --- | --- |
| `bridge-api/services/photoStorage.js` | Remediated writer | `saveS3Photo` no longer builds or stores `legacyPublicUrl` for new Organization-private S3/R2 media. |
| `bridge-api/services/photoStorage.js` | Config dependency | Private S3/R2 media no longer requires `PHOTO_STORAGE_PUBLIC_BASE_URL`; that variable remains only for legacy review or separately governed sanitized public-media workflows. |
| `bridge-api/routes/deliveryNotes.js` | Historical metadata preservation | Historical normalization preserved `legacyPublicUrl`; the bounded production cleanup removed the obsolete production fields. |
| `bridge-api/db/repositories.js` | Lifecycle metadata | Lifecycle reference metadata records whether a legacy public URL was present for historical compatibility review. |
| `bridge-api/scripts/migrate-legacy-private-media.cjs` | Migration tooling | Reads and preserves `legacyPublicUrl` for compatibility and idempotent migration evidence. Do not rerun completed production migrations without explicit approval. |
| `bridge-api/scripts/assess-production-media-metadata.cjs` | Read-only assessment | Counts `legacyPublicUrl` and `r2.dev` references, including compatibility metadata. |
| `apps/mobile/scripts/check-mobile-private-media.cjs` | Guardrail | Asserts mobile private media must not fall back to `legacyPublicUrl`. |
| `apps/mobile/src/app/components/AuthenticatedMediaImage.js` | Active mobile renderer | Uses `accessPath` or authenticated `/api/media` URLs for private media; it does not read `legacyPublicUrl`. |

## Active Workflow Dependency Result

No active mobile private-media renderer was found reading `legacyPublicUrl`.

No active delivery-note backend media route requires direct public R2 access for reads. Authenticated media reads use stored `storageKey` values and server-side R2 credentials through `/api/media/:mediaId`.

The web/admin delivery-note HTML renders `photo.url`, not `legacyPublicUrl`. Production evidence shows current direct public URLs are 0 and authenticated access paths are 5, so the current delivery-note admin render path uses authenticated TSR media URLs.

## Remaining Shutdown Preconditions

1. Owner gives explicit approval for Cloudflare R2 Public Development URL shutdown.
2. The shutdown changes only the intended R2 public access setting and does not delete, move, copy, or rewrite R2 objects.
3. Final production smoke validation confirms `/health`, `/ready`, authenticated media delivery, unauthenticated HTTP 401 behavior, mobile media rendering, and admin Delivery Notes media rendering.
4. Final project completion report records the outcome and rollback status.

## Direct Public R2 Functional Requirement

Direct public R2 access is not functionally required for the current verified delivery-note media display path. Public R2 shutdown should wait only for explicit owner approval, the controlled Cloudflare R2 Public Development URL shutdown action, and final smoke validation.
