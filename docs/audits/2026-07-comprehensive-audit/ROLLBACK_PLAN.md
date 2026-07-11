# Rollback Plan

## Rules

Take backups before schema/data migration. Prefer additive migrations. Preserve driver-ID route lookup. Do not enable tenant gates until backfill validation passes. Mobile must support old and new auth payloads during rollout.

## Phase Summary

| Phase | Failure Detection | Rollback |
| --- | --- | --- |
| 0 | failed readiness/tests | revert docs/config only if needed. |
| 1 | org bootstrap failure | disable org-aware paths, drop additive tables only after backup review. |
| 2 | missing tenant keys | restore backup or reverse additive columns. |
| 3 | auth failures | fallback behind feature flag, retain old sessions temporarily. |
| 4 | permission regressions | disable permission gate, preserve audit logs. |
| 5 | cross-tenant test failure | rollback API release, keep org columns. |
| 6 | data mismatch | stop writes and restore point-in-time backup. |
| 7 | shared safety leakage | disable shared layer and restore safety tables. |
| 8 | mobile duplicate sync | block replay, ship hotfix, dedupe server-side. |
| 9-12 | analytics/AI/perf failures | feature flag off; driver-critical workflow remains independent. |
