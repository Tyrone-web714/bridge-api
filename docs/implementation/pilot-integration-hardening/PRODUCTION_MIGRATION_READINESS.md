# Production Migration Readiness

Migrations reviewed:

- 006 BI/KPI
- 007 Logistics Intelligence
- 008 Fleet Intelligence Scoring

Status: READY WITH LIMITATION

Dependency order:

1. Existing multi-tenant/auth/API foundations.
2. Migration 006.
3. Migration 007.
4. Migration 008.

Prerequisites:

- Fresh production backup.
- Restore target identified.
- Restore drill completed or formally scheduled.
- Release window approved.
- Render environment variables verified.
- PostGIS readiness confirmed.
- Application deploy rollback target recorded.

Runtime considerations:

- Migrations create analytical/intelligence/scoring structures used by current merged code.
- Production code paths depending on these tables should not be enabled for pilot until migration approval is complete.

Rollback posture:

- Prefer deploy rollback first for application failure.
- Database rollback requires restore plan; do not destructively down-migrate production without owner-approved rollback procedure.

Production migrations applied in this phase: none.

