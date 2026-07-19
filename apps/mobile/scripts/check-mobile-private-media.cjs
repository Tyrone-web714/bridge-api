const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const component = read('src/app/components/AuthenticatedMediaImage.js');
const deliveryNotes = read('src/app/screens/DeliveryNotesScreen.js');
const accountPanel = read('src/app/components/AccountKnowledgePanel.js');
const home = read('src/app/screens/HomeScreen.js');
const hazardReport = read('src/app/screens/HazardReportScreen.js');
const driverSession = read('src/app/services/driverSession.js');
const mediaSelection = read('src/app/services/mobileMediaSelection.js');
const photoDraftStore = read('src/app/services/photoDraftStore.js');
const appJson = JSON.parse(read('app.json'));
const appConfig = read('app.config.js');
const packageJson = JSON.parse(read('package.json'));

assert(component.includes('getDriverSessionHeaders'), 'authenticated media must use existing driver session headers');
assert(component.includes("classification === 'ORGANIZATION_PRIVATE'"), 'private media classification must be explicit');
assert(component.includes("accessPath.startsWith('/api/media/')"), 'private media accessPath must be recognized');
assert(component.includes('/\\/api\\/media\\/[^/?#]+/i.test(url)'), 'private media URL path must be recognized');
assert(component.includes('API_BASE_URL.replace'), 'relative private media paths must resolve against API_BASE_URL');
assert(!component.includes('legacyPublicUrl'), 'mobile private media must not fall back to legacy public URLs');
assert(!component.includes('PHOTO_STORAGE_PUBLIC_BASE_URL'), 'mobile must not know R2 public base URL');
assert(!component.includes('r2.dev'), 'mobile must not hard-code R2 public URLs');

assert(driverSession.includes('expo-secure-store'), 'driver session token must remain in SecureStore-backed session module');
assert(driverSession.includes('Authorization: `Bearer ${activeSession.token}`'), 'session module must construct bearer auth header');

assert(deliveryNotes.includes("import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage'"), 'DeliveryNotesScreen must import authenticated image component');
assert(accountPanel.includes("import AuthenticatedMediaImage from './AuthenticatedMediaImage'"), 'AccountKnowledgePanel must import authenticated image component');
assert(home.includes("import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage'"), 'HomeScreen must import authenticated image component');

for (const [label, source] of [
  ['DeliveryNotesScreen', deliveryNotes],
  ['AccountKnowledgePanel', accountPanel],
  ['HomeScreen', home]
]) {
  assert(!source.includes('source={{ uri: photo.url }}'), `${label} must not render private photo.url directly`);
  assert(!source.includes('source={{ uri: previewPhoto.url }}'), `${label} must not render private previewPhoto.url directly`);
  assert(!source.includes('source={{ uri: selectedDriverPhoto.url }}'), `${label} must not render private selectedDriverPhoto.url directly`);
}

assert(packageJson.scripts['test:mobile-private-media'] === 'node scripts/check-mobile-private-media.cjs', 'package script must register mobile private media test');

assert(mediaSelection.includes('requestCameraPermissionsAsync'), 'camera capture must request camera permission');
assert(mediaSelection.includes('launchCameraAsync'), 'camera capture must launch the device camera');
assert(mediaSelection.includes('requestMediaLibraryPermissionsAsync'), 'library selection must request media library permission');
assert(mediaSelection.includes('launchImageLibraryAsync'), 'library selection must launch the image library');
assert(mediaSelection.includes("text: 'Take Photo'"), 'photo prompt must include Take Photo option');
assert(mediaSelection.includes("text: 'Choose From Library'"), 'photo prompt must include Choose From Library option');
assert(mediaSelection.includes("text: 'Cancel'"), 'photo prompt must include Cancel option');
assert(mediaSelection.includes('normalizeImageAsset'), 'camera and library assets must share normalized metadata');
assert(mediaSelection.includes('fileName: safeFileName'), 'normalized assets must include fallback filename metadata');
assert(mediaSelection.includes('mimeType: getImageMimeType'), 'normalized assets must include MIME metadata');
assert(mediaSelection.includes('width: asset.width || null'), 'normalized assets must preserve width when available');
assert(mediaSelection.includes('height: asset.height || null'), 'normalized assets must preserve height when available');
assert(mediaSelection.includes('if (result.canceled) return []'), 'camera/library cancellation must return no assets without crashing');
assert(mediaSelection.includes('rememberCameraWorkflow'), 'camera launch must record workflow intent before native camera handoff');
assert(mediaSelection.includes('getPendingResultAsync'), 'camera return must recover Expo pending camera result after Android activity recreation');
assert(mediaSelection.includes('recoverPendingCameraDraft'), 'mobile media selection must expose pending camera draft recovery');
assert(mediaSelection.includes('savePhotoDraft'), 'camera result must be persisted as a durable draft');
assert(mediaSelection.includes('clearCameraWorkflowIntent'), 'camera workflow intent must be cleared after success or cancellation');

