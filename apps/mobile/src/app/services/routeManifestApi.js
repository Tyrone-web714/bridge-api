import { API_BASE_URL, jsonApiHeaders } from '../config/api';
import {
  applyPendingStopOperations,
  cacheAssignedRoute,
  enqueueStopStatusOperation,
  markPendingStopOperationFailed,
  readCachedAssignedRoute,
  readPendingStopOperations,
  removePendingStopOperation,
} from './routeManifestOfflineStore';
import {
  cacheStopDelivery,
  enqueueDeliveryOperation,
  markDeliveryOperationFailed,
  readCachedStopDelivery,
  readPendingDeliveryOperations,
  cacheBarcodeProduct,
  readCachedBarcodeProduct,
  removePendingDeliveryOperation,
} from './deliveryOfflineStore';

const ASSIGNED_ROUTE_TIMEOUT_MS = 25000;
const STOP_STATUS_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}, timeoutMs = ASSIGNED_ROUTE_TIMEOUT_MS, timeoutMessage = 'Request timed out. Check backend connectivity.') {
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
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function apiError(message, response) {
  const error = new Error(message);
  error.status = response?.status || 0;
  return error;
}

function driverOverrideHeaders({ driverId, driverName } = {}) {
  const headers = {};
  const cleanedDriverId = String(driverId || '').trim();
  const cleanedDriverName = String(driverName || '').trim();

  if (cleanedDriverId) headers['X-TSR-Driver-Id'] = cleanedDriverId;
  if (cleanedDriverName) headers['X-TSR-Driver-Name'] = cleanedDriverName;

  return headers;
}

export async function fetchAssignedDriverRoute({ routeDate, driverId, driverName } = {}) {
  const query = new URLSearchParams();
  if (routeDate) query.set('date', routeDate);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/route-manifests/driver/today${suffix}`, {
      headers: jsonApiHeaders(driverOverrideHeaders({ driverId, driverName })),
    }, ASSIGNED_ROUTE_TIMEOUT_MS, 'Assigned route request timed out. Check backend connectivity.');
    const data = await readJson(response);
    if (!response.ok) {
      throw apiError(data?.error || `Assigned route failed. HTTP ${response.status}`, response);
    }
    if (data.route) {
      await cacheAssignedRoute(data.route, { driverId, routeDate: data.route.routeDate || routeDate });
    }
    return applyPendingStopOperations(data.route || null, { driverId, routeDate });
  } catch (error) {
    const cachedRoute = await readCachedAssignedRoute({ driverId, routeDate });
    if (!cachedRoute) throw error;
    const route = await applyPendingStopOperations(cachedRoute, { driverId, routeDate });
    return {
      ...route,
      loadedFromOfflineCache: true,
    };
  }
}

export async function fetchAssignedDriverRouteFromDates({ routeDates = [], driverId, driverName } = {}) {
  let lastError = null;
  const uniqueDates = [...new Set(routeDates.filter(Boolean))];

  for (const routeDate of uniqueDates) {
    try {
      const route = await fetchAssignedDriverRoute({ routeDate, driverId, driverName });
      if (route) return route;
    } catch (error) {
      lastError = error;
      break;
    }
  }

  if (lastError) throw lastError;
  return null;
}

export async function sendAssignedRouteStopStatus(stopId, payload, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/route-manifests/driver/stops/${encodeURIComponent(stopId)}/status`, {
    method: 'PUT',
    headers: jsonApiHeaders(driverOverrideHeaders(options)),
    body: JSON.stringify(payload || {}),
  }, STOP_STATUS_TIMEOUT_MS, 'Stop update timed out. The app could not confirm the backend saved this stop.');
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Stop status update failed. HTTP ${response.status}`, response);
  }
  return data;
}

let activeFlushPromise = null;

export async function flushPendingStopStatusUpdates() {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const operations = await readPendingStopOperations();
    if (!operations.length) {
      return { synced: 0, remaining: 0, results: {} };
    }

    const results = {};
    let synced = 0;

    for (const operation of operations) {
      try {
        const result = await sendAssignedRouteStopStatus(
          operation.stopId,
          {
            ...operation.payload,
            clientOperationId: operation.id,
          },
          {
            driverId: operation.driverId,
            driverName: operation.driverName,
          }
        );
        if (result?.route) {
          await cacheAssignedRoute(result.route, {
            driverId: operation.driverId,
            routeDate: result.route.routeDate || operation.payload?.routeDate,
          });
        }
        results[operation.id] = result;
        synced += 1;
        await removePendingStopOperation(operation.id, operation);
      } catch (error) {
        const isLegacyCompletionBlocked =
          error?.status === 409
          && ['completed', 'departed', 'undelivered'].includes(
            String(operation.payload?.status || '').toLowerCase()
          );
        if (isLegacyCompletionBlocked) {
          await removePendingStopOperation(operation.id, operation);
          continue;
        }
        await markPendingStopOperationFailed(operation.id, error.message, operation);
        break;
      }
    }

    const remaining = await readPendingStopOperations();
    return {
      synced,
      remaining: remaining.length,
      results,
    };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}

export async function updateAssignedRouteStopStatus(stopId, payload, options = {}) {
  const operation = await enqueueStopStatusOperation(stopId, payload, options);
  const cachedRoute = await readCachedAssignedRoute({
    driverId: options.driverId,
    routeDate: payload?.routeDate,
  });
  const optimisticRoute = await applyPendingStopOperations(cachedRoute, {
    driverId: options.driverId,
    routeDate: payload?.routeDate,
  });
  flushPendingStopStatusUpdates().catch(() => {
    // The operation is already durable and will be retried by the app lifecycle sync.
  });

  return {
    ok: true,
    queued: true,
    operationId: operation.id,
    stop: {
      id: stopId,
      ...(payload || {}),
      pendingSync: true,
    },
    route: optimisticRoute,
  };
}

export async function fetchStopDeliverySettlement(stopId, options = {}) {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/route-manifests/driver/stops/${encodeURIComponent(stopId)}/delivery`,
      {
        headers: jsonApiHeaders(driverOverrideHeaders(options)),
      },
      STOP_STATUS_TIMEOUT_MS,
      'Delivery details timed out. Check the connection and try again.'
    );
    const data = await readJson(response);
    if (!response.ok) {
      throw apiError(data?.error || `Delivery details failed. HTTP ${response.status}`, response);
    }
    await cacheStopDelivery(stopId, options.driverId, data, options);
    return data;
  } catch (error) {
    if (error?.status) throw error;
    const cached = await readCachedStopDelivery(stopId, options.driverId, options);
    if (!cached) throw error;
    return {
      ...cached,
      loadedFromOfflineCache: true,
    };
  }
}

