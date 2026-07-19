# Driver Route Notes and Photo Root-Cause Audit

Status: FORENSIC ROOT-CAUSE REPAIR COMPLETE AT SOURCE LEVEL; BACKEND DEPLOY AND NEW PREVIEW APK REQUIRED.

Scope: driver route notes and photo workflow only. This audit does not authorize public R2 shutdown, production data changes, production media writes, or branch merge.

## Confirmed Physical Failures

1. Camera-captured delivery-note photos did not upload while library-selected photos could upload.
2. Returning from the native Android camera could show the Driver Login workflow and require the driver to reselect the route.
3. Saved notes/photos did not reliably reappear in the selected route stop's Notes section.
4. Physical testing later confirmed that a four-photo stop/account delivery note could appear as only three photos afterward.
5. Physical testing later confirmed nondeterministic post-camera return state: sometimes Driver Login, sometimes Routes Page.
6. Physical testing later confirmed Driver Copilot returned "Authentication required" even though the driver was logged in and could access the assigned route.
7. Physical testing after commit `a1655a8` confirmed photos were not being saved at all, camera return still reached Home/Driver Login, and Driver Copilot still returned "Authentication required".

## Root Cause A - Camera Upload Failure

First divergence point: mobile local media preparation before the `/api/delivery-notes` save request.

Library-selected assets and camera assets were normalized into a similar JavaScript shape, but the app did not prove that the actual local file used for upload remained readable immediately before save. If a camera URI became stale or unreadable after the Android camera handoff, `prepareDeliveryPhotoForUpload()` threw a generic non-HTTP error. `saveAccountDeliveryNote()` treated generic non-HTTP errors as offline/network failures, queued the operation, and returned a success-style queued response.

That meant an unreadable camera photo could be presented to the driver as saved offline even though the authoritative upload path had not succeeded and the queued operation could not later upload the missing local file.

Repair:

- Camera and library assets are copied into TSR-controlled tenant-scoped app storage.
- The TSR-owned copy is checked for existence and non-zero size before upload.
- Local media failures are classified with `LOCAL_MEDIA_UNREADABLE`.
- Delivery-note saves no longer convert unreadable local media into offline success.
- Safe diagnostics preserve source type, URI scheme, file name, and file size without exposing media contents, tokens, object keys, or private URLs.

## Root Cause B - Return-To-Login Behavior

First divergence point: Android camera activity return through app/root restoration.

The session was not intentionally deleted. The app can be backgrounded or recreated while the native Android camera is open. On recreation, navigation starts through Landing/Home. Home restored SecureStore-backed driver session asynchronously, then restored the assigned route and only afterward navigated to a pending camera draft when one existed.

The Home render logic only showed a loading panel while `driverStartupState` was `restoring`. Once a session was valid but route state was not yet recovered, `confirmedDriver` could be `null`, causing the Driver Login controls to render even though the driver session was authenticated. This made a valid session look like logout.

Repair:

- Home now separates unauthenticated login from authenticated-without-route state.
- Driver Login controls are not rendered while a valid driver session is restored.
- Pending camera drafts are still restored after session restoration and route-state lookup.
- No fake authenticated state or second login system was introduced.

## Root Cause C - Missing Saved Notes/Photos On Route

First divergence point: save/read identity mismatch for route-stop notes.

The route screens passed stop metadata such as `routeStopId`, route date, and route manifest details into `DeliveryNotes`, but the delivery note screen did not use those identifiers for save or retrieval. The backend persisted organization and account/destination fields but did not hydrate route/stop/internal-driver metadata back into the delivery-note response. Local note cache keys also prioritized account/place/destination rather than route stop identity.

As a result, a note created in a route-stop workflow could be saved under a generic account/destination identity and then missed by the route stop Notes view or preview panel after navigation, restart, or cache refresh.

Repair:

- Delivery-note save and fetch payloads now include optional `routeManifestId`, `routeStopId`, `routeDate`, and `routeNumber`.
- Route-stop identity is prioritized in the mobile delivery-notes cache key.
- Backend delivery-note normalization now preserves and returns route/stop metadata from the existing raw JSON metadata.
- Backend filtering treats a matching route stop as primary and avoids returning other stop-scoped notes for a mismatched stop, while preserving account/place/destination fallback for account-level notes.
- Authenticated driver metadata now includes internal driver ID, company driver number, and organization ID in the note metadata.

## Shared Cause

The failures were related but not identical.

