import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDriverTenantContext } from './driverSession';
import {
  cleanTenantValue,
  isTrustedTenantContext,
  legacyMigrationMarkerKey,
  legacyQuarantineKey,
  operationMatchesTenant,
  tenantIdentityFromOptions,
  tenantScopedStorageKey,
  withTenantOperationMetadata,
} from './tenantContext';

const LEGACY_OPERATION_QUEUE_KEY = '@truck-safe-routing/delivery-operation-sync/v1';
const LEGACY_DELIVERY_CACHE_PREFIX = '@truck-safe-routing/stop-delivery/v1';
const LEGACY_DELIVERY_NOTES_CACHE_PREFIX = '@truck-safe-routing/delivery-notes/v1';
const LEGACY_PRODUCT_BARCODE_CACHE_PREFIX = '@truck-safe-routing/product-barcode/v1';
const OPERATION_QUEUE_PREFIX = '@truck-safe-routing/delivery-operation-sync/v2';
const DELIVERY_CACHE_PREFIX = '@truck-safe-routing/stop-delivery/v2';
const DELIVERY_NOTES_CACHE_PREFIX = '@truck-safe-routing/delivery-notes/v2';
const PRODUCT_BARCODE_CACHE_PREFIX = '@truck-safe-routing/product-barcode/v2';

function clean(value) {
  return cleanTenantValue(value);
}

function resolveTenantIdentity(options = {}) {
  return tenantIdentityFromOptions(options, getDriverTenantContext());
}

function requireTenantIdentity(options = {}) {
  const identity = resolveTenantIdentity(options);
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required for offline delivery storage.');
  }
  return identity;
}

function queueKey(identity) {
  return tenantScopedStorageKey(OPERATION_QUEUE_PREFIX, identity, 'queue');
}

function cacheKey(stopId, identity) {
  return tenantScopedStorageKey(DELIVERY_CACHE_PREFIX, identity, 'stop', clean(stopId) || 'unknown-stop');
}

function legacyCacheKey(stopId, companyDriverNumber) {
  return `${LEGACY_DELIVERY_CACHE_PREFIX}/${clean(companyDriverNumber) || 'unknown-driver'}/${clean(stopId)}`;
}

function notesIdentityPart({ routeStopId, routeManifestId, routeDate, routeNumber, accountNumber, placeId, destination } = {}) {
  const stopScoped = clean(routeStopId);
  if (stopScoped) return `stop-${stopScoped}`;
  const routeScoped = [routeManifestId, routeDate, routeNumber, accountNumber]
    .map(clean)
    .filter(Boolean)
    .join('-');
  if (routeScoped) return `route-${routeScoped}`;
  return clean(accountNumber)
    || clean(placeId)
    || clean(destination).toLowerCase().replace(/\s+/g, '-').slice(0, 180)
    || 'unknown-account';
}

function notesCacheKey(identity, noteIdentity) {
  return tenantScopedStorageKey(DELIVERY_NOTES_CACHE_PREFIX, identity, 'notes', notesIdentityPart(noteIdentity));
}

function legacyNotesCacheKey(noteIdentity) {
  return `${LEGACY_DELIVERY_NOTES_CACHE_PREFIX}/${notesIdentityPart(noteIdentity)}`;
}

function barcodeCacheKey(barcode, identity) {
  return tenantScopedStorageKey(PRODUCT_BARCODE_CACHE_PREFIX, identity, 'barcode', clean(barcode));
}

function legacyBarcodeCacheKey(barcode) {
  return `${LEGACY_PRODUCT_BARCODE_CACHE_PREFIX}/${clean(barcode)}`;
}

function operationId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

async function readJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function migrateLegacyDeliveryQueue(identity) {
  const markerKey = legacyMigrationMarkerKey(OPERATION_QUEUE_PREFIX, identity);
  const marker = await readJson(markerKey, null);
  if (marker?.completedAt) return;

  const legacy = await readJson(LEGACY_OPERATION_QUEUE_KEY, []);
  const legacyOperations = Array.isArray(legacy) ? legacy : [];
  const matching = [];
  const quarantined = [];
  const companyDriverNumber = clean(identity.companyDriverNumber);

  legacyOperations.forEach((operation) => {
    if (operation.driverId && clean(operation.driverId) === companyDriverNumber) {
      matching.push(withTenantOperationMetadata(operation, identity, operation.payloadVersion || 1));
    } else {
      quarantined.push(operation);
    }
  });

  if (matching.length) {
    const current = await readJson(queueKey(identity), []);
    const currentIds = new Set((Array.isArray(current) ? current : []).map((operation) => operation.id));
    await writeJson(queueKey(identity), [
      ...(Array.isArray(current) ? current : []),
      ...matching.filter((operation) => !currentIds.has(operation.id)),
    ]);
  }

  if (quarantined.length) {
    await writeJson(legacyQuarantineKey(OPERATION_QUEUE_PREFIX, 'delivery-operation-queue'), {
      reason: 'Legacy delivery operation queue did not match authenticated driver context.',
      createdAt: new Date().toISOString(),
      operations: quarantined,
    });
  }

  await writeJson(markerKey, {
    completedAt: new Date().toISOString(),
    migratedCount: matching.length,
    quarantinedCount: quarantined.length,
    sourceKey: LEGACY_OPERATION_QUEUE_KEY,
  });
}

