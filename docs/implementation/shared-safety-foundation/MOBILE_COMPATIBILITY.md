# Mobile Compatibility

The existing mobile hazard submission endpoint remains compatible:

- `/api/routing/manual-hazards/report`
- Same pending manual hazard response message.
- Same static verification flow.
- New PostgreSQL-backed private Shared Safety submission mirror when the database is active.

Mobile clients do not receive moderation controls and cannot publish shared records.

