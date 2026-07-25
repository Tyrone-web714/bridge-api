# Textual Evaluation

Textual evaluation compares normalized text and verifies inclusion/exclusion assertions. It records missing facts and prohibited claims as raw observations. The engine does not use model-assisted semantic grading in this phase.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

