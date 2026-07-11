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

const LEGACY_QUEUE_STORAGE_KEY = '@truck-safe-routing/route-stop-sync/v1';
const LEGACY_ROUTE_CACHE_PREFIX = '@truck-safe-routing/assigned-route/v1';
const QUEUE_STORAGE_PREFIX = '@truck-safe-routing/route-stop-sync/v2';
const ROUTE_CACHE_PREFIX = '@truck-safe-routing/assigned-route/v2';
const FINISHED_STATUSES = new Set(['completed', 'departed', 'skipped', 'undelivered']);

function cleanIdentity(value) {
  return cleanTenantValue(value);
}

function legacyRouteCacheKey(driverId, routeDate) {
  const safeDriverId = cleanIdentity(driverId) || 'unknown-driver';
  const safeRouteDate = cleanIdentity(routeDate) || 'today';
  return `${LEGACY_ROUTE_CACHE_PREFIX}/${safeDriverId}/${safeRouteDate}`;
}

function resolveTenantIdentity(options = {}) {
  return tenantIdentityFromOptions(options, getDriverTenantContext());
}

function requireTenantIdentity(options = {}) {
  const identity = resolveTenantIdentity(options);
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required for offline route storage.');
  }
  return identity;
}

function queueStorageKey(identity) {
  return tenantScopedStorageKey(QUEUE_STORAGE_PREFIX, identity, 'queue');
}

function routeCacheKey(identity, routeDate) {
  const safeRouteDate = cleanIdentity(routeDate) || 'today';
  return tenantScopedStorageKey(ROUTE_CACHE_PREFIX, identity, 'route', safeRouteDate);
}

function cachedRouteMatchesTenant(cached, identity) {
  return cleanIdentity(cached?.organizationId) === cleanIdentity(identity.organizationId)
    && cleanIdentity(cached?.internalDriverId) === cleanIdentity(identity.internalDriverId)
    && cleanIdentity(cached?.companyDriverNumber) === cleanIdentity(identity.companyDriverNumber);
}

