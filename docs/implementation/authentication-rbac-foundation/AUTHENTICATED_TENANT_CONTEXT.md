# Authenticated Tenant Context

`middleware/authorization.js` creates `req.authContext` from trusted server-side identities:

- Admin session
- Driver session
- Warehouse session

Context fields:

- authenticated state
- actor type
- actor ID
- display name
- Organization ID where applicable
- legacy role
- approved role
- permissions
- session ID

Client-supplied `organization_id` is not used as the trusted tenant source.
