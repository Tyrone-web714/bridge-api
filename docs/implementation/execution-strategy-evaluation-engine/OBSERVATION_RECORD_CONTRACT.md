# Observation Record Contract

Observations use schema `execution.evaluation.observation.v1`. Each observation records assertion ID, case ID, evaluation type, domain, outcome, matched state, severity, expected value, actual value, message, and observation hash.

Domains include fact, field, safety, policy, privacy, numerical, structural, route, refusal, human review, timing, resource, and cost.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

