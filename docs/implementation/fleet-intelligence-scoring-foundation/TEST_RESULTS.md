# Test Results

Validation completed on 2026-07-17 from branch `fleet-intelligence-scoring-foundation`.

Passed validation commands:

- `npm.cmd run test:fleet-intelligence-scoring`
- `npm.cmd test`
- `npm.cmd ci --dry-run`
- `npm.cmd run validate:auth-rbac`
- `npm.cmd run validate:shared-safety`
- `npm.cmd run validate:bi-kpi`
- `npm.cmd run validate:logistics-intelligence`
- `npm.cmd run validate:fleet-intelligence-scoring`
- `npm.cmd run verify:secrets`
- `git diff --check`

Runtime validation used an isolated local PostgreSQL/PostGIS validation database:

- Host: `127.0.0.1`
- Port: `55447`
- Database: `tsr_fiss_mergegate`
- User: `tsr_validation`
- PostgreSQL: `17.10`
- PostGIS: `3.6.2`

Migration validation:

- Migrations `001` through `008` applied successfully.
- `008_fleet_intelligence_scoring_foundation.sql` created the expected Fleet Intelligence Scoring tables.
- Foreign-key delete rules preserve score history through restrictive model and snapshot relationships.
- Rollback-shape validation confirmed Logistics Intelligence and BI/KPI tables remain intact when Fleet Intelligence Scoring tables are removed inside a transaction.

Runtime validation:

- Score models and active versions were created within a single Organization context.
- Logistics Intelligence signals, findings, recommendations, and outcomes were consumed as scoring inputs.
- Score snapshots were calculated with bounded deterministic scores, component snapshots, confidence, explanation, lineage, and source summaries.
- Idempotent calculation run keys returned the same snapshot without duplicate writes.
- Cross-tenant access was denied.
- insufficient-permission calculation attempts were denied.
- Active model versions and historical score snapshots were immutable.
- Benchmark sets were created as Organization-private and not shared.

Local deployment smoke checks:

- `/health` passed against the isolated database.
- `/ready` passed against the isolated database.
