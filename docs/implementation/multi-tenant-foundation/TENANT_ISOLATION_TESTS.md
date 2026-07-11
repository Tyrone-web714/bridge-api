# Tenant Isolation Tests

Test script:

- `bridge-api/scripts/check-multi-tenant-foundation.cjs`

The test validates:

- Bootstrap Organization constants
- Required tenant context for Organization-private access
- Development compatibility fallback
- Cross-Organization access rejection
- Organization-scoped cache keys
- Company driver number reuse across Organizations
- Company driver number consistency within one Organization
- Migration presence for Organization, driver identity, and backfill exception structure
- Platform-global reference datasets are not tenant-owned by this migration
- No real customer company names are created by the migration

Neutral test tenant names:

- Demo Fleet A
- Demo Fleet B
- Demo Fleet C
