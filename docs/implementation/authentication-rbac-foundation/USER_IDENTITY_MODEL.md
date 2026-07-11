# User Identity Model

Admin users now support:

- `internal_user_id`
- `organization_id`
- legacy `role`
- approved `approved_role`
- account status through `active` and `disabled_at`
- `session_version`
- `last_login_at`

Driver identity continues to accept the mobile-facing company driver number while resolving to:

- Organization ID
- permanent internal driver ID
- company driver number
- approved DRIVER role

Warehouse identity uses:

- Organization ID
- company employee ID / employee ID
- PIN hash
- approved WAREHOUSE_EMPLOYEE role

Clients must not choose arbitrary Organization IDs for private data access.
