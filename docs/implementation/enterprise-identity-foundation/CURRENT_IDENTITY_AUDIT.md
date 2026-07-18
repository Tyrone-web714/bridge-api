# Current Identity Audit

Admin users are stored in `admin_users` with username, internal user ID, Organization ID, approved role, permissions derived from RBAC, lifecycle status, active flag, and session version. Local admin login remains password based.

Drivers are stored in `drivers` with internal driver ID, Organization ID, and Organization-scoped company driver number. Mobile login continues to accept the company driver number where operationally appropriate, then resolves to internal driver and Organization context.

Warehouse employees are stored in `warehouse_employees` and continue to require warehouse authentication controls. ODR-020 does not weaken ODR-010.

Sessions exist for admin cookies, driver bearer sessions, and warehouse sessions. Existing lifecycle checks block inactive drivers, inactive users, inactive warehouse employees, and inactive Organizations.

Legacy paths remain for pilot compatibility. Enterprise identity does not remove local login until provider verification and SSO rollout policy are approved.

Current coupling: admin user records still hold local identity and Organization role data. Migration 010 adds `organization_memberships` as the explicit membership boundary for federation while preserving compatibility.

Risks audited: email is not accepted as a permanent federated key, company driver number is not the permanent backend driver identity, and IdP group claims cannot create arbitrary roles.

