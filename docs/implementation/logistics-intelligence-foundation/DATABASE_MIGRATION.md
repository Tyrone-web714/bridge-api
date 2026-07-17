# Database Migration

Migration: `bridge-api/migrations/007_logistics_intelligence_foundation.sql`

Migration type: additive.

Objects created:

- Logistics Intelligence permissions in `role_permissions`.
- `logistics_events`
- `logistics_signals`
- `logistics_findings`
- `logistics_recommendations`
- `logistics_decisions`
- `logistics_outcomes`
- Tenant, status, subject, run-key, and JSONB indexes.

Production migration status: not applied during this phase.
