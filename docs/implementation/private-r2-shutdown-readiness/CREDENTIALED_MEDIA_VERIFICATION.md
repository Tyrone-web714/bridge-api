# Credentialed Private Media Verification

Status: BLOCKED BY CREDENTIALS and MOBILE COMPATIBILITY.

## Available Verification

Automated/source-level verification confirms:

- unauthenticated `/api/media/:mediaId` requires authentication;
- media access requires Organization context;
- media access requires an approved permission;
- media lookup is tenant-scoped through `repositories.listDeliveryNotes({ tenantContext: context })`;
- client-supplied arbitrary object keys are not accepted;
- unsafe stored object-key shapes are rejected;
- private media is streamed through the TSR application boundary.

## Not Performed

The following were not performed because approved production media-test credentials and a controlled test media ID were not available in this Codex shell:

- authorized same-Organization retrieval of one migrated media item;
- unauthorized role denial against one migrated media item;
- cross-Organization denial against one migrated media item;
- physical mobile display of a migrated private media item;
- supervisor browser display of a migrated private media item.

No actual production media URL, object key, credential, or media content was retrieved or exposed.

## Manual Verification Steps Required

Use a controlled test account and a known non-sensitive migrated media item. Do not expose the URL, media ID, object key, or image contents in reports.

1. Open a private/incognito browser with no admin session.
2. Request the private TSR media URL.
3. Confirm HTTP 401 or 403.
4. Sign in as an authorized same-Organization supervisor.
5. Open the Delivery Notes dashboard.
6. Confirm the photo loads through the TSR `/api/media/:mediaId` route.
7. Expire or clear the admin session.
8. Refresh the media URL and confirm access is denied.
9. Sign in as an unauthorized role, if available.
10. Confirm media access is denied.
11. Sign in as another Organization, if available.
12. Confirm the media is not visible and direct `/api/media/:mediaId` returns denied/not found.
13. On the physical Android device, sign in as the authorized driver.
14. Open a stop/account with a saved delivery note photo.
15. Confirm thumbnail and detail preview load without public R2 access assumptions.
16. Force-stop and relaunch the app.
17. Confirm cached/offline behavior does not expose stale public URLs.

## Approval Gate

If the next step requires using live production credentials against live production media, request owner approval before executing it.
