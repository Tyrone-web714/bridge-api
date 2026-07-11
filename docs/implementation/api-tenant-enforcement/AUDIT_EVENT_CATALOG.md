# Audit Event Catalog

Security events added:

- `unauthenticated_access_attempt`
- `permission_denial`
- `cross_tenant_access_denial`

Recorded fields:

- request ID
- actor type
- actor ID
- Organization ID where available
- method
- path
- status code
- hashed network address
- event type
- outcome
- session ID where available
- non-sensitive metadata such as denial code, approved role, and permission

Credentials, tokens, PINs, passwords, secret values, and request bodies are not logged.
