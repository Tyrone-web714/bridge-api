# Evaluation Request Contract

Requests use schema `execution.evaluation.request.v1`. Required fields include run identity, repository commit, engine version, environment, capability ID, dataset ID/version, deterministic seed, offline controls, and explicit candidates.

Valid initial requests set `offlineOnly=true`, `allowHostedExecution=false`, `allowPremiumExecution=false`, `productionDataUsed=false`, and `testOnly=true`. Hosted strategies may appear only as mock-authorized candidates and still do not call hosted providers.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