export async function lookupProductByBarcode(barcode, options = {}) {
  const value = String(barcode || '').trim();
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/route-manifests/driver/products/lookup?barcode=${encodeURIComponent(value)}`,
      { headers: jsonApiHeaders(driverOverrideHeaders(options)) },
      STOP_STATUS_TIMEOUT_MS,
      'Product lookup timed out.'
    );
    const data = await readJson(response);
    if (!response.ok) throw apiError(data?.error || `Product lookup failed. HTTP ${response.status}`, response);
    await cacheBarcodeProduct(value, data.product, options);
    return data.product;
  } catch (error) {
    if (error?.status) throw error;
    const cached = await readCachedBarcodeProduct(value, options);
    if (!cached) throw error;
    return { ...cached, loadedFromOfflineCache: true };
  }
}

export async function fetchRouteTruckInventory(manifestId, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/truck-inventory`,
    { headers: jsonApiHeaders(driverOverrideHeaders(options)) },
    STOP_STATUS_TIMEOUT_MS,
    'Truck inventory request timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Truck inventory failed. HTTP ${response.status}`, response);
  return {
    items: data.items || [],
    confirmation: data.confirmation || null,
  };
}

export async function confirmDepartureInventory(manifestId, credentials, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/departure-inventory/confirm`,
    {
      method: 'POST',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify(credentials || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Departure inventory confirmation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Inventory confirmation failed. HTTP ${response.status}`, response);
  return data.document || data.confirmation || null;
}