- Camera upload failure was local media durability plus error-classification masking.
- Return-to-login was authenticated session restoration UI state after Android activity recreation.
- Missing notes/photos was save/read scope mismatch between route-stop workflows and generic account-note lookup.
- Four-photo to three-photo display was primarily a UI preview truncation defect in the stop/account knowledge panel. The authoritative delivery-note screen and backend support four photos, but the route/account preview flattened saved note photos and rendered only the first three. That made a successfully saved four-photo note look like a three-photo note in the route context.
- The remaining nondeterministic return state came from split ownership of photo-workflow recovery. Home handled some pending camera draft restoration, but root navigation did not own a single authoritative resume path. Depending on Android activity recreation and navigation stack state, the app could land on Login, Routes, or Notes.
- Driver Copilot authentication failed because `/api/ai` requests were tenant-enforced before driver Bearer authentication was hydrated. The generic `/api/ai` endpoint classification also required broad dashboard permission, which drivers intentionally do not have.

They intersected because Android camera return can recreate the app, which loses in-memory route/photo state unless both draft storage and route-stop identity are durable.

## Root Cause D - Four Photos Appearing As Three

First divergence point: stop/account route preview rendering.

`AccountKnowledgePanel` flattened note photos and applied `.slice(0, 3)`. This panel is shown from route/map/customer context, so a note containing four persisted photos could still display only three in the place where the driver checked the stop/account note.

Additional loss-prevention gaps were also corrected:

- stale local draft restore failures are now surfaced to the driver instead of silently reducing the restored set;
- the backend no longer silently truncates new submitted photos when the note would exceed the configured note-photo limit;
- the mobile save path verifies that the server response returns the same number of photos that the driver submitted plus intentionally kept existing photos.

Result: a four-photo save must end as either four server-confirmed photos or an explicit save/restore failure. Silent three-of-four success is not accepted.

## Root Cause E - Nondeterministic Login/Routes/Notes Return

First divergence point: root navigation after Android foreground/recreation.

Photo workflow recovery was split between screen-level restoration and Home route/session restoration. If Android recreated the app while the native camera was active, the initial navigator stack could be Landing/Home/Routes before the pending photo workflow was restored. Home used ordinary navigation to resume a draft, which left previous route history in place and made the return state depend on timing and current stack.

Repair:

- `RootNavigator` now listens for app foreground and navigation readiness, recovers the pending camera draft, and resets the stack to one authoritative path: `Home -> DeliveryNotes` or `Home -> HazardReport`.
- `HomeScreen` uses the same reset-based path when it discovers a pending photo draft after driver-session restoration.
- No arbitrary delay, fake driver state, second login, or route reassignment behavior was added.

Expected result: while a valid driver session exists, camera/photo resume returns to the same workflow context instead of randomly choosing Driver Login or Routes.

## Root Cause F - Driver Copilot Authentication Required

First divergence point: backend middleware order and endpoint permission classification.

The mobile Driver Copilot request already used the canonical authenticated driver JSON headers. Working mobile routes such as assigned-route and private-media requests were hydrated as driver Bearer requests before tenant enforcement. Driver Copilot differed on the backend:

- `/api/ai` was not registered for driver Bearer hydration before global `/api` tenant enforcement;
- `/api/ai/driver-copilot` was classified under the generic `/api/ai` dashboard permission;
- the Driver role intentionally does not have `dashboard.view`;
- the route lookup did not pass the authenticated tenant context into `getAssignedDailyRouteForDriver`.

Repair:

- `/api/ai` now hydrates an existing driver Bearer token before admin/session auth context and tenant enforcement.
- Driver Copilot has a narrow permission: `ai.driver_copilot.use`.
- Driver, Supervisor, and Organization Admin receive that narrow permission; drivers did not receive broad dashboard access.
- `/api/ai/driver-copilot` is classified before the generic `/api/ai` dashboard rule.
- Driver Copilot route lookup now passes `tenantContext: req.authContext`.

This keeps Copilot private, tenant-scoped, and tied to the existing driver session.

## Root Cause G - Common Mobile Session/Context Architecture Defect

First divergence point: app/activity restoration after Android camera handoff.

The mobile app had one persistent session record in SecureStore, but the active runtime source used by protected requests and tenant-scoped storage was a module-level `activeSession` variable in `driverSession.js`. That in-memory value is restored only when `initializeDriverSession()` runs. Several critical paths read it synchronously:

- `jsonApiHeaders()` adds `Authorization` only from `getDriverSessionHeaders()`;
- `deliveryPhotoStore.persistDeliveryPhoto()` requires `getDriverTenantContext()`;
- delivery-note offline/cache storage requires `getDriverTenantContext()`;
- `AuthenticatedMediaImage` adds private-media headers only from `getDriverSessionHeaders()`;
- Driver Copilot uses the same `jsonApiHeaders()` path.

Android camera/background return can recreate or foreground the app before Home finishes restoring the session. Root navigation also tried to recover pending photo workflows without first proving the canonical driver session had been restored. When `activeSession` was temporarily null while the SecureStore session still existed, the app could:

- fail tenant-scoped local photo persistence;
- fail pending camera draft recovery;
- send protected API calls without Bearer auth;
- render Home/Login before the route/notes workflow was rebuilt.

