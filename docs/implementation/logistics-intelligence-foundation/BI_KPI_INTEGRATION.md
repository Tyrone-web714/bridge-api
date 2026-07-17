# BI/KPI Integration

BI/KPI snapshots may enter Logistics Intelligence as `kpi_snapshot_created` events.

The Logistics Intelligence layer stores the KPI snapshot reference in event payload and lineage. It does not mutate KPI definitions, formula versions, snapshots, dashboards, alerts, or exports.

Critical or warning KPI threshold statuses can produce Logistics Intelligence signals, findings, and recommendations for supervisor review. BI/KPI remains the source of truth for formulas and KPI snapshots.
