# Execution Strategy Evaluation Engine

AI-IEP-004A.3 adds a provider-neutral, repository-native engine for evaluating registered intelligence execution strategies against approved benchmark datasets. It consumes the enterprise capability registry, benchmark dataset framework, offline evaluation requests, and mock executor fixtures.

The implementation lives in `bridge-api/services/intelligenceExecution/evaluationEngine.js`. Authoritative fixtures live in `bridge-api/evaluations`. Deterministic generated artifacts live in `docs/implementation/execution-strategy-evaluation-engine/generated`.

Run `npm run test:evaluation-engine` or `npm run evaluation-engine:check` to validate requests, plans, runs, observations, replay metadata, generated artifacts, and live-provider boundaries.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

