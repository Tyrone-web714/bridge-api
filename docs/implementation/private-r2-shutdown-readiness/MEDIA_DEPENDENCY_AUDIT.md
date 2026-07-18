# Media Dependency Audit

## Scope

This audit inspected backend, dashboard, Shared Safety, and active mobile code for dependencies on `PHOTO_STORAGE_PUBLIC_BASE_URL`, `r2.dev`, direct public URLs, `legacyPublicUrl`, `media.url`, `publicUrl`, storage keys converted directly into URLs, browser/mobile image requests, delivery-note photos, hazard evidence, receipts, signatures, driver-uploaded media, supervisor/admin media, and Shared Safety media.

## Classified Paths

| Path | Files | Classification | Result |
| --- | --- | --- | --- |
| New S3 delivery-note media creation | `bridge-api/services/photoStorage.js`, `bridge-api/routes/deliveryNotes.js` | PRIVATE AUTHENTICATED PATH | Creates S3 object, stores `storageKey`, `mediaClassification`, `accessPath`, authenticated `url`, and `legacyPublicUrl` compatibility metadata. |
| Existing S3 delivery-note media normalization | `bridge-api/services/photoStorage.js`, `bridge-api/routes/deliveryNotes.js` | PRIVATE AUTHENTICATED PATH | Existing S3 photos with IDs normalize to `/api/media/:mediaId`. |
| Authenticated media retrieval | `bridge-api/routes/media.js` | PRIVATE AUTHENTICATED PATH | Requires authentication, Organization context, permission, tenant-scoped delivery-note lookup, S3 provider, and stored object key. Client cannot supply arbitrary object keys. |
| Local development photo route | `bridge-api/routes/deliveryNotes.js` | NOT APPLICABLE | `/api/delivery-notes/photos/:filename` serves local filesystem photos through admin auth; not Cloudflare R2. |
| Supervisor/admin delivery-note photo display | `bridge-api/routes/deliveryNotes.js` | UNKNOWN / REQUIRES MANUAL VERIFICATION | Admin HTML renders `photo.url` in `<img>`. Same-origin `/api/media` should receive the admin cookie because the cookie path is `/api`, but this requires a credentialed browser walkthrough. |
| Mobile delivery-note photo upload | `C:\dev\tsr-mobile\src\app\services\deliveryNotesApi.js`, `C:\dev\tsr-mobile\src\app\services\deliveryPhotoStore.js` | PRIVATE AUTHENTICATED PATH for upload | API calls include driver identity headers; offline queue/cached upload path remains source-controlled. |
| Mobile delivery-note photo display | `C:\dev\tsr-mobile\src\app\screens\DeliveryNotesScreen.js`, `C:\dev\tsr-mobile\src\app\components\AccountKnowledgePanel.js`, `C:\dev\tsr-mobile\src\app\screens\HomeScreen.js` | LEGACY PUBLIC DEPENDENCY / BLOCKED | React Native `Image` consumes `photo.url` without auth headers. Authenticated `/api/media/:mediaId` may not render on mobile after public R2 shutdown. |
| Driver hazard report photo upload | `bridge-api/routes/routing.js`, `bridge-api/services/photoStorage.js`, `C:\dev\tsr-mobile\src\app\screens\HazardReportScreen.js` | PRIVATE AUTHENTICATED PATH for upload | Driver uploads are saved through backend storage abstraction. Display compatibility still requires workflow testing where hazard photos are rendered. |
| Static hazard verification photo display | `bridge-api/routes/routing.js` | UNKNOWN / REQUIRES MANUAL VERIFICATION | Admin HTML renders stored hazard photo URLs; needs credentialed dashboard walkthrough. |
| Shared Safety moderation and publication | `bridge-api/services/sharedSafety.js`, `bridge-api/routes/sharedSafety.js` | SHARED/PUBLIC SAFETY MEDIA | Shared Safety may publish only sanitized media URLs. Private operational references are rejected before publication. A separate public-media architecture may be needed for approved public safety media. |
| Receipts and delivery orders | `bridge-api/routes/routeManifests.js`, `C:\dev\tsr-mobile\src\app\screens\DeliverySettlementScreen.js` | NOT APPLICABLE | Current receipt/signature workflows are document/print payload workflows, not R2 photo URLs. |
| Signatures | `C:\dev\tsr-mobile\src\app\components\SignatureCaptureModal.js`, `C:\dev\tsr-mobile\src\app\services\deliveryDocumentService.js` | NOT APPLICABLE | Signatures are used in delivery document payloads and ZPL print generation, not direct R2 image retrieval. |

## Current Public-URL Dependency Decision

Private Organization media still has an active mobile compatibility dependency on public image loading behavior. Public R2 shutdown is therefore BLOCKED until mobile media retrieval is made compatible with authenticated TSR media access and physically validated.
