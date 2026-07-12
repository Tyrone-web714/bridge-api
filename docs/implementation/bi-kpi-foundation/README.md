# BI/KPI Foundation

Status: implemented on branch `bi-kpi-foundation`.

This phase adds the first Organization-scoped BI/KPI foundation. It is not a full enterprise BI suite and does not implement Logistics Intelligence, Fleet Intelligence Scoring, advanced AI, billing, or self-service dashboard building.

Implemented foundation:

- Organization-scoped KPI definitions
- Versioned structured formula definitions
- Safe deterministic formula engine with no arbitrary code execution
- Immutable KPI snapshots with calculation trace
- Dashboard and widget foundation
- KPI alert/exception foundation
- Bounded CSV snapshot export
- Scheduled calculation job table and idempotent run key foundation
- Tenant isolation and permission enforcement

Production note: migration `006_bi_kpi_foundation.sql` was validated only against an isolated local PostgreSQL/PostGIS database. Do not apply it to production without release approval.
