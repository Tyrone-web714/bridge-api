# Legacy Public URL Migration Plan

## Current State

Existing media records may include direct public R2 URLs from earlier implementation behavior.

Verified production evidence shows 3 current delivery-note media items with direct public `r2.dev` current URLs and no authenticated access-path metadata yet.

## Target State

Application clients should use authenticated `/api/media/:mediaId` URLs for Organization-private media.

## Migration Sequence

1. Use the verified production media inventory as the baseline: 3 delivery-note media items currently use direct public R2 URLs.
2. Confirm all new uploads create `mediaClassification`, `accessPath`, and `legacyPublicUrl`.
3. Update clients to prefer `url` or `accessPath` from the authenticated API.
4. Backfill missing private media IDs only through a separately approved migration plan.
5. Disable public object access only after no active workflow depends on direct public URLs.

## Safety Rule

Do not delete, rewrite, or privatize existing production media during this hardening phase.
