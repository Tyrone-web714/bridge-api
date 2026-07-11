import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = '@truck-safe-routing/route-stop-sync/v1';
const ROUTE_CACHE_PREFIX = '@truck-safe-routing/assigned-route/v1';
const FINISHED_STATUSES = new Set(['completed', 'departed', 'skipped', 'undelivered']);

function cleanIdentity(value) {
  return String(value || '').trim();
}

function routeCacheKey(driverId, routeDate) {
  const safeDriverId = cleanIdentity(driverId) || 'unknown-driver';
  const safeRouteDate = cleanIdentity(routeDate) || 'today';
  return `${ROUTE_CACHE_PREFIX}/${safeDriverId}/${safeRouteDate}`;
}

function createOperationId() {
  return `stop-sync-${Date.now()}-${Math.random().toString(16).slice(2, 12)}`;
}

async function readJson(key, fallback) {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
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
    const current = await readJson(QUEUE_STORAGE_KEY, []);
    const operations = Array.isArray(current) ? current : [];
    const next = await mutator(operations);
    await writeJson(QUEUE_STORAGE_KEY, Array.isArray(next) ? next : operations);
    return next;
  };
  queueMutation = queueMutation.then(execute, execute);
  return queueMutation;
}

export async function readPendingStopOperations() {
  await queueMutation;
  const operations = await readJson(QUEUE_STORAGE_KEY, []);
  return Array.isArray(operations) ? operations : [];
}

export async function enqueueStopStatusOperation(stopId, payload = {}, options = {}) {
  const operation = {
    id: createOperationId(),
    stopId: cleanIdentity(stopId),
    payload: {
      ...payload,
      clientUpdatedAt: payload.clientUpdatedAt || new Date().toISOString(),
    },
    driverId: cleanIdentity(options.driverId),
    driverName: cleanIdentity(options.driverName),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  };

  if (!operation.stopId || !operation.driverId) {
    throw new Error('A stop ID and driver ID are required to save an offline stop update.');
  }

  await mutateQueue((operations) => [...operations, operation]);
  return operation;
}

export async function removePendingStopOperation(operationId) {
  await mutateQueue((operations) => operations.filter((operation) => operation.id !== operationId));
}

export async function markPendingStopOperationFailed(operationId, message) {
  await mutateQueue((operations) => operations.map((operation) => (
    operation.id === operationId
      ? {
          ...operation,
          attempts: Number(operation.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: message || 'Stop sync failed.',
        }
      : operation
  )));
}

export async function cacheAssignedRoute(route, { driverId, routeDate } = {}) {
  if (!route) return;
  const effectiveRouteDate = routeDate || route.routeDate;
  const cached = {
    route,
    cachedAt: new Date().toISOString(),
  };
  await writeJson(routeCacheKey(driverId, effectiveRouteDate), cached);
  await writeJson(routeCacheKey(driverId, 'today'), cached);
}

export async function readCachedAssignedRoute({ driverId, routeDate } = {}) {
  const cached = await readJson(routeCacheKey(driverId, routeDate || 'today'), null);
  if (!routeDate && cached?.route?.routeDate) {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    if (cached.route.routeDate !== today) return null;
  }
  return cached?.route || null;
}

function operationMatchesRoute(operation, route, options = {}) {
  const requestedDriverId = cleanIdentity(options.driverId);
  const operationDriverId = cleanIdentity(operation.driverId);
  const operationRouteDate = cleanIdentity(operation.payload?.routeDate);
  const routeDate = cleanIdentity(route?.routeDate || options.routeDate);

  if (requestedDriverId && operationDriverId && requestedDriverId !== operationDriverId) {
    return false;
  }
  return !operationRouteDate || !routeDate || operationRouteDate === routeDate;
}

export async function applyPendingStopOperations(route, options = {}) {
  if (!route || !Array.isArray(route.stops)) return route;

  const operations = await readPendingStopOperations();
  const statusByStopId = new Map();

  operations.forEach((operation) => {
    if (operationMatchesRoute(operation, route, options)) {
      statusByStopId.set(operation.stopId, operation.payload || {});
    }
  });

  if (!statusByStopId.size) return route;

  const stops = route.stops.map((stop) => {
    const pending = statusByStopId.get(stop.id);
    if (!pending) return stop;
    return {
      ...stop,
      status: pending.status || stop.status,
      driverNotes: pending.driverNotes || stop.driverNotes,
      nonDeliveryReason: pending.nonDeliveryReason || stop.nonDeliveryReason,
      nonDeliveryNotes: pending.nonDeliveryNotes || stop.nonDeliveryNotes,
      pendingSync: true,
    };
  });
  const allFinished = stops.length > 0 && stops.every((stop) => (
    FINISHED_STATUSES.has(String(stop.status || '').toLowerCase())
  ));

  return {
    ...route,
    stops,
    status: allFinished
      ? (stops.some((stop) => stop.status === 'undelivered') ? 'completed_with_exceptions' : 'completed')
      : route.status,
    pendingSyncCount: statusByStopId.size,
  };
}

export async function getPendingStopOperationCount(options = {}) {
  const operations = await readPendingStopOperations();
  const driverId = cleanIdentity(options.driverId);
  return operations.filter((operation) => (
    !driverId || cleanIdentity(operation.driverId) === driverId
  )).length;
}
