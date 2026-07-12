# Rollback Procedure

Application rollback:

1. Stop deployment of the Shared Safety branch.
2. Redeploy the last validated main branch release.
3. Verify `/health` and `/ready`.

Database rollback:

Because migration `005_shared_safety_foundation.sql` is additive, rollback should normally leave tables in place and disable route exposure by deploying the previous application version.

If destructive rollback is explicitly approved in a non-production environment:

1. Export `shared_safety_records`, `shared_safety_moderation_candidates`, `private_hazard_submissions`, and `shared_safety_publication_sources`.
2. Drop `shared_safety_publication_sources`.
3. Drop `shared_safety_records`.
4. Drop `shared_safety_moderation_candidates`.
5. Drop `private_hazard_submissions`.
6. Remove Shared Safety role-permission rows.

Do not perform destructive rollback on production without a separate approved plan.

