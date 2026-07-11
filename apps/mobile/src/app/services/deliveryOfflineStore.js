import AsyncStorage from '@react-native-async-storage/async-storage';

const OPERATION_QUEUE_KEY = '@truck-safe-routing/delivery-operation-sync/v1';
const DELIVERY_CACHE_PREFIX = '@truck-safe-routing/stop-delivery/v1';
const DELIVERY_NOTES_CACHE_PREFIX = '@truck-safe-routing/delivery-notes/v1';
const PRODUCT_BARCODE_CACHE_PREFIX = '@truck-safe-routing/product-barcode/v1';

function clean(value) {
  return String(value || '').trim();
}

function cacheKey(stopId, driverId) {
  return `${DELIVERY_CACHE_PREFIX}/${clean(driverId) || 'unknown-driver'}/${clean(stopId)}`;
}

function notesCacheKey({ accountNumber, placeId, destination } = {}) {
  const identity = clean(accountNumber)
    || clean(placeId)
    || clean(destination).toLowerCase().replace(/\s+/g, '-').slice(0, 180)
    || 'unknown-account';
  return `${DELIVERY_NOTES_CACHE_PREFIX}/${identity}`;
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

let queueMutation = Promise.resolve();

async function mutateQueue(mutator) {
  const execute = async () => {
    const stored = await readJson(OPERATION_QUEUE_KEY, []);
    const current = Array.isArray(stored) ? stored : [];
    const next = await mutator(current);
    await writeJson(OPERATION_QUEUE_KEY, Array.isArray(next) ? next : current);
    return next;
  };
  queueMutation = queueMutation.then(execute, execute);
  return queueMutation;
}

export async function enqueueDeliveryOperation(type, payload, identity = {}) {
  const operation = {
    id: operationId(type),
    type,
    payload: payload || {},
    driverId: clean(identity.driverId),
    driverName: clean(identity.driverName),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  };
  await mutateQueue((operations) => [...operations, operation]);
  return operation;
}

export async function readPendingDeliveryOperations() {
  await queueMutation;
  const operations = await readJson(OPERATION_QUEUE_KEY, []);
  return Array.isArray(operations) ? operations : [];
}

export async function removePendingDeliveryOperation(id) {
  await mutateQueue((operations) => operations.filter((operation) => operation.id !== id));
}

export async function markDeliveryOperationFailed(id, message) {
  await mutateQueue((operations) => operations.map((operation) => (
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

export async function cacheStopDelivery(stopId, driverId, delivery) {
  if (!clean(stopId) || !delivery) return;
  await writeJson(cacheKey(stopId, driverId), {
    delivery,
    cachedAt: new Date().toISOString(),
  });
}

export async function readCachedStopDelivery(stopId, driverId) {
  const cached = await readJson(cacheKey(stopId, driverId), null);
  return cached?.delivery || null;
}

export async function getPendingDeliveryOperationCount() {
  const operations = await readPendingDeliveryOperations();
  return operations.length;
}

export async function cacheDeliveryNotes(identity, notes) {
  await writeJson(notesCacheKey(identity), {
    notes: Array.isArray(notes) ? notes : [],
    cachedAt: new Date().toISOString(),
  });
}

export async function readCachedDeliveryNotes(identity) {
  const cached = await readJson(notesCacheKey(identity), null);
  return Array.isArray(cached?.notes) ? cached.notes : [];
}

export async function cacheBarcodeProduct(barcode, product) {
  const value = clean(barcode);
  if (!value || !product) return;
  await writeJson(`${PRODUCT_BARCODE_CACHE_PREFIX}/${value}`, { product, cachedAt: new Date().toISOString() });
}

export async function readCachedBarcodeProduct(barcode) {
  const cached = await readJson(`${PRODUCT_BARCODE_CACHE_PREFIX}/${clean(barcode)}`, null);
  return cached?.product || null;
}
