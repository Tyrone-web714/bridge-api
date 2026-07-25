# Execution Strategy Adapter Contract

Evaluation candidates use repository execution strategy constants from `constants.js`. Mock executor metadata declares supported capabilities, supported strategies, mock-only status, offline capability, and live-provider-call prohibition.

This phase does not introduce provider-specific adapters or live hosted execution adapters.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

