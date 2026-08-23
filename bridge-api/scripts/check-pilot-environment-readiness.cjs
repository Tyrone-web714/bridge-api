#!/usr/bin/env node
require('dotenv').config();

const assert = require('assert');
const corsPolicy = require('../services/corsPolicy');

const STATUSES = Object.freeze({
  READY: 'READY',
  MISSING_CONFIGURATION: 'MISSING_CONFIGURATION',
  MISSING_SECRET: 'MISSING_SECRET',
  OWNER_DECISION_REQUIRED: 'OWNER_DECISION_REQUIRED',
  EXTERNAL_INFRASTRUCTURE_REQUIRED: 'EXTERNAL_INFRASTRUCTURE_REQUIRED',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  CODE_DEFECT: 'CODE_DEFECT',
  NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE: 'NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE'
});

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized
    || normalized.includes('your_')
    || normalized.includes('choose-')
    || normalized.includes('replace-with')
    || normalized.includes('username:password')
    || normalized.includes('localhost')
    || normalized.includes('127.0.0.1')
    || normalized.includes('<');
}

function hasHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function storageStatus(env) {
  const provider = String(env.PHOTO_STORAGE_PROVIDER || 'local').trim().toLowerCase();
  const issues = [];
  if (!['local', 's3'].includes(provider)) issues.push('unsupported provider');
  if (provider === 's3') {
    for (const key of ['PHOTO_STORAGE_BUCKET', 'PHOTO_STORAGE_REGION']) {
      if (!env[key] || isPlaceholder(env[key])) issues.push(`${key} missing`);
    }
    if (Boolean(env.PHOTO_STORAGE_ACCESS_KEY_ID) !== Boolean(env.PHOTO_STORAGE_SECRET_ACCESS_KEY)) {
      issues.push('paired object-storage credentials missing');
    }
  }
  return { provider, durable: provider === 's3', configured: issues.length === 0, issues };
}

function item(key, purpose, requiredForPilot, valueSource, secret, status, validationRule, owner) {
  return { key, purpose, requiredForPilot, valueSource, secret, status, validationRule, owner };
}

