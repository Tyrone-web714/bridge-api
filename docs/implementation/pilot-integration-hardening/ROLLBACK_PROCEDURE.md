# Rollback Procedure

This branch was validated without production migration or production data modification.

Application rollback:

1. Do not merge this branch if validation fails.
2. If merged later and a deployment issue occurs, roll back the Render service to the prior known-good deploy.
3. Re-run `/health` and `/ready`.
4. Confirm driver route lookup and admin access.

Database rollback:

1. No production database migration was applied in this phase.
2. Before applying migrations 006-008 in a future release, take a fresh backup.
3. Prefer restore-to-target validation before production cutover.
4. If production migration fails, follow the approved database restore procedure rather than ad hoc destructive changes.

Mobile rollback:

1. Use the previous validated preview APK for device-level regression if needed.
2. Do not clear driver app data unless explicitly testing cold-start or cache reset behavior.

