# Database Migration

Migration:

- `migrations/004_authentication_rbac_foundation.sql`

Additive changes:

- admin user internal ID, approved role, disabled timestamp
- role permission table
- audit event Organization/session/outcome metadata
- driver session revocation reason
- warehouse employee lockout/login metadata
- warehouse employee sessions

Production data was not modified during this phase.

Validation:

- Isolated local PostgreSQL 17 cluster created under the backend temp validation folder.
- Validation database: `tsr_auth_validation`.
- Applied migrations: `001_audit_events.sql`, `002_driver_sessions.sql`, `003_multi_tenant_foundation.sql`, `004_authentication_rbac_foundation.sql`.
- Verified `role_permissions`, `warehouse_employee_sessions`, `admin_users.approved_role`, and `audit_events.organization_id`.
- Enabled and initialized PostGIS for readiness validation.
- Stopped the isolated validation cluster after checks.
