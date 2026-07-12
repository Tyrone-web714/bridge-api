# Authorization and Permissions

New permissions:

- `kpi.view`
- `kpi.manage`
- `kpi.formula.manage`
- `kpi.calculate`
- `kpi.snapshot.view`
- `dashboard.export`
- `kpi.alert.manage`
- `platform.kpi.support`

Defaults:

- Platform Admin: platform support permission, but Organization-private BI/KPI operations still require an Organization context.
- Organization Admin: manages KPI definitions, formulas, dashboards, alerts, thresholds, and exports for one Organization.
- Supervisor: views dashboards, calculates permitted KPIs, views snapshots, and exports where permitted.
- Driver: views permitted personal KPI results only.
- Warehouse Employee: views permitted warehouse-relevant metrics only.

No new role types were added.
