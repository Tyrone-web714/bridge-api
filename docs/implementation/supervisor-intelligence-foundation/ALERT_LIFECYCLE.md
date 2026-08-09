# Alert Lifecycle

The foundation supports deterministic alert lifecycle transitions for acknowledgement, resolution, and invalidation by new evidence.

Lifecycle states are repository-only records. This package does not persist lifecycle changes to production and does not send notifications.

Existing persisted supervisor-alert runtime behavior remains unchanged.