assert(deliveryNotes.includes('selectImageAssetsWithPrompt'), 'DeliveryNotesScreen must offer the shared camera/library source prompt');
assert(deliveryNotes.includes('persistDeliveryPhoto(asset)'), 'camera and library delivery-note photos must use the same tenant-scoped local persistence path');
assert(deliveryNotes.includes('recoverPendingCameraDraft'), 'DeliveryNotesScreen must recover pending camera results after remount');
assert(deliveryNotes.includes('readPhotoDraft'), 'DeliveryNotesScreen must restore existing tenant-scoped delivery photo drafts');
assert(deliveryNotes.includes('savePhotoDraft'), 'DeliveryNotesScreen must preserve selected camera photos as a durable draft');
assert(deliveryNotes.includes('clearPhotoDraft'), 'DeliveryNotesScreen must clear only its intended photo draft after save/remove/reset');
assert(hazardReport.includes('capturePhotoAssets'), 'HazardReportScreen must use shared camera capture flow');
assert(hazardReport.includes('choosePhotoLibraryAssets'), 'HazardReportScreen must preserve library selection through the shared flow');
assert(hazardReport.includes('photos.map(photoPayload)'), 'hazard photos from both sources must use the same submit payload path');
assert(hazardReport.includes('recoverPendingCameraDraft'), 'HazardReportScreen must recover pending camera results after remount');
assert(hazardReport.includes('readPhotoDraft'), 'HazardReportScreen must restore existing tenant-scoped hazard photo drafts');
assert(hazardReport.includes('savePhotoDraft'), 'HazardReportScreen must preserve selected camera photos as a durable draft');
assert(hazardReport.includes('clearPhotoDraft'), 'HazardReportScreen must clear only its intended photo draft after submit/remove');
assert(home.includes('recoverPendingCameraDraft'), 'HomeScreen must recover pending camera draft after cold restart/session restoration');
assert(home.includes('readLatestPhotoDraft'), 'HomeScreen must route a restored valid session to the latest recoverable photo workflow');
assert(home.includes('navigateToPhotoDraft'), 'HomeScreen must navigate back to the original photo workflow after restoring session and route state');
assert(appConfig.includes('cameraPermission'), 'Expo image picker config must include camera permission copy');
assert(appJson.expo.android.permissions.includes('android.permission.CAMERA'), 'Android manifest permissions must include camera access');

assert(photoDraftStore.includes('getDriverTenantContext'), 'photo drafts must derive scope from active driver tenant context');
assert(photoDraftStore.includes('tenantScopedStorageKey'), 'photo drafts must use tenant-scoped storage keys');
assert(photoDraftStore.includes('operationMatchesTenant'), 'photo drafts must reject Organization/driver mismatches');
assert(photoDraftStore.includes('DRAFT_TTL_MS'), 'photo drafts must expire stale local records');
assert(photoDraftStore.includes('readLatestPhotoDraft'), 'photo draft store must support cold-restart recovery');
assert(photoDraftStore.includes('clearPhotoDraft'), 'photo draft store must support explicit cleanup');
assert(!photoDraftStore.includes('token'), 'photo drafts must not persist authentication tokens');

console.log('[test:mobile-private-media] authenticated private media rendering contracts verified.');
