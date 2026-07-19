const fs = require('fs');
const path = require('path');

function readLocalEnv() {
  const envPath = path.join(__dirname, '.env');
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

const localEnv = readLocalEnv();

function envValue(name) {
  return process.env[name] || localEnv[name] || '';
}

module.exports = ({ config }) => {
  const buildProfile = envValue('EAS_BUILD_PROFILE');
  const appEnvironment =
    envValue('EXPO_PUBLIC_APP_ENV') ||
    (buildProfile === 'production' ? 'production' : buildProfile === 'preview' ? 'preview' : 'development');
  const isStandaloneEnvironment = appEnvironment === 'preview' || appEnvironment === 'production';
  const apiBaseUrl = envValue('EXPO_PUBLIC_API_BASE_URL').replace(/\/+$/, '');
  const androidGoogleMapsApiKey =
    envValue('EXPO_PUBLIC_ANDROID_MAPS_API_KEY') ||
    envValue('ANDROID_MAPS_API_KEY');

  if (!androidGoogleMapsApiKey) {
    throw new Error('EXPO_PUBLIC_ANDROID_MAPS_API_KEY is required for Android Google Maps builds.');
  }
  if (isStandaloneEnvironment && !/^https:\/\//i.test(apiBaseUrl)) {
    throw new Error('Preview and production builds require an HTTPS EXPO_PUBLIC_API_BASE_URL.');
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      appEnvironment,
      apiBaseUrl,
    },
    android: {
      ...config.android,
    },
    plugins: [
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Truck-Safe Routing to attach delivery photos for future drivers.',
          cameraPermission: 'Allow Truck-Safe Routing to take delivery and hazard photos in the app.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Truck-Safe Routing to scan product barcodes for verified truck inventory and deliveries.',
          recordAudioAndroid: false,
        },
      ],
      'expo-secure-store',
      ...(!isStandaloneEnvironment ? ['./plugins/withTruckSafeNetworkSecurity'] : []),
    ],
  };
};
