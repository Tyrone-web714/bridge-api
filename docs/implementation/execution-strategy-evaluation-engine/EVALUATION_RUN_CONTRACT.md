# Evaluation Run Contract

Runs use schema `execution.evaluation.run.v1`. A run records request hash, plan hash, result hash, raw candidate results, normalized outputs, observations, descriptive aggregates, and replay metadata.

Result classes include success, partial output, invalid output, schema error, assertion failure, executor error, timeout, skipped, unauthorized, unsupported, policy blocked, safety blocked, privacy blocked, human review required, and insufficient evidence.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

