import { NativeModules, Platform } from 'react-native';
import { getDriverSessionHeaders } from '../services/driverSession';

const BACKEND_PORT = 5000;

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, '');
}

function getConfiguredBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  return normalizeBaseUrl(configuredUrl);
}

function getMetroHost() {
  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  const match = scriptUrl?.match(/^https?:\/\/([^:/?#]+)(?::\d+)?/);
  return match?.[1] || null;
}

function getDevelopmentBaseUrl() {
  const metroHost = getMetroHost();
  if (metroHost) {
    return `http://${metroHost}:${BACKEND_PORT}`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

const configuredBaseUrl = getConfiguredBaseUrl();
if (!configuredBaseUrl && !__DEV__ && Platform.OS !== 'web') {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is required in standalone builds.');
}

export const API_BASE_URL = configuredBaseUrl || getDevelopmentBaseUrl();
export const DRIVER_ID = process.env.EXPO_PUBLIC_DRIVER_ID || 'driver_app';
export const DRIVER_NAME = process.env.EXPO_PUBLIC_DRIVER_NAME || 'Truck-Safe driver';
export const ROUTE_OPERATING_TIME_ZONE =
  process.env.EXPO_PUBLIC_ROUTE_OPERATING_TIMEZONE || 'America/Chicago';

export function jsonApiHeaders(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    ...getDriverSessionHeaders(),
    ...extraHeaders,
  };
}
