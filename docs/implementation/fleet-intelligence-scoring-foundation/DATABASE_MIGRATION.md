# Database Migration

Migration: `bridge-api/migrations/008_fleet_intelligence_scoring_foundation.sql`

Migration type: additive.

Objects created:

- FISS permissions in `role_permissions`.
- `fleet_score_models`
- `fleet_score_model_versions`
- `fleet_score_snapshots`
- `fleet_score_component_snapshots`
- `fleet_score_benchmark_sets`
- Immutability triggers for active model versions and score snapshots.
- Tenant, subject, run-key, and lineage indexes.

Production migration status: not applied during this phase.
