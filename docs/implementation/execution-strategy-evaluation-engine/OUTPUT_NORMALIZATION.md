# Output Normalization

Normalization preserves canonical facts. Objects are cloned and stable-hashed. Text is retained as raw text. JSON-looking strings are parsed when valid and marked malformed when parsing fails.

Normalization does not add facts, remove facts, or repair malformed structured output.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

