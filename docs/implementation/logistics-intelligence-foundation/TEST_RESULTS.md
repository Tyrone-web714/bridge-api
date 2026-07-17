# Test Results

Validation completed during implementation and merge gate:

- `npm.cmd ci --dry-run`: Passed.
- `npm.cmd test`: Passed.
- `npm.cmd run test:auth-rbac`: Passed.
- `npm.cmd run test:api-tenant`: Passed.
- `npm.cmd run test:mobile-tenant`: Passed.
- `npm.cmd run test:shared-safety`: Passed.
- `npm.cmd run test:shared-safety-ui`: Passed.
- `npm.cmd run test:bi-kpi`: Passed.
- `npm.cmd run test:logistics-intelligence`: Passed.
- `npm.cmd run verify:secrets`: Passed.
- `npm.cmd run validate:logistics-intelligence`: Passed against isolated local PostgreSQL/PostGIS on `127.0.0.1:55444`; rerun passed against the same database to confirm repeatability.
- `/health`: Passed against isolated local PostgreSQL/PostGIS on local backend port `5068`.
- `/ready`: Passed against isolated local PostgreSQL/PostGIS on local backend port `5068`.
- `git diff --check`: Passed with Windows line-ending warnings only.

Runtime validation status:

- Temporary cluster path: user temp directory `tsr-li-pg-55444`.
- Port: `55444`.
- Database name: `tsr_logistics_validation`.
- PostgreSQL version: 17.10.
- PostGIS version: 3.6.2.

Migrations `001` through `007` were applied to the isolated database. Production migration `007` was not applied.