export async function confirmDepartureInventoryPrint(manifestId, printConfirmationToken, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/departure-inventory/confirm-print`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify({ printConfirmationToken }),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Departure inventory print confirmation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Print confirmation failed. HTTP ${response.status}`, response);
  return data.confirmation || null;
}

export async function accessWarehouseDepartureInventory(credentials) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/warehouse/departure-inventory/access`,
    {
      method: 'POST',
      headers: jsonApiHeaders(),
      body: JSON.stringify(credentials || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Warehouse inventory login timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Warehouse inventory login failed. HTTP ${response.status}`, response);
  return data;
}

export async function confirmWarehouseDepartureInventory(credentials) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/warehouse/departure-inventory/confirm`,
    {
      method: 'POST',
      headers: jsonApiHeaders(),
      body: JSON.stringify(credentials || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Warehouse inventory confirmation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Warehouse inventory confirmation failed. HTTP ${response.status}`, response);
  return data.document || data.confirmation || null;
}

export async function confirmWarehouseDepartureInventoryPrint(credentials) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/warehouse/departure-inventory/confirm-print`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(),
      body: JSON.stringify(credentials || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Warehouse print confirmation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Warehouse print confirmation failed. HTTP ${response.status}`, response);
  return data.confirmation || null;
}

export async function prepareWarehouseReturnInventory(payload) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/warehouse/return-inventory/prepare`,
    {
      method: 'POST',
      headers: jsonApiHeaders(),
      body: JSON.stringify(payload || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Return inventory preparation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Return inventory preparation failed. HTTP ${response.status}`, response);
  return data.document || null;
}

export async function confirmWarehouseReturnInventoryPrint(payload) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/warehouse/return-inventory/confirm-print`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(),
      body: JSON.stringify(payload || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Return inventory print confirmation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Return inventory print confirmation failed. HTTP ${response.status}`, response);
  return data.document || null;
}

