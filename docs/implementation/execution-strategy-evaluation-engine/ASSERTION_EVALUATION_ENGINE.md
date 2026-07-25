# Assertion Evaluation Engine

The engine evaluates normalized text match, structured schema, field-level assertions, numerical tolerance, policy constraints, safety constraints, route constraints, refusal expectations, insufficient-evidence expectations, and human-review expectations.

Owner-defined evaluators such as rubric, classification, ranking, reference comparison, and hybrid evaluation are represented as unavailable observations where deterministic evaluation is not yet defined.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

