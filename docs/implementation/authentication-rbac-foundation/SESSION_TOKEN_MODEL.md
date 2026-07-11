# Session and Token Model

Current session behavior:

- Admin cookies have finite lifetime and `session_version` validation.
- Driver bearer tokens are hashed at rest, expire, and can be revoked on logout.
- Warehouse session table and middleware are available for tokenized warehouse workflows.
- Disabled drivers and admin users are blocked.
- Role or status changes increment admin session version through existing update paths.

Compatibility:

- Legacy shared admin password remains only for bootstrap.
- Legacy driver API token remains only behind `ALLOW_LEGACY_DRIVER_API_TOKEN=true`.
