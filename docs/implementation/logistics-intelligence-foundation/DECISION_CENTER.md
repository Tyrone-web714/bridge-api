# Decision Center

The decision center is the supervisor/admin workflow for reviewing recommendations.

Supported decisions are `accepted`, `rejected`, `deferred`, and `marked_reviewed`.

Decisions are stored in `logistics_decisions` and include the deciding actor, reason, timestamp, and audit metadata. Decisions update recommendation status but do not automatically mutate route, delivery, warehouse, or customer records.
