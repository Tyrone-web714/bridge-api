# TEST RESULTS

AI-IEP-004A.4 validation completed from `C:\dev\bridge-api\bridge-api` on 2026-07-25.

Passed commands:

- `node -c services/intelligenceExecution/scoringEngine.js`
- `node -c scripts/check-scoring-engine.cjs`
- `node -c scripts/generate-scoring-engine-artifacts.cjs`
- `node scripts/check-scoring-engine.cjs`
- `npm run scoring-engine:generate` twice; second pass was deterministic
- `npm run scoring-engine:validate`
- `npm run scoring-engine:check`
- `npm run test:scoring-engine`
- `npm run test:capability-registry`
- `npm run test:benchmark-datasets`
- `npm run test:evaluation-engine`
- `npm run test:intelligence-execution`
- `npm run test:ai`
- `npm run test:ai-architecture`
- `npm run test:supervisor-intelligence`
- `npm run test:api-tenant`
- `npm run test:security`
- `npm test`

Controlled negative checks:

- A deliberate mutation to `generated/score_run_catalog.json` caused `npm run scoring-engine:check` to fail with stale artifact detection; regeneration restored the artifact.
- A deliberate mutation to `scoring/profiles/core-balanced-test-profile.json` changed `dimensionWeightTotal` and caused `npm run scoring-engine:check` to fail with `INVALID_WEIGHT_TOTAL`; the fixture was restored and `npm run test:scoring-engine` passed afterward.

The full test suite passed with `test:scoring-engine` integrated into `npm test`.


## Boundaries

- Test-only repository artifacts.
- No production scoring policy, provider ranking, model ranking, production recommendation, cost-effectiveness, TCO, or ROI.
- No live providers, production data, database persistence, migrations, deployments, public API, or runtime routing changes.
