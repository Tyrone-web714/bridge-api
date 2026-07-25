# Deterministic Replay

Replay metadata compares request hash, plan hash, engine version, and result hash. The engine claims deterministic replay only when hashes and metadata align. It does not falsely claim reproducibility after fixture, executor, or metadata changes.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

