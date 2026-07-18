# Test Results

Validation completed on `2026-07-18` against source checks and an isolated local PostgreSQL/PostGIS database on port `55448`.

- `npm.cmd ci --dry-run`
- `npm.cmd test`
- `npm.cmd run verify:secrets`
- `npm.cmd run verify:production` with validation-only environment values
- `npm.cmd run validate:auth-rbac`
- `npm.cmd run validate:shared-safety`
- `npm.cmd run validate:bi-kpi`
- `npm.cmd run validate:logistics-intelligence`
- `npm.cmd run validate:fleet-intelligence-scoring`
- `npm.cmd run validate:pilot-integration`
- `npm.cmd run validate:production-rollout`
- `npm.cmd run validate:data-lifecycle`
- migrations `001` through `009` against isolated PostgreSQL/PostGIS
- local `/health`
- local `/ready`
- `git diff --check`

Result: Passed.

Defects found and fixed during validation:

- Recovery-window SQL placeholder used ambiguous typing; fixed with explicit integer interval arithmetic.
- Organization purge preview attempted optional counts on tables without `organization_id`; fixed by checking column existence first.
- Runtime test initially assumed Organization Admin could terminate an Organization; corrected to keep Organization termination Platform Admin-gated.
- Merge-gate review found purge execution was not linked to an impact-preview job; fixed and covered by runtime validation.

Final results are summarized in `FINAL_VALIDATION_REPORT.md`.
