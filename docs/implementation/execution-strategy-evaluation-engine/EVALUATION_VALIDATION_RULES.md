# Evaluation Validation Rules

Validation is fail-closed for run identity, request compatibility, candidate strategy, executor compatibility, hosted/premium/human-review authorization, retired datasets, production data, malformed controls, execution result consistency, observation consistency, cost precision, secret-like content, stale generated artifacts, and hash integrity.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

