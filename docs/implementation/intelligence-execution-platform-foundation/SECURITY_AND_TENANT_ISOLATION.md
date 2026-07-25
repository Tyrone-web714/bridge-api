# Security and Tenant Isolation

Security controls implemented:

- authentication required;
- Organization context derived from trusted server-side auth context;
- RBAC enforced through intelligence.view;
- request body size and contract validation;
- no arbitrary prompt endpoint;
- no caller-selected provider;
- no caller-selected model;
- no cross-tenant cache key reuse;
- hosted inference disabled by default;
- audit events avoid raw input content and record metadata only.

Safety-critical results are advisory and require human review by default.
