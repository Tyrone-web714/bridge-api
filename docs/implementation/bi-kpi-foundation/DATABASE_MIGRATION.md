# Database Migration

Migration file:

- `bridge-api/migrations/006_bi_kpi_foundation.sql`

Migration type:

- additive

Validation:

- Applied successfully after migrations `001` through `005` on isolated local PostgreSQL/PostGIS.
- PostGIS initialization completed in the validation database.
- No production data was modified.
- Migration was not applied to production.

Rollback posture:

- Application rollback can remove usage of the new routes/service.
- Database rollback should be handled through the approved backup/restore process if production migration is later approved.
