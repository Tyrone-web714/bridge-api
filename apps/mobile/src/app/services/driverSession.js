import * as SecureStore from 'expo-secure-store';
import {
  isTrustedTenantContext,
  normalizeDriverSession,
  tenantIdentityFromSession,
} from './tenantContext';

const SESSION_KEY = 'truck-safe-routing-driver-session-v1';
const DEVICE_KEY = 'truck-safe-routing-device-id-v1';

let activeSession = null;
let deviceId = null;

function createDeviceId() {
  return `tsr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isUsableSession(session) {
  const normalized = normalizeDriverSession(session || {});
  const expiresAt = Date.parse(normalized?.expiresAt || '');
  return Boolean(
    normalized?.token
    && normalized?.driver?.driverId
    && isTrustedTenantContext(normalized.tenantContext)
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now()
  );
}

export async function initializeDriverSession() {
  deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!deviceId) {
    deviceId = createDeviceId();
    await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
  }

  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;
  try {
    const parsed = normalizeDriverSession(JSON.parse(stored));
    if (!isUsableSession(parsed)) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    activeSession = parsed;
    return activeSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export function getDriverSessionHeaders() {
  if (!isUsableSession(activeSession)) return {};
  return {
    Authorization: `Bearer ${activeSession.token}`,
  };
}

export function getActiveDriverSession() {
  return isUsableSession(activeSession) ? activeSession : null;
}

export function getDriverTenantContext() {
  if (!isUsableSession(activeSession)) return null;
  return tenantIdentityFromSession(activeSession);
}

export async function loginDriverSession(apiBaseUrl, { driverId, pin }) {
  if (!deviceId) await initializeDriverSession();
  const response = await fetch(`${apiBaseUrl}/api/driver-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driverId: String(driverId || '').trim(),
      pin: String(pin || ''),
      deviceId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `Driver login failed. HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const normalizedSession = normalizeDriverSession({
    token: data.token,
    expiresAt: data.expiresAt,
    driver: data.driver,
    permissions: data.permissions,
    sessionId: data.sessionId,
    deviceId,
  });
  if (!isTrustedTenantContext(normalizedSession.tenantContext)) {
    throw new Error('Driver login did not return trusted Organization context. Update the backend before continuing.');
  }

  activeSession = normalizedSession;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(activeSession));
  return activeSession;
}

export async function logoutDriverSession(apiBaseUrl) {
  const token = activeSession?.token;
  activeSession = null;
  await SecureStore.deleteItemAsync(SESSION_KEY);
  if (!token) return;
  await fetch(`${apiBaseUrl}/api/driver-auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null);
}
