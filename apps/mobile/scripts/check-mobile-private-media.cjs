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
const deliveryNotesNavigation = read('src/app/navigation/deliveryNotesNavigation.js');
const deliveryNotesApi = read('src/app/services/deliveryNotesApi.js');
const deliveryPhotoStore = read('src/app/services/deliveryPhotoStore.js');
const noteComposerStore = read('src/app/services/noteComposerStore.js');
const tsrCameraScreen = read('src/app/screens/TsrCameraScreen.js');
const rootNavigator = read('src/app/navigation/RootNavigator.js');
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
assert(mediaSelection.includes('stabilizeCameraAssets'), 'camera assets must be stabilized immediately after camera return');
assert(mediaSelection.includes('persistDeliveryPhoto(asset)'), 'camera assets must be copied into TSR-controlled storage before being returned to screens');
assert(mediaSelection.includes('fileName: safeFileName'), 'normalized assets must include fallback filename metadata');
assert(mediaSelection.includes('mimeType: getImageMimeType'), 'normalized assets must include MIME metadata');
assert(mediaSelection.includes('width: asset.width || null'), 'normalized assets must preserve width when available');
assert(mediaSelection.includes('height: asset.height || null'), 'normalized assets must preserve height when available');
assert(mediaSelection.includes('if (result.canceled) return []'), 'camera/library cancellation must return no assets without crashing');
assert(mediaSelection.includes('rememberCameraWorkflow'), 'camera launch must record workflow intent before native camera handoff');
assert(mediaSelection.includes('getPendingResultAsync'), 'camera return must recover Expo pending camera result after Android activity recreation');
assert(mediaSelection.includes('recoverPendingCameraDraft'), 'mobile media selection must expose pending camera draft recovery');
assert(mediaSelection.includes('handleCapturedMediaResult'), 'camera and pending camera results must share one persistence pipeline');
assert(mediaSelection.includes('captureRequestId'), 'camera workflow intent must include a stable capture request ID');
assert(mediaSelection.includes('hasProcessedCameraResult') && mediaSelection.includes('markCameraResultProcessed'), 'pending camera recovery must prevent duplicate processing');
assert(mediaSelection.includes('savePhotoDraft'), 'camera result must be persisted as a durable draft');
assert(mediaSelection.includes('clearCameraWorkflowIntent'), 'camera workflow intent must be cleared after success or cancellation');

