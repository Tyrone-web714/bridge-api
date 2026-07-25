# Raw Output Capture

Every attempted candidate records raw output, raw output hash, normalized output, normalized output hash, duration metadata, timeout state, retry count, usage if supplied, cost observation, and error text when applicable.

Raw output is synthetic and repository-local only.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

