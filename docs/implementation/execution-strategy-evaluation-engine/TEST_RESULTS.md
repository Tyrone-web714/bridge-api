# Test Results

AI-IEP-004A.3 validation completed from `C:\dev\bridge-api\bridge-api` on 2026-07-25.

Passed commands:

- `node scripts/check-execution-evaluation-engine.cjs`
- `npm run evaluation-engine:generate` twice; second pass produced no additional file classes or diff churn
- `npm run evaluation-engine:validate`
- `npm run evaluation-engine:check`
- `npm run test:evaluation-engine`
- `npm run test:capability-registry`
- `npm run capability-registry:check`
- `npm run test:benchmark-datasets`
- `npm run benchmark-datasets:check`
- `npm run test:intelligence-execution`
- `npm run test:ai`
- `npm run test:ai-architecture`
- `npm run test:supervisor-intelligence`
- `npm run test:api-tenant`
- `npm run test:security`
- `npm test`

Controlled negative checks:

- A deliberate mutation to `generated/evaluation_run_catalog.json` caused `npm run evaluation-engine:check` to fail with stale artifact detection; regeneration restored the artifact.
- A deliberate mutation to the authoritative text-cleanup evaluation request dataset version caused `npm run evaluation-engine:check` to fail with `UNKNOWN_DATASET`; the fixture was restored and `npm run test:evaluation-engine` passed afterward.

Previously blocked commands `npm run test:supervisor-intelligence`, `npm run test:api-tenant`, `npm run test:security`, and `npm test` are now verified passing.


## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

