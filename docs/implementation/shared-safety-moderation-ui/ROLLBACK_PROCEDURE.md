# Rollback Procedure

Application rollback:

1. Stop deployment of this branch.
2. Redeploy the last validated `main` release before the moderation UI.
3. Verify `/health` and `/ready`.

Database rollback:

No new migration is introduced in this UI phase.

If rolling back after moderation actions were performed, keep the database records. They remain compatible with the Shared Safety Foundation schema.

