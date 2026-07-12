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

## Device Validation

Device validation was performed after installing a new non-production Android preview APK on `ZY22HJCHCJ`.

APK/build identification:

- Source branch: `mobile-tenant-context`
- Source commit required for validation: `4fb10ae4b03703adb661c685636881ab2154515a`
- Android package: `com.nasih.trucksaferouting`
- Version name: `1.0.0`
- Version code: `1`
- Install/update time on device: `2026-07-11 19:09:10`
- Installer package: `com.google.android.apps.nbu.files`
- EAS build ID / APK URL: not available in this Codex session because the APK was installed manually outside Codex.

Device:

- Device ID: `ZY22HJCHCJ`
- Model: `moto g play - 2023`
- Android version: `13`
- Android SDK: `33`

Install and launch result:

- Package installed successfully.
- Existing application data was preserved.
- App launched successfully.

Cold-restart result:

- Before restart, the app showed an authenticated assigned-route state:
  - `LOGIN CONFIRMED`
  - `Anthony Williams | Route TEST-0711-EAST-10 | 10 stops`
  - `Today's Assigned Route`
- After force-stop and relaunch, the app restored the authenticated assigned-route state:
  - `LOGIN CONFIRMED`
  - `Anthony Williams | Route TEST-0711-EAST-10 | 10 stops`
  - `Today's Assigned Route`
- The assigned-route state was not lost after cold restart.
- The app did not fall back to an unauthenticated route-missing state.

Route restoration result:

- Today's assigned route loaded after restart.
- Route screen opened successfully.
- Route shown: `TEST-0711-EAST-10`
- Driver shown: `Anthony Williams`
- Stop count shown: `10`
- Route progress shown: `0 of 10 stops completed`
- First stop shown: `Eastside Market Test Account`
- Directions preview opened and route steps loaded.

Tenant-context verification:

- Device validation confirmed the restored route remained associated with the restored authenticated driver session at the UI level.
- Source-level validation confirms cached routes are keyed by tenant context and mismatched cache metadata is ignored/quarantined.
- Direct SecureStore inspection of `organizationId` and `internalDriverId` is not exposed through Android UI automation, so device-level tenant context was verified indirectly through restored session and assigned-route behavior.

Regression result:

- Phone network connectivity passed.
- Assigned-route loading passed.
- Directions preview passed.
- Existing route progress remained intact during this validation.
- No stop completion, arrival, no-delivery, signature, printer, or closeout action was executed.
- Full active navigation map was not opened in this validation because the available safe `DIRECTIONS` action opens directions preview, while the full active navigation path can update stop status. To avoid modifying backend route data, status-changing controls were not tapped.

Defects found:

- No recurrence of the cold-restart route/session loss defect was observed.
- Remaining controlled edge cases are documented as non-blocking follow-up tests:
  - Invalid or expired session
  - Valid session with no cached route
  - Mismatched tenant/driver route cache
  - Full active navigation map regression
  - Route-progress mutation paths

Final merge recommendation:

- GO for merge.
- The primary cold-restart restoration defect passed physical-device validation.
- Remaining controlled edge cases are documented as non-blocking follow-up tests and do not prevent merging the tenant-context foundation.
