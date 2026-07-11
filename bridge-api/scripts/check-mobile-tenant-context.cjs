const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const mobileRoot = path.join(repoRoot, 'apps', 'mobile');

function read(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function assertContains(source, text, label) {
  assert(source.includes(text), `${label} missing expected text: ${text}`);
}

function assertMatches(source, pattern, label) {
  assert(pattern.test(source), `${label} missing expected pattern: ${pattern}`);
}

const tenantContext = read('src/app/services/tenantContext.js');
const driverSession = read('src/app/services/driverSession.js');
const routeManifestOfflineStore = read('src/app/services/routeManifestOfflineStore.js');
const deliveryOfflineStore = read('src/app/services/deliveryOfflineStore.js');
const routingApi = read('src/app/services/routingApi.js');
const routeManifestApi = read('src/app/services/routeManifestApi.js');
const deliveryNotesApi = read('src/app/services/deliveryNotesApi.js');
const deliveryPhotoStore = read('src/app/services/deliveryPhotoStore.js');
const apiConfig = read('src/app/config/api.js');
const homeApi = read('src/app/services/homeApi.js');
const homeScreen = read('src/app/screens/HomeScreen.js');

assertContains(tenantContext, 'normalizeDriverSession', 'Trusted session normalization');
assertContains(tenantContext, 'organizationId', 'Organization context field');
assertContains(tenantContext, 'internalDriverId', 'Internal driver identity field');
assertContains(tenantContext, 'companyDriverNumber', 'Company driver number field');
assertContains(tenantContext, 'tenantScopedStorageKey', 'Tenant-scoped storage helper');
assertContains(tenantContext, '/org/${organizationId}/driver/${internalDriverId}', 'Storage key tenant shape');
assertContains(tenantContext, 'operationMatchesTenant', 'Cross-tenant operation guard');
assertContains(tenantContext, 'legacyQuarantineKey', 'Legacy quarantine helper');

assertContains(driverSession, 'SecureStore.setItemAsync(SESSION_KEY', 'SecureStore session persistence');
assertContains(driverSession, 'normalizeDriverSession', 'Session normalization on login/load');
assertContains(driverSession, 'isTrustedTenantContext', 'Trusted tenant context validation');
assertContains(driverSession, 'getDriverTenantContext', 'Tenant context accessor');
assertContains(driverSession, 'Driver login did not return trusted Organization context', 'Missing tenant context failure');

assertContains(routeManifestOfflineStore, '@truck-safe-routing/route-stop-sync/v2', 'Tenant-scoped stop queue key version');
assertContains(routeManifestOfflineStore, '@truck-safe-routing/assigned-route/v2', 'Tenant-scoped route cache key version');
assertContains(routeManifestOfflineStore, 'LEGACY_QUEUE_STORAGE_KEY', 'Legacy stop queue migration source');
assertContains(routeManifestOfflineStore, 'migrateLegacyStopQueue', 'Legacy stop queue migration');
assertContains(routeManifestOfflineStore, 'legacyQuarantineKey', 'Stop queue quarantine');
assertContains(routeManifestOfflineStore, 'operationMatchesTenant', 'Stop queue tenant guard');
assertContains(routeManifestOfflineStore, 'withTenantOperationMetadata', 'Stop operation tenant metadata');
assertContains(routeManifestOfflineStore, 'cachedRouteMatchesTenant', 'Assigned route cache tenant match guard');
assertContains(routeManifestOfflineStore, 'quarantineMismatchedRouteCache', 'Assigned route cache tenant mismatch quarantine');
assertContains(routeManifestOfflineStore, 'assigned-route-tenant-mismatch', 'Assigned route cache mismatch quarantine reason');

assertContains(deliveryOfflineStore, '@truck-safe-routing/delivery-operation-sync/v2', 'Tenant-scoped delivery queue key version');
assertContains(deliveryOfflineStore, '@truck-safe-routing/stop-delivery/v2', 'Tenant-scoped stop delivery cache key version');
assertContains(deliveryOfflineStore, '@truck-safe-routing/delivery-notes/v2', 'Tenant-scoped delivery notes cache key version');
assertContains(deliveryOfflineStore, '@truck-safe-routing/product-barcode/v2', 'Tenant-scoped barcode cache key version');
assertContains(deliveryOfflineStore, 'migrateLegacyDeliveryQueue', 'Legacy delivery queue migration');
assertContains(deliveryOfflineStore, 'legacyQuarantineKey', 'Delivery queue quarantine');
assertContains(deliveryOfflineStore, 'operationMatchesTenant', 'Delivery queue tenant guard');
assertContains(deliveryOfflineStore, 'withTenantOperationMetadata', 'Delivery operation tenant metadata');

assertContains(routingApi, '@truck-safe-routing/route-events/v2', 'Tenant-scoped route event queue key version');
assertContains(routingApi, 'getDriverTenantContext', 'Route event tenant context source');
assertContains(routingApi, 'operationMatchesTenant', 'Route event tenant guard');
assertContains(routingApi, 'migrateLegacyRouteEvents', 'Legacy route event migration');
assertContains(routingApi, 'route-events-ambiguous', 'Ambiguous route events quarantine');

assertContains(deliveryPhotoStore, 'getDriverTenantContext', 'Delivery photo tenant context source');
assertContains(deliveryPhotoStore, 'currentTenantPhotoDirectory', 'Tenant-scoped delivery photo directory');
assertContains(deliveryPhotoStore, 'safeStoragePart(identity.organizationId)', 'Delivery photo Organization directory');
assertContains(deliveryPhotoStore, 'safeStoragePart(identity.internalDriverId)', 'Delivery photo internal driver directory');

assertContains(routeManifestApi, 'removePendingStopOperation(operation.id, operation)', 'Stop queue removal uses operation tenant context');
assertContains(routeManifestApi, 'markPendingStopOperationFailed(operation.id, error.message, operation)', 'Stop queue failure uses operation tenant context');
assertContains(routeManifestApi, 'removePendingDeliveryOperation(operation.id, operation)', 'Delivery queue removal uses operation tenant context');
assertContains(routeManifestApi, 'markDeliveryOperationFailed(operation.id, error.message, operation)', 'Delivery queue failure uses operation tenant context');
assertContains(routeManifestApi, 'cacheStopDelivery(stopId, options.driverId, data, options)', 'Stop delivery cache uses tenant options');
assertContains(routeManifestApi, 'cacheBarcodeProduct(value, data.product, options)', 'Barcode cache uses tenant options');

assertContains(deliveryNotesApi, 'removePendingDeliveryOperation(operation.id, operation)', 'Delivery note queue removal uses operation tenant context');
assertContains(deliveryNotesApi, 'markDeliveryOperationFailed(operation.id, error.message, operation)', 'Delivery note queue failure uses operation tenant context');

assertContains(apiConfig, '...getDriverSessionHeaders()', 'Central authenticated request headers');
assertContains(homeApi, 'headers: jsonApiHeaders()', 'Protected mobile endpoint headers');

assertContains(homeScreen, "useState('restoring')", 'Home startup restoring state');
assertContains(homeScreen, "setDriverStartupState('restoring')", 'Home explicitly enters restoring state');
assertContains(homeScreen, 'const session = await initializeDriverSession();', 'Home awaits persisted session restoration');
assertContains(homeScreen, "setDriverStartupState('unauthenticated')", 'Home handles missing or invalid session as unauthenticated');
assertContains(homeScreen, 'readCachedAssignedRoute({', 'Home restores assigned route from tenant-scoped cache');
assertContains(homeScreen, 'fetchAssignedDriverRouteFromDates({', 'Home checks backend when no cached route exists');
assertContains(homeScreen, "setDriverStartupState('authenticated')", 'Home records restored authenticated state');
assertContains(homeScreen, "setDriverStartupState('error')", 'Home handles restoration failures');
assertContains(homeScreen, "driverStartupState === 'restoring'", 'Home derives restoring render state');
assertContains(homeScreen, 'Restoring driver session...', 'Home avoids login fields while startup restoration is pending');
assertMatches(
  homeScreen,
  /readCachedAssignedRoute\([\s\S]*fetchAssignedDriverRouteFromDates/,
  'Home checks tenant-scoped route cache before backend fallback'
);
assertMatches(
  homeScreen,
  /initializeDriverSession\([\s\S]*setDriverIdInput\(authenticatedDriverId\)[\s\S]*setConfirmedDriver\(confirmed\)/,
  'Home rebuilds confirmed driver state from restored session and route'
);

assertMatches(
  tenantContext + driverSession + routeManifestOfflineStore + deliveryOfflineStore + routingApi,
  /organizationId[\s\S]*internalDriverId[\s\S]*companyDriverNumber/,
  'Tenant identity includes Organization, internal driver, and company driver number'
);

const mobileSources = [
  tenantContext,
  driverSession,
  routeManifestOfflineStore,
  deliveryOfflineStore,
  routingApi,
  routeManifestApi,
  deliveryNotesApi,
  deliveryPhotoStore,
  apiConfig,
  homeApi,
  homeScreen,
].join('\n');
assert(!/organization_id\s*[:=]/.test(mobileSources), 'Mobile source must not send arbitrary organization_id values.');

console.log('Mobile tenant-context checks passed');
