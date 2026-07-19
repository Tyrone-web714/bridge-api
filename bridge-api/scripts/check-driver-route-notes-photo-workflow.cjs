const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const deliveryPhotoStore = read('apps/mobile/src/app/services/deliveryPhotoStore.js');
const deliveryNotesApi = read('apps/mobile/src/app/services/deliveryNotesApi.js');
const deliveryOfflineStore = read('apps/mobile/src/app/services/deliveryOfflineStore.js');
const photoDraftStore = read('apps/mobile/src/app/services/photoDraftStore.js');
const deliveryNotesScreen = read('apps/mobile/src/app/screens/DeliveryNotesScreen.js');
const hazardReportScreen = read('apps/mobile/src/app/screens/HazardReportScreen.js');
const homeScreen = read('apps/mobile/src/app/screens/HomeScreen.js');
const accountPanel = read('apps/mobile/src/app/components/AccountKnowledgePanel.js');
const deliveryNotesRoute = read('bridge-api/routes/deliveryNotes.js');
const repositories = read('bridge-api/db/repositories.js');
const driverAuth = read('bridge-api/services/driverAuth.js');

assert(deliveryPhotoStore.includes('source.copy(destination)'), 'camera/library assets must be copied into TSR-controlled app storage');
assert(deliveryPhotoStore.includes('assertReadableFile(destination'), 'TSR-controlled photo copy must be readable before upload');
assert(deliveryPhotoStore.includes('LOCAL_MEDIA_UNREADABLE'), 'unreadable camera assets must be classified distinctly');
assert(deliveryNotesApi.includes('isLocalMediaUploadError(error)') && deliveryNotesApi.includes('throw error'), 'unreadable local media must not be queued as offline success');
assert(deliveryNotesScreen.includes('sourceUriScheme'), 'delivery notes must keep safe source diagnostics for preview builds');
assert(hazardReportScreen.includes('persistDeliveryPhoto'), 'hazard report camera/library assets must use durable local photo persistence');
assert(hazardReportScreen.includes('Promise.all(photos.map(photoPayload))'), 'hazard photo payload construction must handle async local file reads');

assert(homeScreen.includes('shouldShowDriverLoginForm'), 'Home must explicitly gate Driver Login rendering');
assert(homeScreen.includes("driverStartupState === 'authenticated'"), 'Home must distinguish restored authenticated sessions from unauthenticated login');
assert(homeScreen.includes('navigateToPhotoDraft'), 'Home must return restored sessions to pending photo workflows');
assert(photoDraftStore.includes('routeStopId') && photoDraftStore.includes('routeManifestId'), 'photo draft context must preserve route stop and manifest identity');

assert(deliveryNotesScreen.includes('routeStopId') && deliveryNotesScreen.includes('routeManifestId'), 'DeliveryNotesScreen must send route-stop scope on save/fetch');
assert(deliveryNotesApi.includes("query.set('routeStopId'") && deliveryNotesApi.includes("query.set('routeManifestId'"), 'delivery-note fetch must include route-stop query parameters');
assert(deliveryOfflineStore.includes("return `stop-${stopScoped}`"), 'offline notes cache must prioritize stop-scoped identity');
assert(accountPanel.includes('routeStopId') && accountPanel.includes('routeManifestId'), 'route notes preview panel must use the same scoped fetch path');

assert(driverAuth.includes('internalDriverId: req.driverAuth.internalDriverId'), 'driver auth identity must expose permanent internal driver ID');
assert(driverAuth.includes('companyDriverNumber: req.driverAuth.companyDriverNumber'), 'driver auth identity must preserve company driver number');
assert(deliveryNotesRoute.includes('internalDriverId') && deliveryNotesRoute.includes('companyDriverNumber'), 'delivery-note saves must record authenticated driver identity metadata');
assert(deliveryNotesRoute.includes('recordRouteStopId') && deliveryNotesRoute.includes('return false'), 'delivery-note read filtering must reject mismatched stop-scoped records');
assert(repositories.includes('routeStopId: raw.routeStopId'), 'delivery-note repository must hydrate route-stop metadata');
assert(repositories.includes('internalDriverId: raw.internalDriverId'), 'delivery-note repository must hydrate internal driver metadata');

console.log('[test:driver-route-notes-photo] route notes/photo workflow contracts verified.');
