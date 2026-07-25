# Query And Lookup Utilities

The engine exports internal utilities to list runs, get a run request, list runs by capability/dataset/strategy/executor, list observations by outcome, list safety/policy/privacy/employment failures, list timeouts, list unauthorized candidates, list unknown-cost observations, list replayable runs, compare raw observations, and verify integrity/reproducibility metadata.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

