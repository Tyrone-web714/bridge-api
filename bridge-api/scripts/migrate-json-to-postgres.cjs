const fs = require('fs');
const path = require('path');
require('dotenv').config();

const postgres = require('../db/postgres');
const repositories = require('../db/repositories');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_RETRIES = Number.parseInt(process.env.DB_MIGRATE_MAX_RETRIES, 10) || 5;
const RETRY_SLEEP_MS = Number.parseInt(process.env.DB_MIGRATE_RETRY_SLEEP_MS, 10) || 2500;
const BATCH_SIZE = Number.parseInt(process.env.DB_MIGRATE_BATCH_SIZE, 10) || 250;

function readJsonArray(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) return [];

  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${filename} must contain a JSON array`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDatabaseError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('connection ended') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('terminating connection') ||
    message.includes('server closed the connection')
  );
}

async function runWithDatabaseRetry(handler, record, label, recordNumber) {
  let attempt = 0;

  while (true) {
    try {
      return await handler(record);
    } catch (error) {
      attempt += 1;
      if (!isTransientDatabaseError(error) || attempt > MAX_RETRIES) {
        throw error;
      }

      console.warn(
        `[db:migrate] ${label} record ${recordNumber} lost database connection; retry ${attempt}/${MAX_RETRIES}`
      );
      await postgres.closePool();
      await sleep(RETRY_SLEEP_MS * attempt);
      await postgres.ensureSchema();
    }
  }
}

async function migrateBatch(records, handler, label, batchSize = 500) {
  let imported = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    for (const record of batch) {
      await runWithDatabaseRetry(handler, record, label, imported + 1);
      imported += 1;
    }
    console.log(`[db:migrate] ${label}: ${imported}/${records.length}`);
  }
  return imported;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Add it to .env before running this migration.');
  }

  await postgres.ensureSchema();

  const manualHazards = readJsonArray('manual_hazards.json');
  const deliveryNotes = readJsonArray('delivery_notes.json');
  const recentDestinations = readJsonArray('recent_destinations.json');
  const lowBridges = readJsonArray('low_clearance_bridges.json');
  const noTruckZones = readJsonArray('no_truck_zones.json');
  const residentialZones = readJsonArray('residential_zones.json');

  console.log('[db:migrate] starting JSON to PostgreSQL import');
  console.log(`[db:migrate] manual hazards: ${manualHazards.length}`);
  console.log(`[db:migrate] delivery notes: ${deliveryNotes.length}`);
  console.log(`[db:migrate] recent destinations: ${recentDestinations.length}`);
  console.log(`[db:migrate] low bridges: ${lowBridges.length}`);
  console.log(`[db:migrate] no-truck zones: ${noTruckZones.length}`);
  console.log(`[db:migrate] residential zones: ${residentialZones.length}`);

  await migrateBatch(manualHazards, repositories.upsertManualHazard, 'manual hazards', Math.min(BATCH_SIZE, 250));
  await migrateBatch(deliveryNotes, repositories.upsertDeliveryNote, 'delivery notes', Math.min(BATCH_SIZE, 100));
  await migrateBatch(
    recentDestinations,
    (record) => repositories.saveRecentDestination(record, 12),
    'recent destinations',
    Math.min(BATCH_SIZE, 25)
  );
  await migrateBatch(lowBridges, repositories.upsertStaticBridge, 'low bridges', BATCH_SIZE);
  await migrateBatch(noTruckZones, (record) => repositories.upsertStaticZone(record, 'no_truck'), 'no-truck zones', BATCH_SIZE);
  await migrateBatch(residentialZones, (record) => repositories.upsertStaticZone(record, 'residential'), 'residential zones', BATCH_SIZE);

  console.log('[db:migrate] complete');
}

main()
  .catch((error) => {
    console.error('[db:migrate] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
