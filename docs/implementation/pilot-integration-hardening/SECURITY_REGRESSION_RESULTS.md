# Security Regression Results

Status: READY WITH LIMITATION

Validated:

- Driver wrong Organization route access denied.
- Wrong driver route access denied.
- Warehouse employee ID alone fails.
- Warehouse authenticated operation succeeds only with second factor.
- FISS cross-Organization access denied.
- Shared Safety publication excludes private route context.

Planned full regression commands:

- `npm.cmd test`
- `npm.cmd run verify:secrets`
- `npm.cmd run validate:auth-rbac`
- `npm.cmd run validate:shared-safety`
- `npm.cmd run validate:bi-kpi`
- `npm.cmd run validate:logistics-intelligence`
- `npm.cmd run validate:fleet-intelligence-scoring`
- `npm.cmd run validate:pilot-integration`

Remaining limitation:

- Physical offline revoked-session sync denial was not rerun in this phase.

