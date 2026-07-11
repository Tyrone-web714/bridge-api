# Final Device Validation Report

## Status

Validation identified and fixed one mobile cold-restart defect in the Mobile Tenant Context phase.

## Cold-Restart Defect

The installed preview APK launched successfully and rendered:

- Google basemap
- Route line
- Truck marker
- Assigned route before restart

After a force-stop and relaunch, the app returned to the driver login panel instead of restoring the valid driver session and assigned-route workflow.

## Root Cause

`HomeScreen` called `initializeDriverSession()` during startup but ignored the returned valid session. Because the restored session was not used to rebuild `confirmedDriver`, the app rendered the default unauthenticated driver-login controls after a cold restart.

The tenant-scoped assigned-route cache already existed, but startup did not use it to rebuild route confirmation state.

## Files Changed

- `apps/mobile/src/app/screens/HomeScreen.js`
- `apps/mobile/src/app/services/routeManifestOfflineStore.js`
- `bridge-api/scripts/check-mobile-tenant-context.cjs`
- `docs/implementation/mobile-tenant-context/FINAL_DEVICE_VALIDATION_REPORT.md`

## Fix Behavior

On startup, `HomeScreen` now:

1. Enters an explicit `restoring` state.
2. Waits for `initializeDriverSession()` before rendering driver-login fields.
3. Restores trusted driver identity from the persisted session.
4. Reads only tenant-scoped assigned-route cache for that Organization and internal driver.
5. Rebuilds confirmed route state when a valid cached or backend-loaded route exists.
6. Keeps the driver authenticated when the session is valid but no cached route is available.
7. Shows driver login only when the session is missing, expired, malformed, or invalid.

## Tenant Safeguards

Assigned-route cache reads now verify cached metadata against the authenticated session:

- `organizationId`
- `internalDriverId`
- `companyDriverNumber`

Mismatched cached route records are ignored and quarantined when possible. If quarantine writing fails, the app still fails closed and does not expose the mismatched route.

## Test Results

Passed command validation:

- `npm.cmd run test:mobile-tenant`
- `npm.cmd run verify:secrets`
- `npm.cmd run verify:production` with validation environment values
- `npx.cmd expo config --type public` with validation environment values
- `node --check apps/mobile/src/app/screens/HomeScreen.js`
- `node --check apps/mobile/src/app/services/routeManifestOfflineStore.js`
- `node --check bridge-api/scripts/check-mobile-tenant-context.cjs`
- `git diff --check`

Note: Expo config validation requires environment values because the consolidated mobile source folder does not store the Android Maps key in `apps/mobile/.env`.

## Device Validation Required

A new non-production Android preview APK is required to physically validate this fix on device.

Required device test:

1. Install the new preview APK.
2. Sign in with a valid driver ID and PIN.
3. Load today's assigned route.
4. Open the active route/navigation flow.
5. Force-stop the app.
6. Relaunch the app.
7. Confirm the app does not show the driver login panel during restoration.
8. Confirm the valid session is restored.
9. Confirm today's assigned route is restored or checked without requiring driver re-login.
10. Confirm map, route line, truck marker, and route controls still render.