assert(!deliveryNotes.includes('selectImageAssetsWithPrompt'), 'DeliveryNotesScreen must not use the external ImagePicker camera prompt');
assert(!deliveryNotes.includes('launchCameraAsync'), 'DeliveryNotesScreen must not launch the external camera activity');
assert(deliveryNotes.includes("navigation.push('TsrCamera'"), 'DeliveryNotesScreen must route camera capture through the in-app TSR camera screen');
assert(deliveryNotes.includes('choosePhotoLibraryAssets'), 'DeliveryNotesScreen must preserve the existing gallery workflow');
assert(deliveryNotes.includes('attachPhotoToNoteDraft'), 'DeliveryNotesScreen must attach gallery photos through the durable note composer draft');
assert(deliveryNotes.includes('routeStopId'), 'DeliveryNotesScreen must carry route stop identity for stop-scoped notes');
assert(deliveryNotes.includes('routeManifestId'), 'DeliveryNotesScreen must carry route manifest identity for run-scoped notes');
assert(deliveryNotes.includes('routeDate'), 'DeliveryNotesScreen must carry route date for run-scoped notes');
assert(deliveryNotes.includes('sourceUriScheme'), 'DeliveryNotesScreen must preserve safe camera/library source diagnostics');
assert(!deliveryNotes.includes('recoverPendingCameraDraft'), 'DeliveryNotesScreen must not consume Expo pending camera results directly');
assert(deliveryNotes.includes('loadOrCreateNoteDraft'), 'DeliveryNotesScreen must restore existing tenant-scoped note composer drafts');
assert(deliveryNotes.includes('saveNoteDraftText'), 'DeliveryNotesScreen must preserve note text before opening camera/library workflows');
assert(deliveryNotes.includes('clearNoteDraft'), 'DeliveryNotesScreen must clear only its intended note composer draft after save/reset');
assert(rootNavigator.includes("name=\"TsrCamera\""), 'Root navigator must register the in-app TSR camera screen');
assert(tsrCameraScreen.includes("import { CameraView, useCameraPermissions } from 'expo-camera'"), 'TSR camera must use expo-camera in-app capture');
assert(tsrCameraScreen.includes('takePictureAsync'), 'TSR camera must capture photos inside the app');
assert(tsrCameraScreen.includes('attachPhotoToNoteDraft'), 'TSR camera must persist captured photos into the note composer draft before returning');
assert(tsrCameraScreen.includes('Use Photo') && tsrCameraScreen.includes('Retake') && tsrCameraScreen.includes('Cancel'), 'TSR camera must expose Use Photo, Retake, and Cancel controls');
assert(!tsrCameraScreen.includes("navigate('Home'") && !tsrCameraScreen.includes("navigate('Landing'") && !tsrCameraScreen.includes('reset('), 'TSR camera must not recover by navigating Home, Landing, or resetting navigation');
assert(hazardReport.includes('capturePhotoAssets'), 'HazardReportScreen must use shared camera capture flow');
assert(hazardReport.includes('choosePhotoLibraryAssets'), 'HazardReportScreen must preserve library selection through the shared flow');
assert(hazardReport.includes('persistDeliveryPhoto'), 'HazardReportScreen must persist camera/library URIs before upload');
assert(hazardReport.includes('Promise.all(photos.map(photoPayload))'), 'hazard photos from both sources must use the same async submit payload path');
assert(!hazardReport.includes('recoverPendingCameraDraft'), 'HazardReportScreen must not consume Expo pending camera results directly');
assert(hazardReport.includes('readPhotoDraft'), 'HazardReportScreen must restore existing tenant-scoped hazard photo drafts');
assert(hazardReport.includes('savePhotoDraft'), 'HazardReportScreen must preserve selected camera photos as a durable draft');
assert(hazardReport.includes('clearPhotoDraft'), 'HazardReportScreen must clear only its intended photo draft after submit/remove');
assert(deliveryNotesNavigation.includes('buildDeliveryNotesParams'), 'Delivery Notes entry points must share a canonical navigation contract builder');
assert(deliveryNotesNavigation.includes('validateDeliveryNotesParams'), 'Delivery Notes must validate required account/stop/return context');
assert(deliveryNotesNavigation.includes('returnFromDeliveryNotes'), 'Delivery Notes must use explicit caller-defined return navigation');
assert(deliveryNotesNavigation.includes('source') && deliveryNotesNavigation.includes('returnRoute') && deliveryNotesNavigation.includes('returnParams'), 'Delivery Notes contract must carry source and return route metadata');
assert(deliveryNotesNavigation.includes('Delivery Notes requires an account number or place ID'), 'Delivery Notes contract must reject missing account identity');
assert(deliveryNotesNavigation.includes('Route Delivery Notes requires a manifest ID with the stop ID'), 'Delivery Notes contract must reject stop-scoped entries without manifest identity');
assert(deliveryNotes.includes('validateDeliveryNotesParams'), 'DeliveryNotesScreen must validate normalized navigation context during initialization');
assert(deliveryNotes.includes('contextValidation.valid'), 'DeliveryNotesScreen must gate loading, photo picking, and saving on valid context');
assert(deliveryNotes.includes('returnFromDeliveryNotes'), 'DeliveryNotesScreen Back must use the explicit return route');
assert(deliveryNotes.includes('Delivery context missing'), 'DeliveryNotesScreen must fail safely instead of saving with undefined context');
assert(!deliveryNotes.includes("navigate('Home'"), 'DeliveryNotesScreen must not navigate to Home on save success or failure');
assert(!deliveryNotes.includes("reset("), 'DeliveryNotesScreen must not reset the root navigator after save');
assert(!home.includes('recoverPendingCameraDraft'), 'HomeScreen must not consume Expo pending camera results directly');
assert(!home.includes('navigateToPhotoDraft'), 'HomeScreen must not route recovered camera results through Home');
assert(home.includes('shouldShowDriverLoginForm'), 'HomeScreen must not render Driver Login while an authenticated session is restored without route state');
assert(appConfig.includes('cameraPermission'), 'Expo image picker config must include camera permission copy');
assert(appJson.expo.android.permissions.includes('android.permission.CAMERA'), 'Android manifest permissions must include camera access');

