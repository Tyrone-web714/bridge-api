# ROLLBACK PLAN

Rollback is repository-only: remove cost-governance source, fixtures, requests, templates, generated artifacts, scripts, docs, package script wiring, and the PROJECT_STATUS.md status sentence.

Then rerun cost-governance, scoring, evaluation, benchmark, capability registry, IEP, AI, supervisor intelligence, tenant, security, and full npm regression tests.

No database rollback, cloud rollback, provider rollback, billing rollback, object-storage rollback, credential rollback, migration rollback, or production-data cleanup is required because this phase performs no production mutation.

Do not attempt production budget remediation from this rollback plan.

If validation fails after rollback, stop and report the exact failing command and diff.
