# Test Results

The AI-IEP-004A.7 validation run completed successfully from `C:\dev\bridge-api\bridge-api`.

Commands passed:

- `node --check services/intelligenceExecution/decisionGovernance.js`
- `node --check scripts/generate-decision-governance-artifacts.cjs`
- `node --check scripts/check-decision-governance.cjs`
- `npm run decision-governance:generate`
- `npm run decision-governance:generate`
- `npm run decision-governance:validate`
- `npm run decision-governance:check`
- `npm run decision-governance:project`
- `npm run decision-governance:lineage`
- `npm run decision-governance:replay`
- `npm run test:decision-governance`
- `npm run execution-decisions:validate`
- `npm run execution-decisions:check`
- `npm run test:execution-decisions`
- `npm run test:cost-governance`
- `npm run test:scoring-engine`
- `npm run test:evaluation-engine`
- `npm run test:benchmark-datasets`
- `npm run test:capability-registry`
- `npm run test:intelligence-execution`
- `npm run test:ai-architecture`
- `npm run test:security`
- `npm test`

The full `npm test` run also passed AI contracts, supervisor intelligence, tenant, auth/RBAC, mobile tenant, shared safety, BI/KPI, logistics intelligence, fleet scoring, data lifecycle, enterprise identity, web origin, private media, private R2 shutdown, legacy private media, driver workflow, driver Copilot, security, and dashboard gates.

## Boundary

No live provider calls, production data, production approval, certification claim, migration, deployment, staging, commit, push, runtime activation, database write, object storage mutation, or cloud configuration change occurred.
