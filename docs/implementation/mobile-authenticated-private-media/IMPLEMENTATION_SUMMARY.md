# Implementation Summary

## Changes

Added `AuthenticatedMediaImage` to classify and render private TSR media using the existing authenticated driver session headers.

Added a reusable mobile media-selection helper that supports:

- `Take Photo`;
- `Choose From Library`;
- cancellation without crashing;
- camera permission handling;
- media-library permission handling;
- normalized URI, file name, MIME type, width, and height metadata for both camera and library assets.

Updated private delivery-note photo renderers:

- existing photo drafts in Delivery Notes;
- saved delivery-note thumbnails;
- delivery-note preview modal;
- Account Knowledge panel photos;
- Home screen driver-uploaded photo gallery tiles;
- Home screen driver-uploaded photo detail view.

Left public/local media unchanged:

- local selected delivery-note photo previews;
- local hazard report photo previews;
- Google Places destination photos;
- recent destination photos;
- Street View WebView;
- receipt/signature print payloads.

## Photo-Capture Workflow

Delivery Notes now presents a source choice when the driver taps the photo attachment action:

- Take Photo
- Choose From Library
- Cancel

Hazard reporting already exposed separate camera and library actions. Those actions now use the same reusable media-selection helper and continue feeding the existing hazard submission payload.

Camera-captured delivery-note photos are persisted through the same tenant-scoped local delivery-photo store used by library-selected photos, then uploaded through the existing delivery-note private-media workflow. No separate public or unauthenticated camera upload path was introduced.

## Camera-Return Continuity

The Android native camera can background or recreate TSR while a driver is taking a photo. The implementation now preserves that workflow by:

- recording camera workflow intent before opening the native camera;
- recovering Expo Image Picker pending results after app resume/recreation;
- storing tenant-scoped photo drafts without auth tokens;
- restoring the original Delivery Notes or Hazard Report workflow after session and route restoration;
- clearing drafts only on save/upload, explicit remove/reset, canceled pending result, failure, mismatch, or expiration.

## R2 Public Access

Public R2 access remains enabled. This implementation removes the mobile source-level blocker but does not by itself authorize shutdown.

## APK Status

The preview APK previously built from commit `24485ea1bf9364e6f39a328bd012bad4ac9e9261` is superseded by the camera-capture workflow changes.

The preview APK built as `344d34ae-b083-4171-ab1a-32de556517e9` is superseded by the camera-return/session-draft fix.

Replacement preview APK `4435a491-f270-4a54-8352-3b653750af73` was built from the camera-return fix commit.

Final physical media validation requires installing and testing that replacement APK.
