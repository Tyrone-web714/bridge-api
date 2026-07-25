# ROLLBACK PLAN

Rollback is source-only: remove scoring engine source, profiles, requests, templates, generated artifacts, scripts, tests, docs, and package/status integration, then rerun independent test suites.

## Boundaries

- Test-only repository artifacts.
- No production scoring policy, provider ranking, model ranking, production recommendation, cost-effectiveness, TCO, or ROI.
- No live providers, production data, database persistence, migrations, deployments, public API, or runtime routing changes.
