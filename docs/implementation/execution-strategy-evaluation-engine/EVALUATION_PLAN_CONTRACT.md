# Evaluation Plan Contract

Plans use schema `execution.evaluation.plan.v1`. Plan items are deterministic case-by-candidate records containing case ID, candidate ID, strategy, executor ID, timeout, retry count, eligibility state, and eligibility reason.

Ineligible candidates are recorded as skipped, unauthorized, or unsupported rather than omitted.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

