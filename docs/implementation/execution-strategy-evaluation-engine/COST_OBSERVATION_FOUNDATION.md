# Cost Observation Foundation

Cost is recorded as raw known or unknown metadata. Unknown cost remains null, not zero. Verified-zero mock cost is distinct from unknown cost.

The engine does not calculate cost effectiveness, TCO, ROI, provider ranking, model ranking, or cost-per-success.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

