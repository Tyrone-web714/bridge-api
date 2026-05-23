require('dotenv').config();

const { spawnSync } = require('child_process');
const postgres = require('../db/postgres');
const photoStorage = require('../services/photoStorage');
const driverAuth = require('../services/driverAuth');

const REQUIRED_ENV = [
  'GOOGLE_MAPS_API_KEY',
  'DATABASE_URL',
  'ADMIN_DASHBOARD_PASSWORD',
  'ADMIN_DASHBOARD_SECRET',
  'DRIVER_API_TOKEN',
  'CORS_ORIGIN',
  'PHOTO_STORAGE_PROVIDER'
];

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized ||
    normalized.includes('your_') ||
    normalized.includes('choose-') ||
    normalized.includes('localhost') ||
    normalized.includes('username:password');
}

function checkRequiredEnv() {
  const failures = [];
  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (!value) {
      failures.push(`${key} is missing`);
    } else if (key !== 'CORS_ORIGIN' && isPlaceholder(value)) {
      failures.push(`${key} still looks like a placeholder`);
    }
  }

  if (process.env.CORS_ORIGIN === '*') {
    failures.push('CORS_ORIGIN is "*" - set this to the deployed mobile/web origins for pilot');
  }

  if (process.env.ADMIN_DASHBOARD_SECRET && process.env.ADMIN_DASHBOARD_SECRET.length < 32) {
    failures.push('ADMIN_DASHBOARD_SECRET should be at least 32 characters');
  }

  if (driverAuth.getDriverApiToken() && driverAuth.getDriverApiToken().length < 32) {
    failures.push('DRIVER_API_TOKEN should be at least 32 characters');
  }

  const storage = photoStorage.getStorageStatus();
  if (!storage.configured) {
    for (const issue of storage.issues || []) {
      failures.push(issue);
    }
  }
  if (!storage.durable) {
    failures.push('PHOTO_STORAGE_PROVIDER must be a durable provider such as "s3" for production pilot');
  }
  if (storage.provider === 's3') {
    for (const key of ['PHOTO_STORAGE_BUCKET', 'PHOTO_STORAGE_REGION', 'PHOTO_STORAGE_PUBLIC_BASE_URL']) {
      if (!process.env[key] || isPlaceholder(process.env[key])) {
        failures.push(`${key} is missing or still looks like a placeholder`);
      }
    }
  }

  return failures;
}

async function main() {
  const failures = checkRequiredEnv();
  const secretAudit = spawnSync(process.execPath, ['scripts/audit-secrets.cjs'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  if (secretAudit.status !== 0) {
    failures.push('Secret audit failed; run npm.cmd run verify:secrets for details');
  }

  if (process.env.DATABASE_URL) {
    try {
      await postgres.ensureSchema();
      const result = await postgres.rawQuery('SELECT 1 AS ok');
      if (result.rows[0]?.ok !== 1) {
        failures.push('Database connectivity check did not return expected result');
      }
      const postgisReady = await postgres.isPostgisEnabled();
      if (!postgisReady) {
        failures.push('PostGIS is not ready; run npm.cmd run db:postgis:init after installing PostGIS');
      }
      const adminUsers = await postgres.rawQuery("SELECT count(*)::int AS count FROM admin_users WHERE active = true");
      if ((adminUsers.rows[0]?.count || 0) < 1) {
        failures.push('No active admin_users exist; run npm.cmd run admin:create to create a named admin user');
      }
    } catch (error) {
      failures.push(`Database check failed: ${error.message}`);
    } finally {
      await postgres.closePool();
    }
  }

  if (failures.length) {
    console.error('Production config verification failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Production config verification passed.');
}

main().catch(async (error) => {
  console.error('Production config verification crashed:', error);
  await postgres.closePool();
  process.exit(1);
});
