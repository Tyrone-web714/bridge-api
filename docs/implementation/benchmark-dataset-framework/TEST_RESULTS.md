# Test Results

AI-IEP-004A.2 local validation completed on 2026-07-25.

Commands run:

- `npm run benchmark-datasets:update-hashes` - passed; updated source hashes for 3 datasets.
- `npm run benchmark-datasets:generate` - passed; generated 7 artifacts in `docs\implementation\benchmark-dataset-framework\generated`.
- `npm run benchmark-datasets:generate` - passed a second time with no unexpected working-tree churn.
- Controlled stale generated artifact mutation - `npm run benchmark-datasets:check` failed as expected and regeneration restored the artifact.
- Controlled source fixture mutation without hash update - `npm run benchmark-datasets:validate` failed as expected on `MISMATCHED_CASE_HASH`, `MISMATCHED_MANIFEST_HASH`, and `MISMATCHED_CONTENT_HASH`; the source file was restored from backup.
- `npm run benchmark-datasets:check` - passed after restoration.
- `npm run test:benchmark-datasets` - passed; dataset schema, case schema, validation rules, queries, lifecycle transitions, coverage, hashing, and generated artifacts verified.
- `npm run test:capability-registry` - passed; enterprise registry validation, queries, lifecycle transitions, artifacts, and IEP compatibility verified.
- `npm run test:intelligence-execution` - passed; foundation contracts, planner, policy, deterministic execution, security, and docs verified.
- `npm run test:ai` - passed; AI route contracts, mocked provider behavior, token-cost estimation, legacy AI migration, and supervisor recommendation contracts verified.
- `npm run test:ai-architecture` - passed; provider bypass enforcement verified.
- `npm run test:supervisor-intelligence` - passed; alerts, schedules, reports, runner, deterministic report, and IEP migration contracts verified.
- `npm run test:api-tenant` - passed; API tenant-enforcement checks passed.
- `npm run test:security` - passed; authentication, headers, CORS, limits, photo validation, and audit logging verified.
- `npm test` - passed; full local suite completed with the benchmark dataset framework included.

No live provider calls, production database access, migrations, deployments, pushes, or production configuration changes were performed.