This explains why photo save, Home-to-Driver-Login, and Copilot authentication failures can appear together even though their UI surfaces differ.

Repair:

- `RootNavigator` now bootstraps the canonical driver session before rendering navigation workflows.
- App foreground recovery now runs `initializeDriverSession()` before attempting pending camera/photo workflow recovery.
- The UI remains in a neutral restoring state instead of showing Driver Login while the persisted session is being restored.
- This does not create a second authentication system and does not trust client-supplied Organization IDs.

## Root Cause H - Photo Save Reported Success Without Authoritative Persistence

First divergence point: delivery-note save cleanup after a non-authoritative result.

Photo saves used the same offline queue path as text notes for generic network failures. That is acceptable for text-only notes, but unsafe for captured photos because the driver must see whether the actual media was saved. The screen also cleared local selected photos/drafts immediately after `saveAccountDeliveryNote()` returned, before the authoritative `loadNotes()` refresh had proved the backend saved and returned the note/media.

Repair:

- delivery-note saves with new photos no longer fall back to queued/offline success on upload/network failure;
- captured photos remain in selected state and draft storage when authoritative upload fails;
- local photo files are deleted only after backend success and photo-count confirmation;
- the screen now refreshes authoritative notes before reporting non-queued save success and clearing the draft;
- per-photo `clientPhotoId` is preserved into the upload payload.

Text-only notes may still use the existing offline queue behavior. Photo notes require authoritative save success before the app reports success.

## Deployment Finding - Copilot Physical Test

The mobile APK calls the deployed Render backend. The source-level Copilot fix exists on branch `mobile-authenticated-private-media`, but physical Copilot validation will continue to return "Authentication required" if Render is still running backend code that does not hydrate driver Bearer auth for `/api/ai` and does not classify `/api/ai/driver-copilot` with the narrow Driver permission.

Read-only `/health` and `/ready` checks on Render passed during this audit, but those endpoints do not expose the deployed commit. Therefore physical Copilot acceptance requires both:

- deploying the backend commit that contains the Copilot auth/RBAC fix; and
- installing a mobile APK built from the mobile session/photo repair commit.

## Persistence Model Verified

Authoritative table: `delivery_notes`.

Primary private media path: authenticated TSR media access under `/api/media/:mediaId` for Organization-private S3/R2 media.

Ownership:

- `organization_id` remains the tenant boundary.
- driver-facing metadata records both company driver number and internal driver ID when available.
- route-stop notes use optional manifest/run/stop metadata without replacing existing account-level note behavior.

No duplicate records are created solely to force UI visibility.

## Files Changed

- `apps/mobile/src/app/services/deliveryPhotoStore.js`
- `apps/mobile/src/app/services/deliveryNotesApi.js`
- `apps/mobile/src/app/services/deliveryOfflineStore.js`
- `apps/mobile/src/app/services/photoDraftStore.js`
- `apps/mobile/src/app/services/mobileMediaSelection.js`
- `apps/mobile/src/app/screens/DeliveryNotesScreen.js`
- `apps/mobile/src/app/screens/HazardReportScreen.js`
- `apps/mobile/src/app/screens/HomeScreen.js`
- `apps/mobile/src/app/navigation/RootNavigator.js`
- `apps/mobile/src/app/screens/MapScreen.js`
- `apps/mobile/src/app/screens/DeliverySettlementScreen.js`
- `apps/mobile/src/app/screens/TodayRouteScreen.js`
- `apps/mobile/src/app/components/AccountKnowledgePanel.js`
- `apps/mobile/scripts/check-mobile-private-media.cjs`
- `bridge-api/services/driverAuth.js`
- `bridge-api/services/rbac.js`
- `bridge-api/middleware/authorization.js`
- `bridge-api/server.js`
- `bridge-api/routes/ai.js`
- `bridge-api/routes/deliveryNotes.js`
- `bridge-api/db/repositories.js`
- `bridge-api/scripts/check-private-media-hardening.cjs`
- `bridge-api/scripts/check-driver-route-notes-photo-workflow.cjs`
- `bridge-api/scripts/check-driver-copilot-auth.cjs`
- `bridge-api/package.json`

## Physical Acceptance Status

Source repair is complete. Physical acceptance is still open and must be performed with a new non-production Android preview APK.

Required physical tests remain:

- camera photo save/reopen route notes;
- restart persistence;
- library photo regression;
- text-only note persistence;
- four-photo camera and library note persistence;
- repeated camera return to same stop/account note context;
- Driver Copilot question using the existing logged-in driver session.

Backend deployment prerequisite:

- deploy the backend repair containing `/api/ai` driver Bearer hydration and `ai.driver_copilot.use` permission before retesting Driver Copilot on the phone.
