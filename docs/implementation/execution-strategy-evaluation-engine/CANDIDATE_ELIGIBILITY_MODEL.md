# Candidate Eligibility Model

Eligibility requires a known capability, known dataset, compatible capability/dataset pairing, known strategy, known executor, executor-capability compatibility, executor-strategy compatibility, allowed capability strategy, offline-safe executor metadata, and mock authorization for hosted strategy evaluation.

Premium execution is prohibited in this phase. Unauthorized candidates remain in the run record as observations.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

