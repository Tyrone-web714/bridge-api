# Legacy Public Metadata Writer Removal

## Status

IMPLEMENTED FOR NEW ORGANIZATION-PRIVATE S3/R2 MEDIA.

New Organization-private S3/R2 delivery-note media no longer generates `legacyPublicUrl` metadata.

## Code Changes

| File | Change |
| --- | --- |
| `bridge-api/services/photoStorage.js` | `saveS3Photo` no longer constructs a public URL from `PHOTO_STORAGE_PUBLIC_BASE_URL`. |
| `bridge-api/services/photoStorage.js` | New S3/R2 private media returns `storageProvider`, `storageKey`, `mediaClassification`, `accessPath`, authenticated `url`, and upload metadata, but not `legacyPublicUrl`. |
| `bridge-api/services/photoStorage.js` | S3 object cache control changed from public immutable caching to private no-store caching. |
| `bridge-api/routes/deliveryNotes.js` | Existing `legacyPublicUrl` values remain preserved during normalization for legacy records. |

## Preserved Behavior

Existing production records are not modified by this code change. Existing `legacyPublicUrl` values remain present until a separately approved metadata cleanup is performed.

The legacy private-media migration tooling still preserves legacy compatibility metadata when assessing or normalizing old records. That tooling is not the new-upload writer.

## Shared Safety Boundary

This change applies to Organization-private S3/R2 media. It does not define or remove any future sanitized public-media architecture for approved Shared Safety records. Shared Safety public media remains a separate governed workflow.
