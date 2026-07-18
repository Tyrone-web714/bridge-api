# Organization Termination

Organization lifecycle states are `ACTIVE`, `SUSPENDED`, `TERMINATION_REQUESTED`, `READ_ONLY_RETENTION`, `PURGE_ELIGIBLE`, and `PURGED`.

The foundation implements termination request and purge preview. Termination request suspends normal Organization status, marks lifecycle status, revokes driver and warehouse sessions, invalidates admin sessions by incrementing session version, and records `organization_lifecycle_events`.

Full purge requires later owner-approved production policy.
