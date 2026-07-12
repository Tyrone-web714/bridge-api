# Data Model

The data model separates three concerns:

1. Organization-private source evidence.
2. Platform Admin moderation state.
3. Platform-global approved safety facts.

Tables:

- `private_hazard_submissions`
- `shared_safety_moderation_candidates`
- `shared_safety_records`
- `shared_safety_publication_sources`

Private source evidence keeps Organization ownership. Shared records intentionally do not expose customer, driver, route, manifest, receipt, KPI, delivery, or private note data.

