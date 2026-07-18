# Production Migration Inventory

Production application status for all migrations: NOT VERIFIED. No production migration was applied in this phase.

| Migration | Purpose | Dependencies | Tables Created | Tables Modified | Risk | Rollback Strategy |
| --- | --- | --- | --- | --- | --- | --- |
| 001_audit_events.sql | Request audit events | base schema | `audit_events` | none | Low | Application rollback or preserve table; restore only if required. |
| 002_driver_sessions.sql | Driver session table and PIN hash | `drivers` | `driver_sessions` | `drivers.pin_hash` | Medium | Prefer application rollback; database restore if session data corrupts. |
| 003_multi_tenant_foundation.sql | Organizations, tenant columns, driver identity, backfill | 001-002, existing operational tables | `organizations`, `tenant_backfill_exceptions` | many Organization-private tables | High | Backup/restore or corrective forward migration; do not destructive down-migrate. |
| 004_authentication_rbac_foundation.sql | Approved roles, permissions, warehouse sessions | 003 | `role_permissions`, `warehouse_employee_sessions` | `admin_users`, `audit_events`, `driver_sessions`, `warehouse_employees` | High | Application rollback may work if additive; restore for failed constraints/data. |
| 005_shared_safety_foundation.sql | Shared Safety private submissions and moderation | 003-004 | `private_hazard_submissions`, `shared_safety_moderation_candidates`, `shared_safety_records`, `shared_safety_publication_sources` | `role_permissions` | Medium | Prefer application rollback/corrective forward migration; preserve safety records. |
| 006_bi_kpi_foundation.sql | KPI definitions, immutable formulas/snapshots, dashboards, alerts | 003-004 | KPI, formula, snapshot, dashboard, widget, alert, job tables | `role_permissions` | Medium | Prefer application rollback/corrective forward migration; snapshots are historical. |
| 007_logistics_intelligence_foundation.sql | Events, signals, findings, recommendations, decisions, outcomes | 003-004, operational source data, optionally 006 | Logistics event/intelligence tables | `role_permissions` | Medium | Prefer application rollback/corrective forward migration; do not delete decisions/outcomes. |
| 008_fleet_intelligence_scoring_foundation.sql | Score models, immutable score snapshots, components, benchmarks | 003-004, 007 lineage | FISS model/version/snapshot/component/benchmark tables | `role_permissions` | Medium | Prefer application rollback/corrective forward migration; preserve score snapshots. |

## Locking And Backfill Notes

- 003 performs broad `ALTER TABLE` and `UPDATE` backfills; it is the highest migration-locking risk.
- 006 and 008 create immutability triggers; rollback should not remove historical snapshots without restore authorization.
- 007 and 008 use `ON DELETE RESTRICT` on historical decision/scoring relationships to avoid accidental loss.