function buildPilotEnvironmentReadiness(env = process.env) {
  const items = [];
  items.push(item(
    'NODE_ENV',
    'Runtime mode for production-like safety behavior.',
    'PILOT_REQUIRED',
    'STATIC_SAFE_CONFIGURATION',
    false,
    env.NODE_ENV === 'production' ? STATUSES.READY : STATUSES.MISSING_CONFIGURATION,
    'Set NODE_ENV=production for the live pilot backend.',
    'infrastructure'
  ));
  items.push(item(
    'DATABASE_URL',
    'Pilot PostgreSQL connection string.',
    'PILOT_REQUIRED',
    'INFRASTRUCTURE_GENERATED / SECRET',
    true,
    !env.DATABASE_URL || isPlaceholder(env.DATABASE_URL) ? STATUSES.MISSING_SECRET : STATUSES.READY,
    'Present, non-placeholder PostgreSQL URL from the approved pilot database provider.',
    'infrastructure'
  ));
  items.push(item(
    'DATABASE_SSL',
    'Hosted PostgreSQL SSL posture.',
    'PILOT_REQUIRED',
    'STATIC_SAFE_CONFIGURATION',
    false,
    env.DATABASE_SSL === 'true' ? STATUSES.READY : STATUSES.MISSING_CONFIGURATION,
    'Set DATABASE_SSL=true unless the approved provider documents otherwise.',
    'infrastructure'
  ));

  let corsStatus = STATUSES.MISSING_CONFIGURATION;
  try {
    const cors = corsPolicy.buildCorsConfig({ ...env, NODE_ENV: 'production' });
    corsStatus = cors.origins.length ? STATUSES.READY : STATUSES.OWNER_DECISION_REQUIRED;
  } catch {
    corsStatus = STATUSES.INVALID_CONFIGURATION;
  }
  items.push(item(
    'CORS_ORIGIN',
    'Explicit HTTPS browser/admin origins allowed by the API.',
    'PILOT_REQUIRED when supervisor/browser UI participates',
    'OWNER_DECISION / DERIVED_FROM_DEPLOYMENT',
    false,
    corsStatus,
    'Comma-separated explicit origins; no wildcard in production.',
    'owner + infrastructure'
  ));

  const apiBase = env.PUBLIC_API_BASE_URL || env.BACKEND_PUBLIC_URL;
  items.push(item(
    'PUBLIC_API_BASE_URL / BACKEND_PUBLIC_URL',
    'Canonical HTTPS API base URL for generated links and mobile configuration alignment.',
    'PILOT_REQUIRED',
    'DERIVED_FROM_DEPLOYMENT',
    false,
    hasHttpsUrl(apiBase) ? STATUSES.READY : STATUSES.OWNER_DECISION_REQUIRED,
    'Approved HTTPS URL for the pilot backend.',
    'owner + infrastructure'
  ));
  items.push(item(
    'GOOGLE_MAPS_API_KEY',
    'Server-side Google Maps routing/geocoding key.',
    'PILOT_REQUIRED',
    'SECRET',
    true,
    !env.GOOGLE_MAPS_API_KEY || isPlaceholder(env.GOOGLE_MAPS_API_KEY) ? STATUSES.MISSING_SECRET : STATUSES.READY,
    'Present server-side key from approved pilot Google project.',
    'owner'
  ));
  items.push(item(
    'ADMIN_DASHBOARD_PASSWORD',
    'Initial/admin dashboard authentication secret.',
    'PILOT_REQUIRED',
    'SECRET',
    true,
    !env.ADMIN_DASHBOARD_PASSWORD || isPlaceholder(env.ADMIN_DASHBOARD_PASSWORD) ? STATUSES.MISSING_SECRET : STATUSES.READY,
    'Present non-placeholder value.',
    'owner + infrastructure'
  ));
  items.push(item(
    'ADMIN_DASHBOARD_SECRET',
    'Cookie/session signing secret.',
    'PILOT_REQUIRED',
    'SECRET',
    true,
    !env.ADMIN_DASHBOARD_SECRET || isPlaceholder(env.ADMIN_DASHBOARD_SECRET) || env.ADMIN_DASHBOARD_SECRET.length < 32
      ? STATUSES.MISSING_SECRET
      : STATUSES.READY,
    'Present non-placeholder value at least 32 characters.',
    'infrastructure'
  ));
  items.push(item(
    'DRIVER_API_TOKEN / TSR_DRIVER_API_TOKEN',
    'Driver app API token fallback for pilot mobile requests.',
    'PILOT_REQUIRED until all driver auth paths are session-only',
    'SECRET',
    true,
    !env.DRIVER_API_TOKEN && !env.TSR_DRIVER_API_TOKEN ? STATUSES.MISSING_SECRET : STATUSES.READY,
    'Present non-placeholder token at least 32 characters.',
    'infrastructure'
  ));
  items.push(item(
    'ALLOW_LEGACY_DRIVER_API_TOKEN',
    'Legacy driver token fallback safety switch.',
    'PILOT_REQUIRED',
    'STATIC_SAFE_CONFIGURATION',
    false,
    String(env.ALLOW_LEGACY_DRIVER_API_TOKEN || '').toLowerCase() === 'true'
      ? STATUSES.INVALID_CONFIGURATION
      : STATUSES.READY,
    'Must not be true for pilot.',
    'engineering'
  ));

  const storage = storageStatus(env);
  items.push(item(
    'PHOTO_STORAGE_PROVIDER',
    'Durable private media storage provider.',
    'PILOT_REQUIRED if photos/media are in pilot scope',
    'STATIC_SAFE_CONFIGURATION',
    false,
    storage.durable ? STATUSES.READY : STATUSES.MISSING_CONFIGURATION,
    'Use PHOTO_STORAGE_PROVIDER=s3 for live pilot media.',
    'infrastructure'
  ));
  items.push(item(
    'PHOTO_STORAGE_BUCKET / REGION / ACCESS KEYS',
    'Private object storage target and credentials.',
    'PILOT_REQUIRED if photos/media are in pilot scope',
    'INFRASTRUCTURE_GENERATED / SECRET',
    true,
    storage.configured && storage.durable ? STATUSES.READY : STATUSES.MISSING_SECRET,
    'Bucket, region, and paired access credentials when provider=s3.',
    'infrastructure'
  ));
  items.push(item(
    'OPENAI_API_KEY and other AI provider keys',
    'Hosted AI provider credentials.',
    'NOT_REQUIRED_FOR_INITIAL_PILOT',
    'SECRET',
    true,
    STATUSES.NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE,
    'D1 is OFF and D2 production routing is OFF/SHADOW_ONLY at most.',
    'owner'
  ));
  items.push(item(
    'rate-limit and body-size settings',
    'Operational request limits.',
    'PILOT_CONDITIONAL',
    'STATIC_SAFE_CONFIGURATION',
    false,
    STATUSES.READY,
    'Defaults exist; tune only if pilot traffic requires it.',
    'engineering'
  ));
  items.push(item(
    'email/notification configuration',
    'Outbound support notifications.',
    'NOT_REQUIRED_FOR_INITIAL_PILOT unless alerting uses email',
    'OWNER_DECISION',
    false,
    STATUSES.NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE,
    'Use external monitoring/support channels unless email is selected.',
    'operations'
  ));

  const blockingStatuses = new Set([
    STATUSES.MISSING_CONFIGURATION,
    STATUSES.MISSING_SECRET,
    STATUSES.OWNER_DECISION_REQUIRED,
    STATUSES.EXTERNAL_INFRASTRUCTURE_REQUIRED,
    STATUSES.INVALID_CONFIGURATION,
    STATUSES.CODE_DEFECT
  ]);
  return {
    status: items.some((entry) => blockingStatuses.has(entry.status)) ? 'BLOCKED' : 'READY',
    readinessStatusModel: Object.values(STATUSES),
    items
  };
}