async function sendRouteTruckInventoryAddition(manifestId, payload, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/truck-inventory/additions`,
    {
      method: 'POST',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify(payload),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Truck inventory addition timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) throw apiError(data?.error || `Truck inventory addition failed. HTTP ${response.status}`, response);
  return data;
}

export async function addRouteTruckInventory(manifestId, payload, options = {}) {
  const operation = await enqueueDeliveryOperation('truck_inventory_addition', { manifestId, addition: payload }, options);
  try {
    const data = await sendRouteTruckInventoryAddition(
      manifestId,
      { ...payload, clientOperationId: operation.id },
      options
    );
    await removePendingDeliveryOperation(operation.id, operation);
    return data;
  } catch (error) {
    if (error?.status) {
      await removePendingDeliveryOperation(operation.id, operation);
      throw error;
    }
    return { ok: true, queued: true, operationId: operation.id, items: [] };
  }
}

async function sendStopDeliverySettlement(stopId, payload, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/stops/${encodeURIComponent(stopId)}/delivery`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify(payload || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Delivery settlement timed out. The stop was not closed; check the connection and try again.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Delivery settlement failed. HTTP ${response.status}`, response);
  }
  await cacheStopDelivery(stopId, options.driverId, data, options);
  return data;
}

export async function saveStopDeliverySettlement(stopId, payload, options = {}) {
  try {
    return await sendStopDeliverySettlement(stopId, payload, options);
  } catch (error) {
    if (error?.status) throw error;
    const operation = await enqueueDeliveryOperation(
      'delivery_settlement_save',
      { stopId, settlement: payload },
      options
    );
    const cached = await readCachedStopDelivery(stopId, options.driverId, options);
    const optimistic = cached
      ? {
          ...cached,
          settlement: {
            ...(cached.settlement || {}),
            ...(payload || {}),
            items: payload?.items || cached.settlement?.items || [],
            pendingSync: true,
          },
        }
      : {
          ok: true,
          stop: { id: stopId },
          order: null,
          settlement: { ...(payload || {}), pendingSync: true },
        };
    await cacheStopDelivery(stopId, options.driverId, optimistic, options);
    return {
      ...optimistic,
      ok: true,
      queued: true,
      operationId: operation.id,
      route: null,
    };
  }
}

async function sendCreateDeliveryDocument(stopId, documentType, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/stops/${encodeURIComponent(stopId)}/documents`,
    {
      method: 'POST',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify({ documentType }),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Delivery document request timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Delivery document failed. HTTP ${response.status}`, response);
  }
  return data;
}

export async function createStopDeliveryDocument(stopId, documentType, options = {}) {
  try {
    return await sendCreateDeliveryDocument(stopId, documentType, options);
  } catch (error) {
    if (error?.status) throw error;
    const operation = await enqueueDeliveryOperation(
      'delivery_document_create',
      { stopId, documentType },
      options
    );
    return { ok: true, queued: true, operationId: operation.id, document: null };
  }
}

export async function fetchStopDeliveryDocuments(stopId, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/stops/${encodeURIComponent(stopId)}/documents`,
    {
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Saved delivery documents timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Saved documents failed. HTTP ${response.status}`, response);
  }
  return Array.isArray(data.documents) ? data.documents : [];
}

export async function fetchRouteCloseoutDocument(manifestId, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/closeout`,
    {
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Route turn-in receipt request timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Route turn-in receipt failed. HTTP ${response.status}`, response);
  }
  return data.document || null;
}

export async function prepareFinalInventoryCloseout(manifestId, payload, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/inventory-closeout`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify(payload || {}),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Final inventory closeout preparation timed out.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Final inventory closeout failed. HTTP ${response.status}`, response);
  }
  return data.document || null;
}

export async function confirmFinalInventoryCloseoutPrint(manifestId, printConfirmationToken, options = {}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/route-manifests/driver/routes/${encodeURIComponent(manifestId)}/inventory-closeout/confirm-print`,
    {
      method: 'PUT',
      headers: jsonApiHeaders(driverOverrideHeaders(options)),
      body: JSON.stringify({ printConfirmationToken }),
    },
    STOP_STATUS_TIMEOUT_MS,
    'Zebra print confirmation timed out. Keep this screen open and retry.'
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw apiError(data?.error || `Print confirmation failed. HTTP ${response.status}`, response);
  }
  return data.document || null;
}
let activeDeliveryFlushPromise = null;

export async function flushPendingDeliveryOperations() {
  if (activeDeliveryFlushPromise) return activeDeliveryFlushPromise;
  activeDeliveryFlushPromise = (async () => {
    const operations = (await readPendingDeliveryOperations()).filter((operation) => (
      operation.type === 'delivery_settlement_save'
      || operation.type === 'delivery_document_create'
      || operation.type === 'truck_inventory_addition'
    ));
    let synced = 0;
    for (const operation of operations) {
      try {
        if (operation.type === 'truck_inventory_addition') {
          await sendRouteTruckInventoryAddition(
            operation.payload.manifestId,
            { ...(operation.payload.addition || {}), clientOperationId: operation.id },
            operation
          );
        } else if (operation.type === 'delivery_settlement_save') {
          await sendStopDeliverySettlement(
            operation.payload.stopId,
            {
              ...(operation.payload.settlement || {}),
              clientOperationId: operation.id,
            },
            operation
          );
        } else {
          await sendCreateDeliveryDocument(
            operation.payload.stopId,
            operation.payload.documentType,
            operation
          );
        }
        await removePendingDeliveryOperation(operation.id, operation);
        synced += 1;
      } catch (error) {
        await markDeliveryOperationFailed(operation.id, error.message, operation);
        break;
      }
    }
    return { synced };
  })();
  try {
    return await activeDeliveryFlushPromise;
  } finally {
    activeDeliveryFlushPromise = null;
  }
}

export async function askDriverCopilot(payload, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/ai/driver-copilot`, {
    method: 'POST',
    headers: jsonApiHeaders(driverOverrideHeaders(options)),
    body: JSON.stringify(payload || {}),
  }, ASSIGNED_ROUTE_TIMEOUT_MS, 'Driver copilot request timed out. Check backend connectivity.');
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Driver copilot failed. HTTP ${response.status}`);
  }
  return data;
}
