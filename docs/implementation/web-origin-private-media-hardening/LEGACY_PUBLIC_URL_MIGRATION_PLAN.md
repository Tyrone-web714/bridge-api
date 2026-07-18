# Legacy Public URL Migration Plan

## Current State

Existing media records may include direct public R2 URLs from earlier implementation behavior.

Verified production evidence shows 3 current delivery-note media items with direct public `r2.dev` current URLs and no authenticated access-path metadata yet.

## Target State

Application clients should use authenticated `/api/media/:mediaId` URLs for Organization-private media.

## Migration Sequence

1. Use the verified production media inventory as the baseline: 3 delivery-note media items currently use direct public R2 URLs.
2. Validate storage identity from trusted stored metadata without retrieving media contents unnecessarily.
3. Create or confirm an authenticated TSR media identity for each object.
4. Register each object in `lifecycle_object_references`.
5. Verify compatibility through authenticated TSR media access.
6. Replace or de-prioritize public-primary URL fields only after authenticated access works.
7. Verify driver/mobile and supervisor/dashboard read paths.
8. Disable public object access only after no active workflow depends on direct public URLs.

The migration must be bounded, auditable, idempotent, dry-run capable, tenant-safe, and rollback-aware.

## Safety Rule

Do not delete, rewrite, or privatize existing production media during this hardening phase.