async function quarantineMismatchedRouteCache(cached, identity, routeDate) {
  if (!cached) return;
  try {
    await writeJson(legacyQuarantineKey(ROUTE_CACHE_PREFIX, 'assigned-route-tenant-mismatch'), {
      reason: 'Assigned route cache did not match authenticated driver context.',
      createdAt: new Date().toISOString(),
      routeDate: routeDate || 'today',
      expected: {
        organizationId: identity.organizationId,
        internalDriverId: identity.internalDriverId,
        companyDriverNumber: identity.companyDriverNumber,
      },
      cached,
    });
  } catch {
    // Failing closed is more important than writing the quarantine record.
  }
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

async function migrateLegacyStopQueue(identity) {
  const markerKey = legacyMigrationMarkerKey(QUEUE_STORAGE_PREFIX, identity);
  const marker = await readJson(markerKey, null);
  if (marker?.completedAt) return;

  const legacy = await readJson(LEGACY_QUEUE_STORAGE_KEY, []);
  const legacyOperations = Array.isArray(legacy) ? legacy : [];
  const matching = [];
  const quarantined = [];
  const companyDriverNumber = cleanIdentity(identity.companyDriverNumber);

  legacyOperations.forEach((operation) => {
    if (cleanIdentity(operation.driverId) === companyDriverNumber) {
      matching.push(withTenantOperationMetadata(operation, identity, operation.payloadVersion || 1));
    } else {
      quarantined.push(operation);
    }
  });

  if (matching.length) {
    const current = await readJson(queueStorageKey(identity), []);
    const currentIds = new Set((Array.isArray(current) ? current : []).map((operation) => operation.id));
    const merged = [
      ...(Array.isArray(current) ? current : []),
      ...matching.filter((operation) => !currentIds.has(operation.id)),
    ];
    await writeJson(queueStorageKey(identity), merged);
  }

  if (quarantined.length) {
    await writeJson(legacyQuarantineKey(QUEUE_STORAGE_PREFIX, 'route-stop-queue'), {
      reason: 'Legacy route stop queue did not match authenticated driver context.',
      createdAt: new Date().toISOString(),
      operations: quarantined,
    });
  }

  await writeJson(markerKey, {
    completedAt: new Date().toISOString(),
    migratedCount: matching.length,
    quarantinedCount: quarantined.length,
    sourceKey: LEGACY_QUEUE_STORAGE_KEY,
  });
}

let queueMutation = Promise.resolve();

async function mutateQueue(identity, mutator) {
  const execute = async () => {
    await migrateLegacyStopQueue(identity);
    const key = queueStorageKey(identity);
    const current = await readJson(key, []);
    const operations = Array.isArray(current) ? current : [];
    const next = await mutator(operations);
    await writeJson(key, Array.isArray(next) ? next : operations);
    return next;
  };
  queueMutation = queueMutation.then(execute, execute);
  return queueMutation;
}

export async function readPendingStopOperations(options = {}) {
  const identity = requireTenantIdentity(options);
  await queueMutation;
  await migrateLegacyStopQueue(identity);
  const operations = await readJson(queueStorageKey(identity), []);
  return (Array.isArray(operations) ? operations : []).filter((operation) => operationMatchesTenant(operation, identity));
}

export async function enqueueStopStatusOperation(stopId, payload = {}, options = {}) {
  const identity = requireTenantIdentity(options);
  const operation = withTenantOperationMetadata({
    id: createOperationId(),
    stopId: cleanIdentity(stopId),
    routeId: cleanIdentity(options.routeId || payload.routeId || payload.manifestId),
    payload: {
      ...payload,
      clientUpdatedAt: payload.clientUpdatedAt || new Date().toISOString(),
    },
    driverId: identity.companyDriverNumber,
    driverName: cleanIdentity(options.driverName),
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  }, identity, 2);

  if (!operation.stopId || !operation.companyDriverNumber) {
    throw new Error('A stop ID and driver ID are required to save an offline stop update.');
  }

  await mutateQueue(identity, (operations) => [...operations, operation]);
  return operation;
}

export async function removePendingStopOperation(operationId, options = {}) {
  const identity = requireTenantIdentity(options);
  await mutateQueue(identity, (operations) => operations.filter((operation) => operation.id !== operationId));
}

export async function markPendingStopOperationFailed(operationId, message, options = {}) {
  const identity = requireTenantIdentity(options);
  await mutateQueue(identity, (operations) => operations.map((operation) => (
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

export async function cacheAssignedRoute(route, { driverId, routeDate, ...options } = {}) {
  if (!route) return;
  const identity = requireTenantIdentity({ ...options, driverId });
  const effectiveRouteDate = routeDate || route.routeDate;
  const cached = {
    route,
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    cachedAt: new Date().toISOString(),
  };
  await writeJson(routeCacheKey(identity, effectiveRouteDate), cached);
  await writeJson(routeCacheKey(identity, 'today'), cached);
}

async function readLegacyAssignedRoute(identity, routeDate) {
  const cached = await readJson(legacyRouteCacheKey(identity.companyDriverNumber, routeDate || 'today'), null);
  if (!cached?.route) return null;
  await cacheAssignedRoute(cached.route, { driverId: identity.companyDriverNumber, routeDate: routeDate || cached.route.routeDate });
  return cached.route;
}

export async function readCachedAssignedRoute({ driverId, routeDate, ...options } = {}) {
  const identity = requireTenantIdentity({ ...options, driverId });
  const cached = await readJson(routeCacheKey(identity, routeDate || 'today'), null);
  let route = null;
  if (cached?.route) {
    if (!cachedRouteMatchesTenant(cached, identity)) {
      await quarantineMismatchedRouteCache(cached, identity, routeDate);
      return null;
    }
    route = cached.route;
  }
  if (!route) route = await readLegacyAssignedRoute(identity, routeDate);
  if (!routeDate && route?.routeDate) {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    if (route.routeDate !== today) return null;
  }
  return route;
}

function operationMatchesRoute(operation, route, options = {}) {
  const requestedDriverId = cleanIdentity(options.driverId || options.companyDriverNumber);
  const operationDriverId = cleanIdentity(operation.companyDriverNumber || operation.driverId);
  const operationRouteDate = cleanIdentity(operation.payload?.routeDate);
  const routeDate = cleanIdentity(route?.routeDate || options.routeDate);

  if (requestedDriverId && operationDriverId && requestedDriverId !== operationDriverId) {
    return false;
  }
  return !operationRouteDate || !routeDate || operationRouteDate === routeDate;
}

export async function applyPendingStopOperations(route, options = {}) {
  if (!route || !Array.isArray(route.stops)) return route;

  const operations = await readPendingStopOperations(options);
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
  const operations = await readPendingStopOperations(options);
  return operations.length;
}
