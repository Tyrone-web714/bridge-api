# User Deletion Workflow

User deletion is implemented as an orchestrated request, not a raw delete.

The workflow creates `lifecycle_deletion_requests`, deactivates the subject, revokes sessions, records a 30-day default recovery window, and preserves historical records. Cancellation is allowed during the recovery window. Impact preview reports retained, anonymized, object-storage, legal-hold, and policy-decision effects before any destructive action.
