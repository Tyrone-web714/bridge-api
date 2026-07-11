# Tenant Context

The tenant context representation is implemented in `bridge-api/services/tenantContext.js`.

It supports:

- organizationId
- actor identity where available
- role and permissions where available
- request correlation ID

Organization-private repository paths must accept or derive tenant context and filter by `organization_id`.

## Development Compatibility

Existing workflows do not yet carry authenticated Organization claims. For this foundation phase, compatibility paths may explicitly allow fallback to the bootstrap Development Organization.

The fallback is named in code as `allowDevelopmentFallback`. It is intended to be temporary and removable after authenticated Organization claims are implemented.

Clients must not be trusted to supply arbitrary Organization identifiers for private data access.
