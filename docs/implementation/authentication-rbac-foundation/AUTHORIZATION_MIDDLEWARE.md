# Authorization Middleware

Implemented in `middleware/authorization.js`:

- `attachAuthContext`
- `requireAuthentication`
- `requireOrganizationContext`
- `requireRole`
- `requirePermission`
- `requirePlatformAdmin`
- `assertRequestOrganization`

The middleware is intentionally additive in this phase so existing pilot workflows remain stable while new Critical and High paths can be moved onto permission checks safely.
