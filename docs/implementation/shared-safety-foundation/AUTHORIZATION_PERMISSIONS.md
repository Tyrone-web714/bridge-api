# Authorization Permissions

Added stable permissions:

- `hazard.submit`
- `hazard.view.organization`
- `hazard.review.organization`
- `shared_safety.review`
- `shared_safety.approve`
- `shared_safety.reject`
- `shared_safety.publish`
- `shared_safety.retire`

Role behavior:

- Driver: submit hazards.
- Supervisor: view and nominate Organization-private hazards when permitted.
- Organization Admin: manage Organization-private hazard workflow, but cannot publish globally.
- Platform Admin: review, sanitize, approve, reject, publish, duplicate, and retire shared safety records.
- Warehouse Employee: no Shared Safety moderation access by default.

