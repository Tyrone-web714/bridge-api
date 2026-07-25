# Evaluation Storage Model

Authoritative request fixtures live under `bridge-api/evaluations/requests`. Mock executor fixtures live under `bridge-api/evaluations/executors`. Templates live under `bridge-api/evaluations/templates`. Generated outputs live under this documentation directory's `generated` folder.

No database persistence is created.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

