# User Lifecycle

Implemented user lifecycle states are `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `DELETION_REQUESTED`, `SOFT_DELETED`, `ANONYMIZED`, and `PURGED`.

`drivers`, `admin_users`, and `warehouse_employees` now retain lifecycle metadata while preserving existing `active` behavior for compatibility. Deactivation sets `active=false`, sets `lifecycle_status='DEACTIVATED'`, records actor/timestamp metadata, and revokes active sessions.

Driver, warehouse, and admin session validation rejects inactive lifecycle states and inactive Organization lifecycle state.
