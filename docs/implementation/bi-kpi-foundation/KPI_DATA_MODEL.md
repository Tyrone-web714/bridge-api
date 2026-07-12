# KPI Data Model

Migration: `bridge-api/migrations/006_bi_kpi_foundation.sql`.

Tables:

- `kpi_definitions`
- `kpi_formula_versions`
- `kpi_snapshots`
- `bi_dashboards`
- `bi_dashboard_widgets`
- `kpi_alert_rules`
- `kpi_alert_events`
- `kpi_calculation_jobs`

All Organization-private tables include `organization_id` directly or inherit it through an Organization-owned parent record.

Snapshots and active formula versions have database triggers that prevent unsafe mutation. Historical results must be preserved by creating new snapshots, not by overwriting old ones.