assert(photoDraftStore.includes('getDriverTenantContext'), 'photo drafts must derive scope from active driver tenant context');
assert(photoDraftStore.includes('tenantScopedStorageKey'), 'photo drafts must use tenant-scoped storage keys');
assert(photoDraftStore.includes('operationMatchesTenant'), 'photo drafts must reject Organization/driver mismatches');
assert(photoDraftStore.includes('DRAFT_TTL_MS'), 'photo drafts must expire stale local records');
assert(photoDraftStore.includes('readLatestPhotoDraft'), 'photo draft store must support cold-restart recovery');
assert(photoDraftStore.includes('clearPhotoDraft'), 'photo draft store must support explicit cleanup');
assert(photoDraftStore.includes('PHOTO_DRAFT_PROCESSED_CAMERA_PART'), 'photo drafts must keep tenant-scoped processed camera result markers');
assert(photoDraftStore.includes('markCameraResultProcessed'), 'photo drafts must record processed camera request IDs');
assert(photoDraftStore.includes('hasProcessedCameraResult'), 'photo drafts must identify duplicate camera result recovery attempts');
assert(!photoDraftStore.includes('token'), 'photo drafts must not persist authentication tokens');
assert(noteComposerStore.includes('getDriverTenantContext'), 'note composer drafts must derive scope from active driver tenant context');
assert(noteComposerStore.includes('tenantScopedStorageKey'), 'note composer drafts must use tenant-scoped storage keys');
assert(noteComposerStore.includes('operationMatchesTenant'), 'note composer drafts must reject Organization/driver mismatches');
assert(noteComposerStore.includes('noteDraftId'), 'note composer drafts must use a stable noteDraftId');
assert(noteComposerStore.includes('localPhotoId'), 'note composer photos must use stable localPhotoId values');
assert(noteComposerStore.includes("PHOTO_UPLOAD_PENDING = 'PENDING'"), 'note composer photos must track pending upload status');
assert(noteComposerStore.includes("PHOTO_UPLOAD_UPLOADING = 'UPLOADING'"), 'note composer photos must track active upload status');
assert(noteComposerStore.includes("PHOTO_UPLOAD_FAILED = 'FAILED'"), 'note composer photos must track failed upload status');
assert(noteComposerStore.includes('deleteDraftPhotoFiles'), 'note composer cleanup must delete controlled local draft files on explicit cleanup');
assert(noteComposerStore.includes('NOTE_DRAFT_TTL_MS'), 'note composer drafts must expire stale local records');
assert(noteComposerStore.includes('attachPhotoToNoteDraft'), 'note composer must expose a single camera/library attachment path');
assert(noteComposerStore.includes('stableLocalUri'), 'note composer must store captured photos in app-controlled local storage');
assert(!noteComposerStore.includes('token'), 'note composer drafts must not persist authentication tokens');
assert(!noteComposerStore.includes('r2.dev'), 'note composer drafts must not persist public R2 URLs');

assert(deliveryPhotoStore.includes('isLocalMediaUploadError'), 'delivery photo upload must classify unreadable local media errors');
assert(deliveryPhotoStore.includes('assertReadableFile(source'), 'delivery photo upload must verify the selected source file before copy');
assert(deliveryPhotoStore.includes('assertReadableFile(destination'), 'delivery photo upload must prove the TSR-owned copy is readable before upload');
assert(deliveryPhotoStore.includes('isTsrControlledPhoto'), 'delivery photo persistence must detect already-stabilized TSR files');
assert(deliveryPhotoStore.includes('photoSourceDiagnostics'), 'delivery photo persistence must expose safe source diagnostics');
assert(deliveryPhotoStore.includes('sizeBytes'), 'delivery photo upload must preserve safe file-size diagnostics');
assert(deliveryNotesApi.includes('isLocalMediaUploadError(error)') && deliveryNotesApi.includes('throw error'), 'delivery note saves must not queue unreadable camera assets as offline success');
assert(deliveryNotesApi.includes("query.set('routeStopId'"), 'delivery note fetch must request stop-scoped notes when route stop identity is available');
assert(deliveryNotesApi.includes("routeStopId: note.routeStopId"), 'delivery note cache identity must include route stop identity');
assert(deliveryNotesApi.includes('fetchAccountKnowledgeDeliveryNotes'), 'Account Knowledge must use a durable account-scoped delivery-note read helper');
assert(deliveryNotesApi.includes('subscribeDeliveryNotesChanged'), 'Account Knowledge must be able to refresh after local note changes');
assert(accountPanel.includes('fetchAccountKnowledgeDeliveryNotes'), 'AccountKnowledgePanel must read from account-scoped notes, not stop-scoped notes');
assert(!accountPanel.includes('routeStopId,\\n      routeManifestId'), 'AccountKnowledgePanel must not pass route-stop scope into the durable account knowledge query');

console.log('[test:mobile-private-media] authenticated private media rendering contracts verified.');
