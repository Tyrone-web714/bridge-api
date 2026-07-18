# Database Migration

Migration: `009_data_lifecycle_foundation.sql`.

Additive changes:

- lifecycle columns on `organizations`, `admin_users`, `drivers`, and `warehouse_employees`
- lifecycle permissions
- retention policies
- legal holds
- deletion requests
- data subject requests
- Organization lifecycle events
- object references
- purge jobs
- tombstones
- data exports
- lifecycle events
- audit event delete guard
- route replay event relationship hardened to `ON DELETE RESTRICT`

No production migration was applied.
