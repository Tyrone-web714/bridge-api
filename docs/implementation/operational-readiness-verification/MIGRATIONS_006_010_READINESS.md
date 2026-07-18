# Migrations 006-010 Readiness

Status: READY WITH LIMITATION.

No production migrations were applied.

Production execution status for all migrations in this file: not applied by this phase and not verified against production schema.

| Migration | Production Schema Prerequisite | Application Dependency | Data Impact | Locking Risk | Backup Requirement | Rollback Posture | Owner Approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `006_bi_kpi_foundation.sql` | migrations `001`-`004` | BI/KPI APIs and dashboards | additive KPI tables, immutable formula/snapshot records | Medium | required | prefer app rollback or corrective forward migration; preserve snapshots | required |
| `007_logistics_intelligence_foundation.sql` | migrations `001`-`004`, operational source data | Logistics Intelligence APIs and decision center | additive events/signals/findings/recommendations | Medium | required | preserve decisions/outcomes; corrective forward migration preferred | required |
| `008_fleet_intelligence_scoring_foundation.sql` | migrations `001`-`004`, `007` lineage | FISS score APIs and views | additive scoring models/snapshots/components | Medium | required | preserve historical score snapshots | required |
| `009_data_lifecycle_foundation.sql` | migrations `001`-`004`, object-reference awareness | ODR-019 lifecycle APIs and jobs | additive retention, holds, requests, tombstones, exports, lifecycle events | Medium | required | never purge production without approved policy; corrective forward migration preferred | required |
| `010_enterprise_identity_foundation.sql` | migrations `001`-`004`, active admin/users/Organizations | ODR-020 IdP, SSO, SCIM, identity audit APIs | additive identity providers, memberships, domains, mappings, SSO transactions, SCIM, break-glass, security events | Medium | required | preserve identity/audit records; app rollback or corrective forward migration preferred | required |

## Production Verification Required

- read-only production DB preflight through migration `010`
- verified production backup
- restore rehearsal or formal scheduled restore
- deployment rollback baseline
- Render environment review
- authenticated smoke after deployment alignment
