# Logistics Event Model

Canonical events are stored in `logistics_events`.

Required properties are `organization_id`, `event_type`, `event_category`, `source_type`, `subject_type`, `subject_id`, `occurred_at`, `payload`, and `schema_version`.

Optional properties include `source_id`, `route_id`, `driver_id`, `correlation_id`, and `idempotency_key`.

Idempotency is enforced by the unique index on `organization_id + idempotency_key` when a key is supplied. The model is additive and does not alter existing operational tables.
