# Database Migration

Migration:

- `bridge-api/migrations/005_shared_safety_foundation.sql`

Changes:

- Adds Shared Safety role permission seeds.
- Adds Organization-private hazard submissions.
- Adds moderation candidates.
- Adds approved shared safety records.
- Adds publication-source linkage for restricted auditability.
- Adds indexes for status, type, Organization ownership, and coordinate filtering.

Production note:

- Do not apply this migration to production until the branch passes validation and deployment approval is granted.

