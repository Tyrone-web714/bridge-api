# Evaluation Template Guide

Templates under `bridge-api/evaluations/templates` provide conservative defaults for evaluation requests, mock executor results, and replay requests. Defaults are offline-only, dry-run, no hosted execution, no premium execution, no production data, no implied approval, and no lifecycle mutation.

## Guardrails

- Repository fixtures only; no production data.
- Offline/mock execution only; no live hosted provider call.
- No weighted scores, thresholds, winners, provider rankings, cost-effectiveness claims, production recommendations, or runtime routing changes.
- No database persistence, migrations, deployments, or public API surface.

