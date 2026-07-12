# Tenant Isolation

BI/KPI data is Organization-private.

Enforced boundaries:

- KPI definitions include `organization_id`.
- Formula versions are reached through Organization-owned definitions.
- Snapshots include `organization_id`.
- Dashboards include `organization_id`.
- Alerts include `organization_id`.
- Exports use authenticated Organization context.
- Service methods use trusted auth context, not client-supplied Organization IDs.

Platform-global reference data may be used as inputs only through approved future paths.
