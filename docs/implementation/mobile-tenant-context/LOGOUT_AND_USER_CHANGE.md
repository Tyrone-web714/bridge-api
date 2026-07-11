# Logout And User Change

On logout:

- SecureStore driver session is cleared.
- Logout request is sent with the active bearer token when available.
- Tenant-scoped queued work is retained under its Organization/internal-driver key.
- Synchronization cannot proceed without a valid trusted session.

On another driver login:

- The new session receives its own Organization/internal-driver scoped keys.
- Prior driver route, stop, delivery, notes, photo metadata, and route-event queues are not read through the new driver context.
- Company driver number remains available for operational display and backend driver route lookup.