import { API_BASE_URL, jsonApiHeaders } from '../config/api';

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const AUTOCOMPLETE_REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out. Check that the backend and Google Places API are responding.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(url, {
        ...options,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Check that the backend and Google Places API are responding.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function fetchRecentDestinations() {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/places/recent-destinations`, { headers: jsonApiHeaders() });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Recent destinations failed. HTTP ${response.status}`);
  }
  return Array.isArray(data.destinations) ? data.destinations : [];
}

export async function fetchBackendHealth() {
  const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 6000);
  const data = await readJson(response);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

export async function fetchDestinationDetails({ placeId, address, label, types }) {
  const query = new URLSearchParams();
  if (placeId) query.set('placeId', placeId);
  if (address) query.set('address', address);
  if (label) query.set('label', label);
  if (Array.isArray(types) && types.length) query.set('types', types.join(','));

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/places/details?${query.toString()}`, { headers: jsonApiHeaders() });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Destination details unavailable');
  }
  return data.place || null;
}

export async function fetchDeliveryNotesForDestination({ accountNumber, placeId, address }) {
  const query = new URLSearchParams();
  if (accountNumber) query.set('accountNumber', accountNumber);
  if (placeId) query.set('placeId', placeId);
  if (address) query.set('destination', address);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/delivery-notes?${query.toString()}`,
    { headers: jsonApiHeaders() }
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Delivery notes unavailable');
  }
  return Array.isArray(data.notes) ? data.notes : [];
}

export async function fetchAddressPredictions({ input, sessionToken, maxResults }) {
  const query = new URLSearchParams({
    input,
    sessiontoken: sessionToken,
  });

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/places/autocomplete?${query.toString()}`,
    { headers: jsonApiHeaders() },
    AUTOCOMPLETE_REQUEST_TIMEOUT_MS
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Address lookup failed. HTTP ${response.status}`);
  }

  return Array.isArray(data.predictions)
    ? data.predictions.slice(0, maxResults)
    : [];
}

export async function saveRecentDestinationRecord(payload) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/places/recent-destinations`,
    {
      method: 'POST',
      headers: jsonApiHeaders(),
      body: JSON.stringify(payload),
    }
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `Recent destination save failed. HTTP ${response.status}`);
  }
  return Array.isArray(data.destinations) ? data.destinations : [];
}
