# Offline Deactivation Security

Driver and warehouse session validation now checks current subject state and current Organization state on every authenticated request.

Deactivation and Organization termination revoke active sessions. Stale mobile/offline tokens cannot replay queued mutations after lifecycle revocation because `driverAuth.requireDriverAuth` and `warehouseAuth.requireWarehouseAuth` reject revoked or inactive sessions.

Legitimate blocked queue review remains future operational policy work.
