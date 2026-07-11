# Deprecation Plan

Deprecated flows:

- shared admin password bootstrap
- legacy driver API token
- inline role-name checks without permission checks
- warehouse ID-only authentication

Removal conditions:

- Organization-scoped admin accounts are provisioned.
- Mobile clients use driver session login consistently.
- Warehouse PIN/session flow is validated in pilot.
- Critical and High routes have explicit permission middleware coverage.
- Rollback baseline is recorded.
