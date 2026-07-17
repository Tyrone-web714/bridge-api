# Authorization and Permissions

New permissions:

- `intelligence.view`
- `intelligence.review`
- `intelligence.manage`
- `recommendation.view`
- `recommendation.decide`
- `outcome.record`
- `platform.intelligence.support`

Default role alignment:

- Platform Admin: all Logistics Intelligence permissions.
- Organization Admin: Organization-scoped management, review, decisions, and outcomes.
- Supervisor: Organization-scoped review, recommendations, decisions, and outcomes.
- Driver: limited recommendation view only where explicitly surfaced.
- Warehouse Employee: limited intelligence view only where warehouse workflows require it.

All access remains private by default and Organization-scoped.
