# Private Media Configuration Dependency

## Status

`PHOTO_STORAGE_PUBLIC_BASE_URL` is no longer required for Organization-private S3/R2 delivery-note media upload, read, or readiness configuration.

## Dependency Classification

| Use | Classification | Result |
| --- | --- | --- |
| Private S3/R2 delivery-note upload | PRIVATE MEDIA LEGACY ONLY | Removed as a requirement. |
| Private S3/R2 authenticated media read | DEAD/UNUSED for private reads | Backend reads by `storageKey` with server-side object-storage credentials. |
| Private S3/R2 delivery-note rendering | DEAD/UNUSED for current primary rendering | Mobile/admin use authenticated TSR media paths. |
| Existing production `legacyPublicUrl` fields | PRIVATE MEDIA LEGACY ONLY | Preserved until separately approved metadata cleanup. |
| Shared Safety approved sanitized media | SANITIZED PUBLIC MEDIA | Kept separate; not changed by this phase. |
| Config docs/examples | OPTIONAL LEGACY/SANITIZED PUBLIC | Updated to show the variable is optional for private media. |

## Validation

The focused private R2 shutdown guardrail runs an isolated S3 fixture with `PHOTO_STORAGE_PUBLIC_BASE_URL` absent. It verifies:

- storage config is valid;
- private media upload succeeds through a mocked S3 client;
- `storageKey` is persisted;
- `accessPath` starts with `/api/media/`;
- primary `url` uses authenticated TSR media access;
- no `legacyPublicUrl` is returned;
- authenticated read uses the stored object key.

## Production Note

No Render environment variable was changed in this phase. If `PHOTO_STORAGE_PUBLIC_BASE_URL` remains present in Render, it is now optional legacy/sanitized-public configuration for this code path, not a private-media requirement.
