# Mobile And Dashboard Compatibility

## Driver / Mobile

| Workflow | Status | Evidence |
| --- | --- | --- |
| Media upload | AUTOMATED VERIFIED | `deliveryNotesApi.js` sends delivery-note writes through authenticated API requests and offline queue logic. |
| Delivery-note creation | AUTOMATED VERIFIED | Existing test chain covers delivery-note contracts; mobile source includes create/update queue. |
| Photo metadata persistence | AUTOMATED VERIFIED | Backend saves `storageKey`, authenticated path, and compatibility metadata. |
| Authenticated photo retrieval | DEFECT FOUND / BLOCKED | Mobile image components consume `photo.url` without authorization headers. |
| Cached media behavior | MANUAL PHYSICAL TEST REQUIRED | Offline cached note records exist, but authenticated image caching was not physically tested. |
| Offline behavior | MANUAL PHYSICAL TEST REQUIRED | Existing mobile offline queue exists; private-media display offline remains unverified. |
| Reconnect behavior | MANUAL PHYSICAL TEST REQUIRED | Delivery note operation flushing exists; authenticated media reload after reconnect remains unverified. |
| Expired session behavior | MANUAL PHYSICAL TEST REQUIRED | API should deny expired sessions; mobile image failure behavior is not verified. |
| Organization deactivation behavior | MANUAL PHYSICAL TEST REQUIRED | Backend auth context enforces active Organization/session rules; mobile media UI behavior is not verified. |

## Supervisor / Web Dashboard

| Workflow | Status | Evidence |
| --- | --- | --- |
| Delivery-note media display | UNKNOWN / REQUIRES MANUAL VERIFICATION | Admin HTML uses `photo.url`; same-origin `/api/media` should receive admin cookie scoped to `/api`, but a credentialed browser walkthrough is required. |
| Authorized media retrieval | UNKNOWN / REQUIRES MANUAL VERIFICATION | Source supports it; production credentialed workflow not tested. |
| Expired-session behavior | AUTOMATED/SOURCE VERIFIED, OPERATIONAL TEST REQUIRED | `/api/media` requires auth; browser behavior after cookie expiration needs walkthrough. |
| Organization isolation | AUTOMATED VERIFIED | Tenant-scoped repository lookup and auth tests pass. |
| Browser CORS behavior | AUTOMATED VERIFIED | Explicit-origin CORS regression passes. |
| Direct media refresh behavior | UNKNOWN / REQUIRES MANUAL VERIFICATION | Direct browser refresh should require cookie auth; needs walkthrough. |

## Organization Admin / Platform Admin

Only workflows authorized through existing permissions should be verified. Do not weaken media authorization to preserve UI behavior.

Platform Admin behavior requires special care because platform-admin context may not have a single Organization context. Private Organization media should normally be accessed through explicit support/audit workflows, not broad platform-global browsing.
