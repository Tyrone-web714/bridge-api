# Test Results

Automated tests added:

- `npm.cmd run test:enterprise-identity`
- `npm.cmd run validate:enterprise-identity`

Runtime validation uses isolated PostgreSQL/PostGIS only and does not contact external identity providers.

Validated outcomes:

- Migration 001 through 010 passed on a fresh isolated database.
- Tenant isolation passed.
- Secret redaction and raw-secret rejection passed.
- Email-only account linking denial passed.
- Platform Admin claim-mapping denial passed.
- Unverified-domain discovery denial passed.
- Verified-domain discovery passed.
- SSO state mismatch denial passed.
- SSO replay denial passed.
- Federated login rebuilt TSR authorization context.
- SCIM deactivation blocked future federated login.
- Existing regression chain passed.

Provider verification remains pending.
