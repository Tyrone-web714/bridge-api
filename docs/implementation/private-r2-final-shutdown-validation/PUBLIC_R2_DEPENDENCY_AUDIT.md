# Public R2 Dependency Audit

## Summary

Current active media display paths no longer require direct public R2 URLs for the verified delivery-note media. However, public R2 shutdown is still blocked because public URL metadata remains and new S3/R2 uploads still generate `legacyPublicUrl` values from `PHOTO_STORAGE_PUBLIC_BASE_URL`.

## Code Paths Referencing Public R2 or Legacy Public URLs

| Path | Classification | Finding |
| --- | --- | --- |
| `bridge-api/services/photoStorage.js` | Active writer | `saveS3Photo` builds a public URL from `PHOTO_STORAGE_PUBLIC_BASE_URL` and stores it as `legacyPublicUrl`. |
| `bridge-api/services/photoStorage.js` | Config dependency | S3 configuration still requires `PHOTO_STORAGE_PUBLIC_BASE_URL`. |
| `bridge-api/routes/deliveryNotes.js` | Metadata preservation | Existing photo normalization preserves `legacyPublicUrl`; it does not use it as the primary display URL for authenticated S3 media. |
| `bridge-api/db/repositories.js` | Lifecycle metadata | Lifecycle reference metadata records whether a legacy public URL is present. |
| `bridge-api/scripts/migrate-legacy-private-media.cjs` | Migration tooling | Reads and preserves `legacyPublicUrl` for compatibility and idempotent migration evidence. |
| `bridge-api/scripts/assess-production-media-metadata.cjs` | Read-only assessment | Counts `legacyPublicUrl` and `r2.dev` references, including compatibility metadata. |
| `apps/mobile/scripts/check-mobile-private-media.cjs` | Guardrail | Asserts mobile private media must not fall back to `legacyPublicUrl`. |
| `apps/mobile/src/app/components/AuthenticatedMediaImage.js` | Active mobile renderer | Uses `accessPath` or authenticated `/api/media` URLs for private media; it does not read `legacyPublicUrl`. |

## Active Workflow Dependency Result

No active mobile private-media renderer was found reading `legacyPublicUrl`.

No active delivery-note backend media route requires direct public R2 access for reads. Authenticated media reads use stored `storageKey` values and server-side R2 credentials through `/api/media/:mediaId`.

The web/admin delivery-note HTML renders `photo.url`, not `legacyPublicUrl`. Production evidence shows current direct public URLs are 0 and authenticated access paths are 5, so the current delivery-note admin render path should use authenticated TSR media URLs.

## Why R2 Public Access Is Still Not Ready To Disable

1. Production still has 5 `legacyPublicUrl` values containing `r2.dev` references.
2. `saveS3Photo` still writes `legacyPublicUrl` for new S3/R2 uploads.
3. S3 config validation still requires `PHOTO_STORAGE_PUBLIC_BASE_URL`.
4. The read-only assessment intentionally marks shutdown unsafe when any `r2.dev` reference remains, even if the reference is compatibility metadata.
5. The 20 lifecycle references for 5 current media items require read-only reconciliation before cleanup decisions.

## Direct Public R2 Functional Requirement

Direct public R2 access is not functionally required for the current verified delivery-note media display path, but it remains a compatibility and metadata dependency. Public R2 shutdown should wait until the metadata writer is remediated and the existing public metadata is cleaned or formally accepted as inert.
