# Credentialed Media Walkthrough

## Status

OWNER WALKTHROUGH REQUIRED.

Codex did not use production credentials, create production users, expose tokens, or retrieve production media contents during this phase.

## Supervisor/Admin Manual Steps

1. Open the production admin dashboard.
2. Sign in using an approved existing supervisor/admin account.
3. Open Delivery Notes.
4. Open a delivery note known to contain migrated media.
5. Verify photos render without opening a direct R2 URL manually.
6. Refresh the page.
7. Verify photos still render.
8. Copy no URLs into chat; report only pass/fail and aggregate behavior.
9. Sign out or use an incognito window and attempt to open the same media path if visible from browser dev tools.
10. Confirm unauthenticated access is denied.

## Mobile Driver Evidence

Physical mobile private-media behavior has been validated in prior mobile/in-app camera phases. Before public R2 shutdown, repeat one final device check after the metadata cleanup and writer-remediation branch is deployed:

1. Log in as the approved test driver.
2. Open today’s assigned route.
3. Open a stop/account with delivery-note media.
4. Verify existing photos render.
5. Capture and save a new photo.
6. Verify it appears and persists after app restart.

## Result For This Phase

Authenticated media source and automated guardrails pass, but credentialed production browser verification remains open.
