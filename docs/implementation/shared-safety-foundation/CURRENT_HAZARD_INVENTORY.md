# Current Hazard Inventory

Platform-global reference:

- Static low-clearance bridge data under backend data files.
- Static truck restriction and residential-zone datasets where available.

Organization-private submission:

- New `private_hazard_submissions` records.
- Legacy mobile `/api/routing/manual-hazards/report` submissions are mirrored into private submissions when PostgreSQL is active.

Moderation candidate:

- New `shared_safety_moderation_candidates` records.

Approved shared safety:

- New `shared_safety_records` records.

Rejected or archived:

- Moderation candidates can be rejected.
- Private submissions remain private and auditable after rejection.

Legacy or unknown:

- Existing manual hazards and driver reports are not automatically published.
- Uncertain legacy records require manual review before nomination.