function runSelfTest() {
  const missing = buildPilotEnvironmentReadiness({});
  assert.strictEqual(missing.status, 'BLOCKED');
  assert.ok(missing.items.some((entry) => entry.key === 'DATABASE_URL' && entry.status === STATUSES.MISSING_SECRET));
  assert.ok(missing.items.some((entry) => entry.key === 'CORS_ORIGIN' && entry.status === STATUSES.OWNER_DECISION_REQUIRED));
  assert.ok(missing.items.some((entry) => entry.key.includes('AI provider') && entry.status === STATUSES.NOT_REQUIRED_FOR_SELECTED_PILOT_SCOPE));

  const ready = buildPilotEnvironmentReadiness({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://pilot-db.example.com:5432/tsr_pilot',
    DATABASE_SSL: 'true',
    CORS_ORIGIN: 'https://pilot.example.com',
    PUBLIC_API_BASE_URL: 'https://api.pilot.example.com',
    GOOGLE_MAPS_API_KEY: 'configured-test-placeholder-shape',
    ADMIN_DASHBOARD_PASSWORD: 'configured-test-password',
    ADMIN_DASHBOARD_SECRET: '12345678901234567890123456789012',
    DRIVER_API_TOKEN: '12345678901234567890123456789012',
    ALLOW_LEGACY_DRIVER_API_TOKEN: 'false',
    PHOTO_STORAGE_PROVIDER: 's3',
    PHOTO_STORAGE_BUCKET: 'pilot-bucket',
    PHOTO_STORAGE_REGION: 'us-east-1',
    PHOTO_STORAGE_ACCESS_KEY_ID: 'access',
    PHOTO_STORAGE_SECRET_ACCESS_KEY: 'secret'
  });
  assert.strictEqual(ready.items.find((entry) => entry.key === 'DATABASE_URL').status, STATUSES.READY);
  assert.strictEqual(ready.items.find((entry) => entry.key === 'CORS_ORIGIN').status, STATUSES.READY);
  console.log('[test:pilot-env] pilot environment readiness model verified.');
}

function main() {
  if (process.argv.includes('--test')) return runSelfTest();
  const result = buildPilotEnvironmentReadiness(process.env);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'READY') process.exit(1);
}

main();

module.exports = {
  STATUSES,
  buildPilotEnvironmentReadiness,
  isPlaceholder
};
