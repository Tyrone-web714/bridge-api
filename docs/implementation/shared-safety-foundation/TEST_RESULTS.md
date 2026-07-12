# Test Results

Status: Passed for branch validation.

Required checks:

- `npm ci --dry-run`: Passed with filesystem permission against the linked worktree.
- `npm test`: Passed.
- `npm run test:auth-rbac`: Passed.
- `npm run test:api-tenant`: Passed.
- `npm run test:mobile-tenant`: Passed.
- `npm run test:shared-safety`: Passed.
- `npm run validate:shared-safety`: Passed against isolated local PostgreSQL/PostGIS on `127.0.0.1:55441`.
- `npm run verify:secrets`: Passed.
- migration validation on isolated PostgreSQL/PostGIS: migrations `001` through `005` applied successfully.
- rollback validation: destructive rollback sequence was validated inside a transaction and rolled back; all four Shared Safety tables remained present.
- `/health`: Passed against isolated validation database.
- `/ready`: Passed against isolated validation database after PostGIS initialization and non-production durable-storage placeholder configuration.
- private hazard submission smoke test: Passed.
- moderation approval/rejection smoke tests: Passed.
- shared read smoke test: Passed.
- tenant-isolation smoke test: Passed.
- `git diff --check`: Passed.

Production data was not modified.
