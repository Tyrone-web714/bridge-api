# Production Release Gates

Gate 1 - Source:

- `main` clean.
- Expected commit verified.
- Tests pass.
- Secret scan passes.

Gate 2 - Database:

- Starting schema known.
- Migration sequence verified.
- Read-only preflight passes.

Gate 3 - Backup:

- Backup captured.
- Backup integrity confirmed.
- Restore procedure available.
- Restore rehearsal evidence available.

Gate 4 - Security:

- Authentication passes.
- RBAC passes.
- Tenant isolation passes.
- No exposed secrets.

Gate 5 - Deployment:

- Deployment configuration verified.
- Required env vars configured.
- Deployment artifact identified.

Gate 6 - Post-deployment:

- `/health` passes.
- `/ready` passes.
- Critical workflows pass.
- Monitoring shows no Critical/High failure.

Gate 7 - Rollback:

- Rollback decision owner identified.
- Rollback triggers documented.
- Recovery procedure available.

No production rollout should proceed if a mandatory gate is unresolved.
