# Shared Safety Foundation

The platform shares knowledge, not customer operations.

This phase adds the foundation for Organization-private hazard submissions, Platform Admin moderation, explicit sanitization, and approved platform-global Shared Safety records.

Scope:

- Private hazard submissions remain tenant-scoped by `organization_id`.
- Moderation candidates preserve review history and source linkage.
- Shared Safety records expose only approved, sanitized safety facts.
- Platform Admin approval is required before publication.
- Legacy mobile hazard submission remains compatible.

Out of scope:

- AI moderation
- automatic publication
- reputation scoring
- BI/KPI dashboards
- predictive hazard scoring
- billing or subscription logic

Implementation files:

- `bridge-api/migrations/005_shared_safety_foundation.sql`
- `bridge-api/services/sharedSafety.js`
- `bridge-api/routes/sharedSafety.js`
- `bridge-api/scripts/check-shared-safety-foundation.cjs`

