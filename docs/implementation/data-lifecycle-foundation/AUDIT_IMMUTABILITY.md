# Audit Immutability

Migration `009` installs `audit_events_lifecycle_immutable_trg`, which blocks ordinary deletion of audit events unless an explicit database session override is set by an approved recovery process.

Lifecycle operations record `lifecycle_events` and Organization termination records `organization_lifecycle_events`.
