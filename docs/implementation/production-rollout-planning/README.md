# Production Rollout Planning

Branch: `production-rollout-planning`

Baseline: `08d5aec` (`Finalize pilot integration hardening`)

Status: Planning and readiness only. This package does not deploy, does not apply production migrations, and does not modify production data.

Recommendation: CONDITIONAL GO for rollout planning completion, not production deployment.

Primary outputs:

- Production architecture audit.
- Migration inventory and dependency graph for migrations 001-008.
- Read-only production database preflight design.
- Backup and restore requirements plus non-production rehearsal evidence.
- Rollback strategy and rollout runbook.
- Environment, deployment, health/readiness, smoke, observability, and gate documentation.

Validation commands:

- `npm.cmd run validate:production-rollout`
- `npm.cmd run production:db:preflight`

`production:db:preflight` is read-only but must not be run against production until the owner explicitly approves the target database connection.
