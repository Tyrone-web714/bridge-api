# Data Classification

- Direct personal identifiers: names, phone numbers, signatures, photos, free-text notes.
- Employment identifiers: company driver number, employee number, warehouse employee ID.
- Authentication data: session tokens, token hashes, PIN/password hashes, reset/invite artifacts where present.
- Operational historical data: manifests, stops, settlements, receipts, warehouse confirmations, route replay.
- Safety data: private hazards, moderation candidates, approved Shared Safety records.
- Audit data: `audit_events` and `lifecycle_events`.
- Financial/KPI/analytical data: BI/KPI, Logistics Intelligence, FISS snapshots.
- User-generated content: notes, photos, hazard descriptions, review notes.
- Platform-global Shared Safety intelligence: approved and sanitized safety facts.
- Temporary/transient data: expired sessions, expired generated documents, caches and processing jobs.
- Identity/federation-ready records: lifecycle tables are prepared for future ODR-020 events, but ODR-020 is not implemented here.
