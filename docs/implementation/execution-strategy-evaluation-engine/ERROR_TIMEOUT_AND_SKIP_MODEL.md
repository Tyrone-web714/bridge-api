# Error Timeout And Skip Model

Timeouts, executor errors, malformed structured output, ineligible candidates, unauthorized candidates, and unsupported candidates are explicit result classes. A single candidate failure does not abort the run.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

