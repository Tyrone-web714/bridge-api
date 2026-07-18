# Current Mobile Media Audit

## Discovered Paths

| Path | File | Classification | Result |
| --- | --- | --- | --- |
| Newly selected delivery-note photo preview | `apps/mobile/src/app/screens/DeliveryNotesScreen.js` | LOCAL DEVICE MEDIA | Uses local `photo.uri`; no server auth required before upload. |
| Existing delivery-note photo draft | `apps/mobile/src/app/screens/DeliveryNotesScreen.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Saved delivery-note photo thumbnail | `apps/mobile/src/app/screens/DeliveryNotesScreen.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Delivery-note photo preview modal | `apps/mobile/src/app/screens/DeliveryNotesScreen.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Account knowledge photo strip | `apps/mobile/src/app/components/AccountKnowledgePanel.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Driver-uploaded account photo gallery tile | `apps/mobile/src/app/screens/HomeScreen.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Driver-uploaded account photo detail | `apps/mobile/src/app/screens/HomeScreen.js` | PRIVATE AUTHENTICATED TSR MEDIA | Uses `AuthenticatedMediaImage`. |
| Hazard report selected photo preview | `apps/mobile/src/app/screens/HazardReportScreen.js` | LOCAL DEVICE MEDIA | Uses local `photo.uri`; remote hazard photo display still requires dashboard/manual verification. |
| Google destination preview image | `apps/mobile/src/app/screens/HomeScreen.js` | SHARED/PUBLIC MEDIA | Remains ordinary public/provider image URL. |
| Business candidate photo | `apps/mobile/src/app/screens/HomeScreen.js` | SHARED/PUBLIC MEDIA | Remains ordinary public/provider image URL. |
| Recent destination photo | `apps/mobile/src/app/screens/HomeScreen.js` | SHARED/PUBLIC MEDIA | Remains ordinary public/provider image URL. |
| Street View WebView | `apps/mobile/src/app/screens/HomeScreen.js` | SHARED/PUBLIC MEDIA | Provider WebView path; not TSR private media. |
| Receipts and signatures | `apps/mobile/src/app/screens/DeliverySettlementScreen.js`, `apps/mobile/src/app/components/SignatureCaptureModal.js` | NOT APPLICABLE | Receipt/signature print payloads do not retrieve R2 media. |

## Root Cause

The confirmed blocker was direct React Native image rendering of delivery-note photos through `Image source={{ uri: photo.url }}`. That path did not attach the existing driver bearer session, so private `/api/media/:mediaId` URLs could fail on mobile after public R2 shutdown.
