import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, jsonApiHeaders } from '../config/api';

const ROUTING_REQUEST_TIMEOUT_MS = 20000;
const ROUTING_BACKGROUND_TIMEOUT_MS = 8000;
const ROUTE_EVENT_QUEUE_KEY = '@truck-safe-routing/route-events/v1';
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

async function readRouteEventQueue() {
  try {
    const value = await AsyncStorage.getItem(ROUTE_EVENT_QUEUE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRouteEventQueue(queue) {
  await AsyncStorage.setItem(
    ROUTE_EVENT_QUEUE_KEY,
    JSON.stringify(queue.slice(-ROUTE_EVENT_QUEUE_LIMIT))
  );
}

async function enqueueRouteEvent(sessionId, payload) {
  const queue = await readRouteEventQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId,
    payload,
  });
  await writeRouteEventQueue(queue);
}

async function flushRouteEventQueue() {
  const queue = await readRouteEventQueue();
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
    await writeRouteEventQueue(queue.slice(sentCount));
  }
}

export function recordRouteEvent(sessionId, payload) {
  const operation = routeEventQueueChain.catch(() => {}).then(async () => {
    await flushRouteEventQueue();
    try {
      const result = await postRoutingJson(
        `route-sessions/${encodeURIComponent(sessionId)}/events`,
        payload
      );
      if (!result.response.ok) {
        await enqueueRouteEvent(sessionId, payload);
      }
      return result;
    } catch (error) {
      await enqueueRouteEvent(sessionId, payload);
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
