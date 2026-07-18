# Offline Media Security

## Current Behavior

The mobile app already caches delivery-note records and queues delivery-note operations for reconnect. Newly selected photos remain local device media until upload/sync.

This phase does not add a large offline private-media cache.

## Security Position

- Private remote media is requested through TSR with the active driver session.
- Tokens are not placed in file names, cache keys, media metadata, or permanent URLs.
- Local selected photo previews continue to use local device URIs.
- If the driver logs out or the session expires, private remote media requests should fail instead of silently using public R2.

## Remaining Limitation

Offline display of previously retrieved private remote images has not been physically validated. If pilot workflow requires robust offline viewing of remote delivery-note photos, add an application-controlled, tenant-scoped media cache with cleanup on logout/session invalidation. That is intentionally outside this small compatibility fix.