let queueMutation = Promise.resolve();

async function mutateQueue(identity, mutator) {
  const execute = async () => {
    await migrateLegacyDeliveryQueue(identity);
    const key = queueKey(identity);
    const stored = await readJson(key, []);
    const current = Array.isArray(stored) ? stored : [];
    const next = await mutator(current);
    await writeJson(key, Array.isArray(next) ? next : current);
    return next;
  };
  queueMutation = queueMutation.then(execute, execute);
  return queueMutation;
}

export async function enqueueDeliveryOperation(type, payload, identityInput = {}) {
  const identity = requireTenantIdentity(identityInput);
  const operation = withTenantOperationMetadata({
    id: operationId(type),
    type,
    payload: payload || {},
    routeId: clean(identityInput.routeId || payload?.manifestId || payload?.routeId),
    stopId: clean(identityInput.stopId || payload?.stopId),
    driverId: identity.companyDriverNumber,
    driverName: clean(identityInput.driverName),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  }, identity, 2);
  await mutateQueue(identity, (operations) => [...operations, operation]);
  return operation;
}

export async function readPendingDeliveryOperations(options = {}) {
  const identity = requireTenantIdentity(options);
  await queueMutation;
  await migrateLegacyDeliveryQueue(identity);
  const operations = await readJson(queueKey(identity), []);
  return (Array.isArray(operations) ? operations : []).filter((operation) => operationMatchesTenant(operation, identity));
}

export async function removePendingDeliveryOperation(id, options = {}) {
  const identity = requireTenantIdentity(options);
  await mutateQueue(identity, (operations) => operations.filter((operation) => operation.id !== id));
}

export async function markDeliveryOperationFailed(id, message, options = {}) {
  const identity = requireTenantIdentity(options);
  await mutateQueue(identity, (operations) => operations.map((operation) => (
    operation.id === id
      ? {
          ...operation,
          attempts: Number(operation.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: message || 'Delivery synchronization failed.',
        }
      : operation
  )));
}

export async function cacheStopDelivery(stopId, driverId, delivery, options = {}) {
  if (!clean(stopId) || !delivery) return;
  const identity = requireTenantIdentity({ ...options, driverId });
  await writeJson(cacheKey(stopId, identity), {
    delivery,
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    cachedAt: new Date().toISOString(),
  });
}

export async function readCachedStopDelivery(stopId, driverId, options = {}) {
  const identity = requireTenantIdentity({ ...options, driverId });
  const cached = await readJson(cacheKey(stopId, identity), null);
  if (cached?.delivery) return cached.delivery;
  const legacy = await readJson(legacyCacheKey(stopId, identity.companyDriverNumber), null);
  if (legacy?.delivery) {
    await cacheStopDelivery(stopId, identity.companyDriverNumber, legacy.delivery, identity);
    return legacy.delivery;
  }
  return null;
}

export async function getPendingDeliveryOperationCount(options = {}) {
  const operations = await readPendingDeliveryOperations(options);
  return operations.length;
}

export async function cacheDeliveryNotes(identityInput, notes) {
  const identity = requireTenantIdentity(identityInput);
  await writeJson(notesCacheKey(identity, identityInput), {
    notes: Array.isArray(notes) ? notes : [],
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    cachedAt: new Date().toISOString(),
  });
}

export async function readCachedDeliveryNotes(identityInput) {
  const identity = requireTenantIdentity(identityInput);
  const cached = await readJson(notesCacheKey(identity, identityInput), null);
  if (Array.isArray(cached?.notes)) return cached.notes;
  const legacy = await readJson(legacyNotesCacheKey(identityInput), null);
  if (Array.isArray(legacy?.notes)) {
    await cacheDeliveryNotes(identityInput, legacy.notes);
    return legacy.notes;
  }
  return [];
}

export async function cacheBarcodeProduct(barcode, product, options = {}) {
  const value = clean(barcode);
  if (!value || !product) return;
  const identity = requireTenantIdentity(options);
  await writeJson(barcodeCacheKey(value, identity), {
    product,
    organizationId: identity.organizationId,
    cachedAt: new Date().toISOString(),
  });
}

export async function readCachedBarcodeProduct(barcode, options = {}) {
  const identity = requireTenantIdentity(options);
  const cached = await readJson(barcodeCacheKey(barcode, identity), null);
  if (cached?.product) return cached.product;
  const legacy = await readJson(legacyBarcodeCacheKey(barcode), null);
  if (legacy?.product) {
    await cacheBarcodeProduct(barcode, legacy.product, identity);
    return legacy.product;
  }
  return null;
}
