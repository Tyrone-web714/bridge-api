# Structured Output Evaluation

Structured evaluation checks object shape, required fields, malformed JSON, and unexpected fields when the benchmark case declares schema assertions. Schema failures are recorded as structural observations and result classes where applicable.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

