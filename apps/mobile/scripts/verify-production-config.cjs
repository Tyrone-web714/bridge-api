const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getConfig } = require('@expo/config');

function readEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const separator = trimmed.indexOf('=');
      if (separator < 0) return acc;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function hasPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized ||
    normalized.includes('your_') ||
    normalized.includes('your-') ||
    normalized.includes('match-the') ||
    normalized.includes('restricted-android') ||
    normalized.includes('localhost') ||
    normalized.includes('10.0.2.2');
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const fileEnv = readEnvFile();
const getEnv = (key) => process.env[key] || fileEnv[key] || '';
const failures = [];
const secretAudit = spawnSync(process.execPath, ['scripts/audit-secrets.cjs'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8'
});

if (secretAudit.status !== 0) {
  failures.push('Secret audit failed; run npm.cmd run verify:secrets for details');
}

const apiBaseUrl = getEnv('EXPO_PUBLIC_API_BASE_URL');
const mapsKey = getEnv('EXPO_PUBLIC_ANDROID_MAPS_API_KEY') || getEnv('ANDROID_MAPS_API_KEY');

if (hasPlaceholder(apiBaseUrl)) {
  failures.push('EXPO_PUBLIC_API_BASE_URL must point to the deployed backend API before a production pilot build');
} else if (!isHttpsUrl(apiBaseUrl)) {
  failures.push('EXPO_PUBLIC_API_BASE_URL must use HTTPS for preview and production builds');
}
if (hasPlaceholder(mapsKey)) {
  failures.push('EXPO_PUBLIC_ANDROID_MAPS_API_KEY must be set for Android map tiles');
}

const appJson = fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8');
const parsedAppJson = JSON.parse(appJson);
const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
const projectRoot = path.join(__dirname, '..');
const routeDateSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'app', 'utils', 'routeDate.js'),
  'utf8'
);
const mapScreenSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'app', 'screens', 'MapScreen.js'),
  'utf8'
);
const apiConfigSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'app', 'config', 'api.js'),
  'utf8'
);
const rootNavigatorSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'app', 'navigation', 'RootNavigator.js'),
  'utf8'
);
const driverSettingsSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'app', 'components', 'DriverSettingsOverlay.js'),
  'utf8'
);
if (apiConfigSource.includes('EXPO_PUBLIC_DRIVER_API_TOKEN')) {
  failures.push('Production mobile code must not embed a shared driver API token');
}
if (!rootNavigatorSource.includes("visible={activeScreen !== 'Landing'}")) {
  failures.push('Shared driver settings must be available on every screen except Landing');
}
for (const requiredSettingsControl of [
  'fetchAssignedDriverRouteFromDates',
  "navigationRef.navigate('RouteInventory'",
  "navigationRef.navigate('HazardReport'",
  'getActiveDriverSession',
]) {
  if (!driverSettingsSource.includes(requiredSettingsControl)) {
    failures.push(`Shared driver settings control is missing: ${requiredSettingsControl}`);
  }
}
if (/AIza[0-9A-Za-z_-]{20,}/.test(appJson)) {
  failures.push('app.json contains a literal Google API key; keep build-time keys in environment variables');
}
if (parsedAppJson?.expo?.android?.allowBackup !== false) {
  failures.push('Android backups must be disabled because offline route data can contain customer and signature records');
}
if (!(parsedAppJson?.expo?.android?.blockedPermissions || []).includes('android.permission.RECORD_AUDIO')) {
  failures.push('Android microphone permission must be blocked because no audio-recording feature is present');
}
if (easJson?.build?.preview?.developmentClient) {
  failures.push('The preview profile must not enable developmentClient');
}
if (easJson?.build?.preview?.env?.EXPO_PUBLIC_API_BASE_URL !== apiBaseUrl) {
  failures.push('The preview profile backend URL must match EXPO_PUBLIC_API_BASE_URL');
}
if (easJson?.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL !== apiBaseUrl) {
  failures.push('The production profile backend URL must match EXPO_PUBLIC_API_BASE_URL');
}
if (easJson?.build?.preview?.env?.EXPO_PUBLIC_APP_ENV !== 'preview') {
  failures.push('The preview profile must set EXPO_PUBLIC_APP_ENV=preview');
}
if (easJson?.build?.production?.env?.EXPO_PUBLIC_APP_ENV !== 'production') {
  failures.push('The production profile must set EXPO_PUBLIC_APP_ENV=production');
}
if (!routeDateSource.includes('return [localRouteDate];')) {
  failures.push('Assigned route lookup must use only the requested local route date');
}
for (const requiredNavigationControl of [
  'LOCATION_TIME_INTERVAL_MS = 500',
  'AUTO_REFOLLOW_AFTER_PAN_MS',
  'onRegionChangeComplete={handleMapRegionChangeComplete}',
  'getNavigationCameraCenter(cameraTruckCoordinate, cameraHeading, speedMph)',
]) {
  if (!mapScreenSource.includes(requiredNavigationControl)) {
    failures.push(`Navigation stability control is missing: ${requiredNavigationControl}`);
  }
}

const originalAppEnvironment = process.env.EXPO_PUBLIC_APP_ENV;
const originalBuildProfile = process.env.EAS_BUILD_PROFILE;
for (const profile of ['preview', 'production']) {
  process.env.EXPO_PUBLIC_APP_ENV = profile;
  process.env.EAS_BUILD_PROFILE = profile;
  const evaluatedConfig = getConfig(projectRoot, { skipSDKVersionRequirement: true }).exp;
  const plugins = evaluatedConfig.plugins || [];
  if (!(evaluatedConfig?.android?.blockedPermissions || []).includes('android.permission.RECORD_AUDIO')) {
    failures.push(`The ${profile} profile must block microphone access`);
  }
  const hasCleartextPlugin = plugins.some((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return String(pluginName).includes('withTruckSafeNetworkSecurity');
  });
  if (hasCleartextPlugin) {
    failures.push(`The ${profile} profile must not include the development cleartext network security plugin`);
  }
}
if (originalAppEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
else process.env.EXPO_PUBLIC_APP_ENV = originalAppEnvironment;
if (originalBuildProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
else process.env.EAS_BUILD_PROFILE = originalBuildProfile;

if (failures.length) {
  console.error('Mobile production config verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Mobile production config verification passed.');
