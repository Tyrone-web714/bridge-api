# In-App Camera Note Composer Rebuild

Date: 2026-07-19

Branch: `in-app-camera-note-composer-rebuild`

## Reason

Physical Android validation showed that incremental fixes to the existing Delivery Notes camera path did not resolve the production-pilot blocker. The old primary path used `ImagePicker.launchCameraAsync()`, which hands control to the Android camera activity and depends on session/draft recovery after TSR resumes. That path still produced camera-photo persistence and navigation-context failures on device.

The replacement design removes that primary external-camera dependency from Delivery Notes.

## New Architecture

Delivery Notes now uses a dedicated in-app camera screen:

- `apps/mobile/src/app/screens/TsrCameraScreen.js`
- registered as `TsrCamera` in `RootNavigator`
- uses `expo-camera` `CameraView`
- captures through `takePictureAsync()`
- previews the photo in TSR
- supports `Use Photo`, `Retake`, and `Cancel`
- writes the accepted camera photo into a durable note composer draft before returning

Delivery Notes no longer launches the external Android camera activity for its primary Take Photo flow.

## Durable Note Composer

The new draft store is:

- `apps/mobile/src/app/services/noteComposerStore.js`

It persists:

- `noteDraftId`
- `localPhotoId`
- Organization ID
- internal driver ID
- company driver number
- account/place/route-stop context
- note text fields
- camera and gallery photos
- app-controlled stable local photo URI
- local upload state (`PENDING`, `UPLOADING`, `FAILED`)
- safe media diagnostics

It does not persist:

- auth tokens
- R2 credentials
- public R2 URLs
- signed URLs

## Gallery Preservation

The gallery path remains supported through `choosePhotoLibraryAssets()`, but selected gallery photos now attach through the same durable note composer path used by camera photos.

Camera and gallery photos become the same kind of note-draft photo object after local capture/selection. Each photo receives its own `localPhotoId` and `clientPhotoId`, so four photos remain four distinct draft items.

Explicit draft cleanup deletes only TSR-controlled local draft photo files. Draft files are not deleted because the screen remounts, the app backgrounds, or the driver opens the camera.

## Navigation Rules

The rebuilt Delivery Notes camera flow must not:

- navigate to Home after camera capture
- navigate to Driver Login after camera capture
- reset the root navigator after camera capture
- lose the current route/stop/account context

The old root-level Delivery Notes pending-camera recovery path has been removed from the primary Delivery Notes workflow. Root-level recovery remains only for workflows that still use the older external camera flow, such as Hazard Report.

## Validation Status

Source-level validation passed:

```powershell
npm.cmd run test:mobile-private-media
npm.cmd run test:driver-route-notes-photo
git diff --check
```

`git diff --check` reported only existing line-ending warnings for touched files and no whitespace errors.

## Preview APK

- EAS build ID: `f1091f8d-240f-4aef-b8d6-e059fca025c1`
- Build profile: `preview`
- Build type: Android APK
- Source commit: `fbd013f809111172b0e90dc1b32434da1ac126a4`
- Install page: `https://expo.dev/accounts/lamont76/projects/truck-safe-routing/builds/f1091f8d-240f-4aef-b8d6-e059fca025c1`

## Physical Validation

Status: PASSED.

Accepted owner-reported physical results:

- TSR in-app camera opens correctly.
- Camera capture succeeds.
- `Use Photo` returns directly to Delivery Notes.
- No Home redirect occurs.
- No Driver Login redirect occurs.
- Driver session remains intact.
- Route/account context remains intact.
- Camera photos save correctly.
- Repeated camera captures work.
- Four-photo workflow works.
- Saved camera photos remain after leaving and returning.
- Account Knowledge reflects saved notes/photos correctly.
- Gallery-selected photo regression passed.
- Text-note persistence passed.
- Durable draft behavior passed.
- Cold restart/session restoration passed.

## Legacy Camera Classification

Remaining `launchCameraAsync()` and `ImagePicker.getPendingResultAsync()` usage is intentionally retained in `mobileMediaSelection.js` for workflows that still use the older external-camera path, including Hazard Report. That retained code is classified as `ACTIVE LEGITIMATE USE` for Hazard Report and `BACKWARD COMPATIBILITY` for old pending-result recovery. It is not active in the primary Delivery Notes Take Photo workflow.
