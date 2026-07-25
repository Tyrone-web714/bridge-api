# Evaluation Engine Architecture

Flow: evaluation request validation, dataset and capability lookup, candidate eligibility resolution, deterministic plan creation, offline/mock executor invocation, raw output capture, normalization, assertion evaluation, observation recording, descriptive aggregation, replay metadata, and generated reports.

The engine is intentionally internal and repository-based. It has no route mount, no scheduler, no database table, and no production routing integration.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

