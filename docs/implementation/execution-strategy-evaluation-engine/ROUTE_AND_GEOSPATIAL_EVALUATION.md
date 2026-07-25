# Route And Geospatial Evaluation

Route and geospatial evaluation is limited to declared route/safety assertions in synthetic benchmark cases. The engine does not call routing APIs, map APIs, paid geocoding, or route optimization services.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

