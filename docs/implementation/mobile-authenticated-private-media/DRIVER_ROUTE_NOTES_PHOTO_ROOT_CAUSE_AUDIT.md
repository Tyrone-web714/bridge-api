# Driver Route Notes and Photo Root-Cause Audit

Status: REPAIRED AT SOURCE LEVEL; NEW PREVIEW APK AND PHYSICAL VALIDATION REQUIRED.

Scope: driver route notes and photo workflow only. This audit does not authorize public R2 shutdown, production data changes, production media writes, or branch merge.

## Confirmed Physical Failures

1. Camera-captured delivery-note photos did not upload while library-selected photos could upload.
2. Returning from the native Android camera could show the Driver Login workflow and require the driver to reselect the route.
3. Saved notes/photos did not reliably reappear in the selected route stop's Notes section.

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

The three failures were related but not identical.

- Camera upload failure was local media durability plus error-classification masking.
- Return-to-login was authenticated session restoration UI state after Android activity recreation.
- Missing notes/photos was save/read scope mismatch between route-stop workflows and generic account-note lookup.

They intersected because Android camera return can recreate the app, which loses in-memory route/photo state unless both draft storage and route-stop identity are durable.

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
- `apps/mobile/src/app/screens/DeliveryNotesScreen.js`
- `apps/mobile/src/app/screens/HazardReportScreen.js`
- `apps/mobile/src/app/screens/HomeScreen.js`
- `apps/mobile/src/app/screens/MapScreen.js`
- `apps/mobile/src/app/screens/DeliverySettlementScreen.js`
- `apps/mobile/src/app/screens/TodayRouteScreen.js`
- `apps/mobile/src/app/components/AccountKnowledgePanel.js`
- `apps/mobile/scripts/check-mobile-private-media.cjs`
- `bridge-api/services/driverAuth.js`
- `bridge-api/routes/deliveryNotes.js`
- `bridge-api/db/repositories.js`
- `bridge-api/scripts/check-private-media-hardening.cjs`

## Physical Acceptance Status

Source repair is complete. Physical acceptance is still open and must be performed with a new non-production Android preview APK.

Required physical tests remain:

- camera photo save/reopen route notes;
- restart persistence;
- library photo regression;
- text-only note persistence.
