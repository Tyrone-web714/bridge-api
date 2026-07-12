# Rollback Procedure

Application rollback:

1. Stop deployment of the BI/KPI branch.
2. Redeploy the last validated release before `bi-kpi-foundation`.
3. Verify `/health` and `/ready`.
4. Verify existing admin dashboard pages still load.

Database rollback:

- This phase introduces additive migration `006`.
- Do not apply it to production without a release plan and rollback baseline.
- If production migration is later approved and rollback is required, use the approved provider backup/restore procedure.

Data preservation:

- KPI snapshots are immutable and should not be deleted during application rollback unless an approved data rollback plan exists.
