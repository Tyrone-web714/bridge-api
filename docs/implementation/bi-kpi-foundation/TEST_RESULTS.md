# Test Results

Status: initial BI/KPI foundation validation passed on branch `bi-kpi-foundation`.

Validation date: 2026-07-12.

Passed:

- `node -c services/biKpi.js`
- `node -c routes/biKpi.js`
- `node -c scripts/check-bi-kpi-foundation.cjs`
- `node -c scripts/validate-bi-kpi-runtime.cjs`
- `npm.cmd ci --dry-run`
- `npm.cmd test`
- `npm.cmd run test:auth-rbac`
- `npm.cmd run test:api-tenant`
- `npm.cmd run test:mobile-tenant`
- `npm.cmd run test:shared-safety`
- `npm.cmd run test:shared-safety-ui`
- `npm.cmd run test:bi-kpi`
- `npm.cmd run validate:bi-kpi`
- `npm.cmd run verify:secrets`
- `git diff --check`

Runtime validation used an isolated local PostgreSQL/PostGIS database on `127.0.0.1:55443` and applied migrations `001` through `006`.

HTTP smoke checks passed:

- `/health` returned `200`
- `/ready` returned `200`
- `/api/bi-kpi/admin` rendered the BI/KPI Foundation page
- KPI definition creation succeeded
- Formula version creation succeeded
- Formula calculation created an immutable snapshot
- Snapshot drill-down included explanation trace
- Dashboard creation succeeded
- CSV export returned `200`
- Organization B received `404` for Organization A KPI definition
- Driver calculate attempt returned `403`
- Missing and invalid admin CSRF tokens returned `403`

Defect fixed during validation:

- BI/KPI admin mutations initially allowed a cookie-session request without the BI/KPI CSRF header to reach input validation. The route guard now keys off authenticated `admin_user` context and rejects missing or invalid `x-tsr-admin-csrf` with `403`.

Production data modified: no.

Production migration applied: no.

Full regression results are recorded in the final response for this phase.
