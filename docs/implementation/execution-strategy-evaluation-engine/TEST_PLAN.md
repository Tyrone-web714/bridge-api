# Test Plan

Validation covers schemas, request errors, strategy and executor errors, hosted/premium/human-review authorization, retired datasets, deterministic plans, raw output capture, malformed JSON, normalization, assertion evaluators, timeout/error classification, partial output, unknown cost, known zero cost, timing metadata, unique observation IDs, stable hashes, deterministic generated artifacts, replay metadata, and live-provider boundary enforcement.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

