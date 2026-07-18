# Private R2 Shutdown Readiness

Status: BLOCKED.

This package evaluates whether Truck-Safe Routing can safely disable public Cloudflare R2 `r2.dev` access after the legacy private-media migration.

Public R2 access was not disabled.

No production media, production data, Cloudflare settings, Render settings, or backend deployment was changed during this readiness phase.

## Decision

Public R2 shutdown is not ready for owner approval yet.

The blocking reason is mobile media compatibility: React Native screens consume delivery-note `photo.url` values through `Image source={{ uri: photo.url }}` without attaching driver authorization headers. Migrated S3 media now points to authenticated TSR `/api/media/:mediaId` paths. That is correct for privacy, but it means the mobile app must either use an authenticated image-fetching path, an authorized media cache, or a supported header-aware image component before public R2 access can be safely disabled.

## Related Evidence

- Legacy migration merged to `main`.
- Production post-migration dry-run classified all 3 legacy media items as `ALREADY_MIGRATED`.
- `/api/media/:mediaId` requires authentication, Organization context, permission, tenant-scoped lookup, and a stored object key.
- Shared Safety sanitizer rejects private operational media references before publication.
- CORS explicit-origin regression checks pass.

## Next Action

Implement or validate mobile authenticated media retrieval before requesting approval to disable public R2 access.
