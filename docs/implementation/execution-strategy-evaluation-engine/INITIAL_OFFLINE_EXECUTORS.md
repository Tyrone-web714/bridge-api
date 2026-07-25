# Initial Offline Executors

The initial mock executor catalog contains deterministic text cleanup, legacy structured response, and supervisor daily report executors. Behaviors include valid, invalid, partial, malformed JSON, timeout, and executor error paths.

All executors are marked mock-only, offline-capable, and not live-provider-call capable.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

