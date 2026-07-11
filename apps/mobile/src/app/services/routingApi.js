import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, jsonApiHeaders } from '../config/api';
import { getDriverTenantContext } from './driverSession';
import {
  isTrustedTenantContext,
  legacyMigrationMarkerKey,
  legacyQuarantineKey,
  operationMatchesTenant,
  tenantScopedStorageKey,
  withTenantOperationMetadata,
} from './tenantContext';

const ROUTING_REQUEST_TIMEOUT_MS = 20000;
const ROUTING_BACKGROUND_TIMEOUT_MS = 8000;
const LEGACY_ROUTE_EVENT_QUEUE_KEY = '@truck-safe-routing/route-events/v1';
const ROUTE_EVENT_QUEUE_PREFIX = '@truck-safe-routing/route-events/v2';
const ROUTE_EVENT_QUEUE_LIMIT = 2500;
let routeEventQueueChain = Promise.resolve();

export async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text.slice(0, 240),
    };
  }
}

function routingUrl(path, query = null) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const queryString = query ? `?${query.toString()}` : '';
  return `${API_BASE_URL}/api/routing/${cleanPath}${queryString}`;
}

function requireTenantIdentity() {
  const identity = getDriverTenantContext();
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required for route event synchronization.');
  }
  return identity;
}

function routeEventQueueKey(identity) {
  return tenantScopedStorageKey(ROUTE_EVENT_QUEUE_PREFIX, identity, 'queue');
}

async function fetchRoutingWithTimeout(url, options = {}, timeoutMs = ROUTING_BACKGROUND_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Backend request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function postRoutingJson(path, payload, timeoutMs = ROUTING_BACKGROUND_TIMEOUT_MS) {
  const response = await fetchRoutingWithTimeout(
    routingUrl(path),
    {
      method: 'POST',
      headers: jsonApiHeaders(),
      body: JSON.stringify(payload),
    },
    timeoutMs
  );
  const data = await readJsonResponse(response);
  return { response, data };
}

async function readJson(key, fallback) {
  try {
    const value = await AsyncStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : fallback;
    return Array.isArray(parsed) || parsed ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function migrateLegacyRouteEvents(identity) {
  const markerKey = legacyMigrationMarkerKey(ROUTE_EVENT_QUEUE_PREFIX, identity);
  const marker = await readJson(markerKey, null);
  if (marker?.completedAt) return;

  const legacyQueue = await readJson(LEGACY_ROUTE_EVENT_QUEUE_KEY, []);
  const legacyEvents = Array.isArray(legacyQueue) ? legacyQueue : [];
  if (legacyEvents.length) {
    await writeJson(legacyQuarantineKey(ROUTE_EVENT_QUEUE_PREFIX, 'route-events-ambiguous'), {
      reason: 'Legacy route events did not contain trusted Organization and internal driver context.',
      createdAt: new Date().toISOString(),
      sourceKey: LEGACY_ROUTE_EVENT_QUEUE_KEY,
      events: legacyEvents,
    });
  }

  await writeJson(markerKey, {
    completedAt: new Date().toISOString(),
    migratedCount: 0,
    quarantinedCount: legacyEvents.length,
    sourceKey: LEGACY_ROUTE_EVENT_QUEUE_KEY,
  });
}

async function readRouteEventQueue(identity) {
  await migrateLegacyRouteEvents(identity);
  const parsed = await readJson(routeEventQueueKey(identity), []);
  return (Array.isArray(parsed) ? parsed : []).filter((entry) => operationMatchesTenant(entry, identity));
}

async function writeRouteEventQueue(identity, queue) {
  await writeJson(
    routeEventQueueKey(identity),
    queue.filter((entry) => operationMatchesTenant(entry, identity)).slice(-ROUTE_EVENT_QUEUE_LIMIT)
  );
}

async function enqueueRouteEvent(sessionId, payload, identity) {
  const queue = await readRouteEventQueue(identity);
  queue.push(withTenantOperationMetadata({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId,
    payload,
    createdAt: new Date().toISOString(),
  }, identity, 2));
  await writeRouteEventQueue(identity, queue);
}

async function flushRouteEventQueue(identity) {
  const queue = await readRouteEventQueue(identity);
  if (!queue.length) return;

  let sentCount = 0;
  for (const entry of queue) {
    try {
      const { response } = await postRoutingJson(
        `route-sessions/${encodeURIComponent(entry.sessionId)}/events`,
        entry.payload
      );
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          sentCount += 1;
          continue;
        }
        break;
      }
      sentCount += 1;
    } catch {
      break;
    }
  }

  if (sentCount > 0) {
    await writeRouteEventQueue(identity, queue.slice(sentCount));
  }
}

export function recordRouteEvent(sessionId, payload) {
  const operation = routeEventQueueChain.catch(() => {}).then(async () => {
    const identity = requireTenantIdentity();
    await flushRouteEventQueue(identity);
    try {
      const result = await postRoutingJson(
        `route-sessions/${encodeURIComponent(sessionId)}/events`,
        payload
      );
      if (!result.response.ok) {
        await enqueueRouteEvent(sessionId, payload, identity);
      }
      return result;
    } catch (error) {
      await enqueueRouteEvent(sessionId, payload, identity);
      throw error;
    }
  });
  routeEventQueueChain = operation.catch(() => {});
  return operation;
}

export async function fetchHazardsInBounds(bounds, limit) {
  const query = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
    limit: String(limit),
  });
  const response = await fetchRoutingWithTimeout(routingUrl('hazards-in-bounds', query));
  const data = await readJsonResponse(response);
  return response.ok ? data : null;
}

export async function fetchHazardsNearCoordinate(coordinate, radiusMeters) {
  const query = new URLSearchParams({
    lat: String(coordinate.latitude),
    lng: String(coordinate.longitude),
    radiusm: String(radiusMeters),
  });
  const response = await fetchRoutingWithTimeout(routingUrl('hazards-near', query));
  const data = await readJsonResponse(response);
  return response.ok ? data : null;
}

export async function submitDriverHazardReport(payload) {
  const { response, data } = await postRoutingJson('manual-hazards/report', payload);
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

export async function requestSafeRoute(payload) {
  return postRoutingJson('safe-route', payload, ROUTING_REQUEST_TIMEOUT_MS);
}
